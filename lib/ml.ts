import { toDate, toNumber } from "./parse";
import type { DatasetSchema, RawRow } from "./types";

/** Метрики-частки (конверсія, рейтинг) усереднюються, решта сумується. */
const MEAN_RE = /%|конверс|conversion|rate|ratio|середн|avg|average|оцінк|рейтинг|nps|csat|score|бал/i;
export const isMeanMetric = (m: string) => MEAN_RE.test(m);

export interface WeekPoint {
  week: string;
  [key: string]: number | string | null;
}

export interface EntityStat {
  name: string;
  /** Бал продуктивності 0-100 відносно команди в поточному тижні (50 = середній рівень). */
  score: number;
  scoreDelta: number | null;
  /** Нахил лінійної регресії балу, пунктів за тиждень. */
  trendSlope: number;
  trendR2: number;
  forecast: number;
  weeksObserved: number;
  cluster: string;
  latest: Record<string, number | null>;
  previous: Record<string, number | null> | null;
}

export interface Anomaly {
  name: string;
  metric: string;
  value: number;
  expected: number;
  z: number;
  good: boolean;
}

export interface MetricForecast {
  metric: string;
  current: number | null;
  previous: number | null;
  changePct: number | null;
  forecast: number;
  low: number;
  high: number;
  slope: number;
  r2: number;
  lowerIsBetter: boolean;
}

export interface Cluster {
  label: string;
  members: string[];
  avgScore: number;
}

export interface Analysis {
  rowCount: number;
  skippedRows: number;
  weeks: string[];
  currentWeek: string;
  previousWeek: string | null;
  nextWeek: string;
  metrics: string[];
  lowerIsBetter: string[];
  teamSeries: WeekPoint[];
  scoreSeries: WeekPoint[];
  entities: EntityStat[];
  anomalies: Anomaly[];
  forecasts: MetricForecast[];
  clusters: Cluster[];
  missingReports: string[];
  comments: { name: string; text: string }[];
}

export function weekStart(d: Date): string {
  const monday = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - monday)).toISOString().slice(0, 10);
}

