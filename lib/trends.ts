import { linreg } from "./ml";
import { weekSortKey, type SavedWeek } from "./history";

export interface KpiTrend {
  key: string;
  department: string;
  name: string;
  unit: string;
  higherIsBetter: boolean;
  points: { week: string; value: number }[];
  last: number;
  previous: number | null;
  changePct: number | null;
  forecast: number | null;
  /** Відхилення останнього значення від попередньої історії (стійкий z), якщо історії достатньо. */
  z: number | null;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

function robustZ(history: number[], value: number): number | null {
  if (history.length < 3) return null;
  const s = [...history].sort((a, b) => a - b);
  const med = s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
  const devs = history.map((h) => Math.abs(h - med)).sort((a, b) => a - b);
  const mad = devs.length % 2 ? devs[(devs.length - 1) / 2] : (devs[devs.length / 2 - 1] + devs[devs.length / 2]) / 2;
  let scale = 1.4826 * mad;
  if (scale === 0) {
    const m = history.reduce((a, b) => a + b, 0) / history.length;
    scale = Math.sqrt(history.reduce((a, h) => a + (h - m) ** 2, 0) / (history.length - 1));
  }
  return scale === 0 ? null : round((value - med) / scale);
}

export function weekLabel(w: SavedWeek): string {
  return w.review.period.label || weekSortKey(w);
}

/** Сталий порядок відділів, щоб колір завжди відповідав тому самому відділу. */
export function departmentOrder(history: SavedWeek[]): string[] {
  const preferred = ["маркетинг", "продажі", "навчальна частина", "фінансовий відділ", "адміністрація"];
  const all = [...new Set(history.flatMap((w) => w.review.departments.map((d) => d.name)))];
  return all.sort((a, b) => {
    const ia = preferred.findIndex((p) => norm(a).startsWith(p.slice(0, 6)));
    const ib = preferred.findIndex((p) => norm(b).startsWith(p.slice(0, 6)));
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b, "uk");
  });
}

export function departmentScoreSeries(history: SavedWeek[]) {
  return history.map((w) => {
    const point: Record<string, string | number | null> = { week: weekLabel(w) };
    for (const d of w.review.departments) point[d.name] = d.score;
    return point;
  });
}

export function kpiTrends(history: SavedWeek[]): KpiTrend[] {
  const map = new Map<string, KpiTrend>();
  for (const w of history) {
    for (const d of w.review.departments) {
      for (const k of d.kpis) {
        if (k.value === null) continue;
        const key = `${norm(d.name)}::${norm(k.name)}`;
        const t =
          map.get(key) ??
          ({ key, department: d.name, name: k.name, unit: k.unit, higherIsBetter: k.higher_is_better, points: [], last: 0, previous: null, changePct: null, forecast: null, z: null } as KpiTrend);
        t.points.push({ week: weekLabel(w), value: k.value });
        map.set(key, t);
      }
    }
  }
  return [...map.values()].map((t) => {
    const values = t.points.map((p) => p.value);
    const last = values[values.length - 1];
    const previous = values.length > 1 ? values[values.length - 2] : null;
    const fit = linreg(values.map((y, x) => ({ x, y })));
    return {
      ...t,
      last,
      previous,
      changePct: previous ? round(((last - previous) / Math.abs(previous)) * 100, 1) : null,
      forecast: values.length >= 3 ? round(fit.intercept + fit.slope * values.length) : null,
      z: robustZ(values.slice(0, -1), last),
    };
  });
}