function addWeeks(week: string, n: number): string {
  const d = new Date(`${week}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 7 * n);
  return d.toISOString().slice(0, 10);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const std = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1));
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const round = (x: number, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

/** Найменші квадрати по точках (x, y). */
export function linreg(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0, residStd: 0 };
  const xm = mean(points.map((p) => p.x));
  const ym = mean(points.map((p) => p.y));
  let sxy = 0;
  let sxx = 0;
  for (const p of points) {
    sxy += (p.x - xm) * (p.y - ym);
    sxx += (p.x - xm) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = ym - slope * xm;
  let ssr = 0;
  let sst = 0;
  for (const p of points) {
    ssr += (p.y - (intercept + slope * p.x)) ** 2;
    sst += (p.y - ym) ** 2;
  }
  return {
    slope,
    intercept,
    r2: sst === 0 ? 0 : 1 - ssr / sst,
    residStd: n > 2 ? Math.sqrt(ssr / (n - 2)) : 0,
  };
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist2 = (a: number[], b: number[]) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);

/** k-means з детермінованою ініціалізацією k-means++, щоб результат не "стрибав" між запусками. */
export function kmeans(vectors: number[][], k: number, iterations = 60): number[] {
  const n = vectors.length;
  if (n === 0) return [];
  const rand = mulberry32(42);
  const centroids: number[][] = [vectors[Math.floor(rand() * n)]];
  while (centroids.length < k) {
    const d = vectors.map((v) => Math.min(...centroids.map((c) => dist2(v, c))));
    const total = d.reduce((a, b) => a + b, 0);
    if (total === 0) break;
    let r = rand() * total;
    let idx = 0;
    while (idx < n - 1 && r > d[idx]) r -= d[idx++];
    centroids.push(vectors[idx]);
  }
  let assign = new Array<number>(n).fill(0);
  for (let it = 0; it < iterations; it++) {
    const next = vectors.map((v) => {
      let best = 0;
      for (let c = 1; c < centroids.length; c++) if (dist2(v, centroids[c]) < dist2(v, centroids[best])) best = c;
      return best;
    });
    const changed = next.some((a, i) => a !== assign[i]);
    assign = next;
    centroids.forEach((_, c) => {
      const members = vectors.filter((_, i) => assign[i] === c);
      if (members.length) centroids[c] = members[0].map((_, j) => mean(members.map((m) => m[j])));
    });
    if (!changed && it > 0) break;
  }
  return assign;
}

type Bucket = { sum: Record<string, number>; cnt: Record<string, number>; texts: string[] };

export function analyze(rows: RawRow[], schema: DatasetSchema): Analysis {
  const { dateCol, entityCol, metricCols: metrics, textCol } = schema;
  const lower = new Set(schema.lowerIsBetter);
  const byWeek = new Map<string, Map<string, Bucket>>();
  let skipped = 0;

  for (const row of rows) {
    const date = toDate(row[dateCol]);
    const name = String(row[entityCol] ?? "").trim();
    if (!date || !name) {
      skipped++;
      continue;
    }
    const week = weekStart(date);
    const entities = byWeek.get(week) ?? new Map<string, Bucket>();
    byWeek.set(week, entities);
    const b = entities.get(name) ?? { sum: {}, cnt: {}, texts: [] };
    entities.set(name, b);
    for (const m of metrics) {
      const v = toNumber(row[m]);
      if (v === null) continue;
      b.sum[m] = (b.sum[m] ?? 0) + v;
      b.cnt[m] = (b.cnt[m] ?? 0) + 1;
    }
    if (textCol) {
      const t = String(row[textCol] ?? "").trim();
      if (t) b.texts.push(t);
    }
  }

  const weeks = [...byWeek.keys()].sort();
  if (weeks.length === 0) {
    throw new Error("Не знайдено жодного рядка з датою та виконавцем. Перевірте вибір колонок.");
  }
  const currentWeek = weeks[weeks.length - 1];
  const previousWeek = weeks.length > 1 ? weeks[weeks.length - 2] : null;
  const weekIndex = new Map(weeks.map((w, i) => [w, i]));

  const value = (b: Bucket | undefined, m: string): number | null => {
    if (!b || !b.cnt[m]) return null;
    return isMeanMetric(m) ? b.sum[m] / b.cnt[m] : b.sum[m];
  };

  // Командні ряди по тижнях.
  const teamSeries: WeekPoint[] = weeks.map((w) => {
    const point: WeekPoint = { week: w };
    const entities = [...byWeek.get(w)!.values()];
    for (const m of metrics) {
      const vals = entities.map((b) => value(b, m)).filter((v): v is number => v !== null);
      point[m] = vals.length ? round(isMeanMetric(m) ? mean(vals) : vals.reduce((a, b) => a + b, 0), 2) : null;
    }
    return point;
  });

  // Бал продуктивності: середній z-score по метриках відносно команди того ж тижня.
  const zVectors = new Map<string, Map<string, number[]>>();
  const scores = new Map<string, Map<string, number>>();
  for (const w of weeks) {
    const entities = byWeek.get(w)!;
    const names = [...entities.keys()];
    const vecs = new Map<string, number[]>(names.map((n) => [n, []]));
    for (const m of metrics) {
      const vals = names.map((n) => value(entities.get(n), m));
      const present = vals.filter((v): v is number => v !== null);
      const mu = mean(present);
      const sd = std(present);
      names.forEach((n, i) => {
        const v = vals[i];
        const z = v === null || sd === 0 ? 0 : ((v - mu) / sd) * (lower.has(m) ? -1 : 1);
        vecs.get(n)!.push(clamp(z, -3, 3));
      });
    }
    zVectors.set(w, vecs);
    scores.set(w, new Map(names.map((n) => [n, round(clamp(50 + 18 * mean(vecs.get(n)!), 0, 100))])));
  }

  const allNames = [...new Set(weeks.flatMap((w) => [...byWeek.get(w)!.keys()]))].sort((a, b) => a.localeCompare(b, "uk"));
  const scoreSeries: WeekPoint[] = weeks.map((w) => {
    const p: WeekPoint = { week: w };
    for (const n of allNames) p[n] = scores.get(w)!.get(n) ?? null;
    return p;
  });

  const current = byWeek.get(currentWeek)!;
  const prev = previousWeek ? byWeek.get(previousWeek)! : null;
  const currentNames = [...current.keys()];

  const entities: EntityStat[] = currentNames.map((name) => {
    const history = weeks
      .map((w) => ({ x: weekIndex.get(w)!, y: scores.get(w)!.get(name) }))
      .filter((p): p is { x: number; y: number } => p.y !== undefined);
    const fit = linreg(history);
    const score = scores.get(currentWeek)!.get(name)!;
    const prevScore = previousWeek ? scores.get(previousWeek)!.get(name) : undefined;
    const forecast = history.length >= 3 ? fit.intercept + fit.slope * weeks.length : score;
    return {
      name,
      score,
      scoreDelta: prevScore === undefined ? null : round(score - prevScore),
      trendSlope: round(fit.slope, 2),
      trendR2: round(fit.r2, 2),
      forecast: round(clamp(forecast, 0, 100)),
      weeksObserved: history.length,
      cluster: "",
      latest: Object.fromEntries(metrics.map((m) => [m, value(current.get(name), m)])),
      previous: prev?.has(name) ? Object.fromEntries(metrics.map((m) => [m, value(prev.get(name), m)])) : null,
    };
  });

  // Аномалії: поточне значення проти власної історії людини (медіана + MAD, стійкі до викидів).
  const anomalies: Anomaly[] = [];
  for (const name of currentNames) {
    for (const m of metrics) {
      const cur = value(current.get(name), m);
      if (cur === null) continue;
      const hist = weeks
        .slice(0, -1)
        .map((w) => value(byWeek.get(w)!.get(name), m))
        .filter((v): v is number => v !== null);
      if (hist.length < 3) continue;
      const med = median(hist);
      let scale = 1.4826 * median(hist.map((h) => Math.abs(h - med)));
      if (scale === 0) scale = std(hist);
      if (scale === 0) continue;
      const z = (cur - med) / scale;
      if (Math.abs(z) >= 2.5) {
        anomalies.push({ name, metric: m, value: round(cur, 2), expected: round(med, 2), z: round(z, 2), good: (z > 0) !== lower.has(m) });
      }
    }
  }
  anomalies.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));

  // Прогноз командних метрик на наступний тиждень із 95% інтервалом.
  const forecasts: MetricForecast[] = metrics.map((m) => {
    const pts = teamSeries
      .map((p, i) => ({ x: i, y: p[m] }))
      .filter((p): p is { x: number; y: number } => typeof p.y === "number");
    const fit = linreg(pts);
    const cur = teamSeries[teamSeries.length - 1][m];
    const prevV = teamSeries.length > 1 ? teamSeries[teamSeries.length - 2][m] : null;
    const curN = typeof cur === "number" ? cur : null;
    const prevN = typeof prevV === "number" ? prevV : null;
    const f = pts.length >= 3 ? fit.intercept + fit.slope * weeks.length : (curN ?? 0);
    const band = pts.length >= 4 ? 1.96 * fit.residStd : Math.abs(f) * 0.15;
    return {
      metric: m,
      current: curN,
      previous: prevN,
      changePct: curN !== null && prevN ? round(((curN - prevN) / Math.abs(prevN)) * 100) : null,
      forecast: round(Math.max(0, f), 2),
      low: round(Math.max(0, f - band), 2),
      high: round(f + band, 2),
      slope: round(fit.slope, 3),
      r2: round(fit.r2, 2),
      lowerIsBetter: lower.has(m),
    };
  });

  // Кластери за профілем метрик поточного тижня.
  const clusters: Cluster[] = [];
  const k = Math.min(3, currentNames.length);
  if (k >= 2 && metrics.length > 0) {
    const vecs = zVectors.get(currentWeek)!;
    const assign = kmeans(currentNames.map((n) => vecs.get(n)!), k);
    const groups = [...new Set(assign)].map((c) => {
      const members = currentNames.filter((_, i) => assign[i] === c);
      return { members, avgScore: round(mean(members.map((n) => scores.get(currentWeek)!.get(n)!))) };
    });
    groups.sort((a, b) => b.avgScore - a.avgScore);
    const labels = groups.length === 3 ? ["Лідери", "Стабільне ядро", "Зона уваги"] : ["Сильніша група", "Зона уваги"];
    groups.forEach((g, i) => {
      const label = labels[i] ?? `Група ${i + 1}`;
      clusters.push({ label, ...g });
      for (const e of entities) if (g.members.includes(e.name)) e.cluster = label;
    });
  }

  entities.sort((a, b) => b.score - a.score);

  return {
    rowCount: rows.length,
    skippedRows: skipped,
    weeks,
    currentWeek,
    previousWeek,
    nextWeek: addWeeks(currentWeek, 1),
    metrics,
    lowerIsBetter: [...lower],
    teamSeries,
    scoreSeries,
    entities,
    anomalies: anomalies.slice(0, 25),
    forecasts,
    clusters,
    missingReports: prev ? [...prev.keys()].filter((n) => !current.has(n)) : [],
    comments: currentNames.flatMap((name) => current.get(name)!.texts.map((text) => ({ name, text }))),
  };
}

/** Компактне представлення для Claude: агрегати й висновки моделей, а не сирі рядки. */
export function toClaudePayload(a: Analysis) {
  return {
    current_week: a.currentWeek,
    previous_week: a.previousWeek,
    next_week: a.nextWeek,
    weeks_in_data: a.weeks.length,
    metrics: a.metrics.map((m) => ({ name: m, lower_is_better: a.lowerIsBetter.includes(m), aggregation: isMeanMetric(m) ? "mean" : "sum" })),
    team_trend_last_12_weeks: a.teamSeries.slice(-12),
    team_forecasts: a.forecasts,
    people: a.entities.map((e) => ({
      name: e.name,
      score: e.score,
      score_delta: e.scoreDelta,
      trend_points_per_week: e.trendSlope,
      trend_r2: e.trendR2,
      forecast_score: e.forecast,
      weeks_observed: e.weeksObserved,
      cluster: e.cluster || null,
      this_week: e.latest,
      last_week: e.previous,
    })),
    clusters: a.clusters,
    anomalies: a.anomalies,
    missing_reports_this_week: a.missingReports,
    report_comments: a.comments.slice(0, 120).map((c) => ({ name: c.name, text: c.text.slice(0, 500) })),
  };
}

export type ClaudePayload = ReturnType<typeof toClaudePayload>;
