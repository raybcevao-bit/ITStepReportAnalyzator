import type { Doc } from "./docText";
import type { Review } from "./review";

/**
 * Безкоштовний аналіз без LLM: правила під шаблон тижневих звітів
 * ("1. Маркетинг", "Досягнення:", "Проблеми:", "Плани на наступний тиждень:").
 * Результат має ту саму форму, що й огляд від Claude, тож UI та історія спільні.
 */

type Dept = Review["departments"][number];
type Kpi = Dept["kpis"][number];

const DEPTS = [
  { name: "Маркетинг", head: /маркетинг/i, file: /маркет/i },
  { name: "Продажі", head: /продаж/i, file: /продаж/i },
  { name: "Навчальна частина", head: /навчальн[аі]\s+частин|^муп/i, file: /муп|навчальн/i },
  { name: "Фінансовий відділ", head: /фінансов|бухгалтер|економіст/i, file: /економіст|фінанс|бухгалт/i },
];

const NUM = String.raw`\d{1,3}(?:[  ]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?`;
const DASH = String.raw`\s*[—–-]\s*`;
const toNum = (s: string) => Number(s.replace(/[  ]/g, "").replace(",", "."));
const norm = (s: string) => s.toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/gi, " ").trim();
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const SEVERE = /втрат|скарг|не можемо|немає вхідних|майже немає|відсутність вхідних|без конверсі|не вказано|не зафіксовано|критичн(?!і боржники відсутні)/i;

const MONTHS = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];

// ---------- Період і філія ----------

interface Period {
  start: string;
  end: string;
  label: string;
}

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function findPeriod(text: string, fallbackYear: number): Period | null {
  const dotted = text.match(/(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\s*[–—-]\s*(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/);
  if (dotted) {
    const [, d1, m1, y1, d2, m2, y2] = dotted;
    const year = Number(y2 ?? y1 ?? fallbackYear);
    const y = year < 100 ? year + 2000 : year;
    if (+m1 >= 1 && +m1 <= 12 && +m2 >= 1 && +m2 <= 12) {
      return { start: iso(y, +m1, +d1), end: iso(y, +m2, +d2), label: `${d1.padStart(2, "0")}.${m1.padStart(2, "0")} - ${d2.padStart(2, "0")}.${m2.padStart(2, "0")}.${y}` };
    }
  }
  const worded = text.match(new RegExp(String.raw`(\d{1,2})\s*[–—-]\s*(\d{1,2})\s+(${MONTHS.join("|")})(?:\s+(\d{4}))?`, "i"));
  if (worded) {
    const m = MONTHS.indexOf(worded[3].toLowerCase()) + 1;
    const y = Number(worded[4] ?? fallbackYear);
    const mm = String(m).padStart(2, "0");
    return { start: iso(y, m, +worded[1]), end: iso(y, m, +worded[2]), label: `${worded[1].padStart(2, "0")}.${mm} - ${worded[2].padStart(2, "0")}.${mm}.${y}` };
  }
  return null;
}

// ---------- Розбиття на відділи та підрозділи ----------

interface Section {
  dept: string;
  text: string;
  source: string;
  standalone: boolean;
}

const isReview = (d: Doc) => /рев.?ю|ревью|review/i.test(d.name) && /аналіз роботи відділів|аналіз тижня/i.test(d.text);

/**
 * Заголовок розділу: "2. Продажі." Для назв відділів формат довільний; інші нумеровані заголовки
 * ("5. Робота з колективом.") приймаємо лише на початку комірки рев'ю, щоб не плутати з нумерованими планами.
 */
const GENERAL_PLANS = "Загальні плани";

function headingDept(rawLine: string, inReview: boolean, cellStart: boolean): string | null {
  const line = rawLine.replace(/^\s*\|\s*/, "").replace(/\s*\|\s*$/, "");
  const m = line.match(/^\s*(\d+)\.\s*([^\n]{0,70}?)\.?\s*$/);
  if (!m) return null;
  const dept = m[2].split(/\s+/).length <= 4 ? DEPTS.find((d) => d.head.test(m[2]))?.name : undefined;
  if (dept) return dept;
  const knownReviewSection = /^(робота з колективом|взаємодія|плани? на наступн|інше)/i.test(m[2]);
  if (inReview && (cellStart || knownReviewSection || /^\s*\|/.test(rawLine)) && m[2].split(/\s+/).length <= 10) {
    const title = m[2].split(":")[0].trim();
    return !title || /^плани?\s/i.test(title) ? GENERAL_PLANS : cap(title);
  }
  return null;
}

function splitSections(doc: Doc): Section[] {
  const lines = doc.text.split("\n");
  const sections: Section[] = [];
  let current: { dept: string; lines: string[] } | null = null;
  const intro: string[] = [];
  const inReview = isReview(doc);
  let afterCell = true; // попередній непорожній рядок закрив комірку таблиці рев'ю
  for (const line of lines) {
    if (!line.trim()) continue;
    if (line.trim() === "|") {
      afterCell = true;
      (current?.lines ?? intro).push(line);
      continue;
    }
    const dept = headingDept(line, inReview, afterCell);
    afterCell = false;
    if (dept) {
      if (current) sections.push({ dept: current.dept, text: current.lines.join("\n"), source: doc.name, standalone: false });
      // Заголовок "Плани на наступний тиждень" сам є маркером розділу планів.
      current = { dept, lines: dept === GENERAL_PLANS ? [line] : [] };
    } else if (current) current.lines.push(line);
    else intro.push(line);
  }
  if (current) sections.push({ dept: current.dept, text: current.lines.join("\n"), source: doc.name, standalone: false });

  if (inReview) {
    const introText = intro
      .join("\n")
      .split(/аналіз роботи відділів/i)[0]
      .split("\n")
      .filter((l) => !/^\s*\|?\s*(тижневе рев|аналіз тижня)/i.test(l))
      .join("\n");
    if (introText.trim()) sections.unshift({ dept: "Адміністрація", text: introText, source: doc.name, standalone: true });
  } else if (sections.length === 0) {
    const byFile = DEPTS.find((d) => d.file.test(doc.name));
    if (byFile) sections.push({ dept: byFile.name, text: doc.text, source: doc.name, standalone: true });
  }
  // Окремий файл одного відділу важливіший за копію в рев'ю директора.
  if (!inReview && sections.length === 1) sections[0].standalone = true;
  return sections.filter((s) => s.text.replace(/[|\s]/g, "").length > 0);
}

type Part = "achievements" | "problems" | "plans";

const MARKERS: { part: Part; re: RegExp }[] = [
  { part: "achievements", re: /досягнення\s*:?/i },
  { part: "problems", re: /проблеми\s*:?/i },
  { part: "plans", re: /плани?\s+на\s+наступн\S*\s+тиждень\s*:?/i },
  { part: "plans", re: /заходи для клієнтів[^\n]*/i },
];

/** Коротка комірка таблиці з даними ("| 104,12", "| 2 ліди") та її сусіди. */
const isCellLine = (l: string) => {
  const rest = l.replace(/^\s*\|\s*/, "").trim();
  return /^\s*\|/.test(l) && rest.length > 0 && rest.length < 60;
};

function cleanItems(text: string): string[] {
  const raw = text.split("\n");
  const inTable = raw.map((l, i) => isCellLine(l) || (l.trim().length < 40 && (isCellLine(raw[i - 1] ?? "") || isCellLine(raw[i + 1] ?? ""))));
  const out: string[] = [];
  raw.forEach((rawLine, i) => {
    if (inTable[i]) return;
    const line = rawLine
      .replace(/^\s*\|\s*/, "")
      .replace(/^\s*(?:[-•*]|\d+[.)])\s+/, "")
      .replace(/\s*\|\s*$/, "")
      .trim();
    if (!line) return;
    if ((line.match(/ \| /g) ?? []).length >= 2) return; // рядок таблиці
    if (rawLine.trim().startsWith("*")) return; // примітка до таблиці
    if (line.length < 25 && !/\d/.test(line)) return; // підзаголовок
    if (/^звітний період/i.test(line)) return;
    if (/^\[.*\]\.?$/.test(line)) return; // незаповнена підказка з шаблону
    if (/^(філія|період|відділ|звіт підготува\S*|відповідальн\S*)\s*:/i.test(line)) return; // поля шапки шаблону
    if (/досягнень немає|проблем\S*.{0,30}не було|без проблем/i.test(line)) return; // "нічого не сталося"
    // Ручні переноси рядків у Word: продовження речення з малої літери.
    const prev = out[out.length - 1];
    if (prev && /^[а-яіїєґa-z]/.test(line) && !/[.!?:]$/.test(prev)) {
      out[out.length - 1] = `${prev} ${line}`;
      return;
    }
    if (line.length > 320) {
      out.push(...line.split(/(?<=[.!?])\s+(?=[А-ЯІЇЄҐA-Z«"])/).filter((s) => s.length > 20));
    } else out.push(line);
  });
  return out;
}

/** Близькі за змістом пункти (той самий текст у звіті відділу і в рев'ю). */
function similar(a: string, b: string): boolean {
  const wa = new Set(norm(a).split(" ").filter((w) => w.length > 3));
  const wb = new Set(norm(b).split(" ").filter((w) => w.length > 3));
  if (!wa.size || !wb.size) return norm(a) === norm(b);
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / Math.min(wa.size, wb.size) >= 0.75;
}

function splitParts(text: string): Record<Part, string[]> {
  const hits = MARKERS.flatMap(({ part, re }) => {
    const m = re.exec(text);
    return m ? [{ part, start: m.index, end: m.index + m[0].length }] : [];
  }).sort((a, b) => a.start - b.start);
  const parts: Record<Part, string[]> = { achievements: [], problems: [], plans: [] };
  if (hits.length === 0) {
    // Немає розмітки: розкладаємо речення за змістом.
    for (const s of cleanItems(text)) (SEVERE.test(s) || /проблем|вимикають|тривог|скарж/i.test(s) ? parts.problems : parts.achievements).push(s);
    return parts;
  }
  hits.forEach((h, i) => {
    const body = text.slice(h.end, hits[i + 1]?.start ?? text.length);
    parts[h.part].push(...cleanItems(body));
  });
  return parts;
}

// ---------- KPI ----------

interface Rule {
  re: RegExp;
  make: (m: RegExpMatchArray, ctx: string) => Kpi | null;
}

const withCtx = (ctx: string, name: string) => (ctx ? `${ctx}: ${name}` : cap(name));

const RULES: Rule[] = [
  { re: new RegExp(String.raw`витра[тч]\S*\s+(${NUM})\s*(\$|грн)`, "i"), make: (m, c) => ({ name: withCtx(c, "витрати"), value: toNum(m[1]), unit: m[2], higher_is_better: false }) },
  { re: new RegExp(String.raw`отримано\s+(${NUM})\s+(?:результат|лід)`, "i"), make: (m, c) => ({ name: withCtx(c, "ліди"), value: toNum(m[1]), unit: "шт", higher_is_better: true }) },
  { re: new RegExp(String.raw`(${NUM})\s+кліки?(?:в)?`, "i"), make: (m, c) => ({ name: withCtx(c, "кліки"), value: toNum(m[1]), unit: "шт", higher_is_better: true }) },
  { re: new RegExp(String.raw`(?:і|та|,)\s+(${NUM})\s+конверсі`, "i"), make: (m, c) => ({ name: withCtx(c, "конверсії"), value: toNum(m[1]), unit: "шт", higher_is_better: true }) },
  { re: new RegExp(String.raw`(?:ціна результату|CPL)${DASH}(${NUM})\s*(\$|грн)`, "i"), make: (m, c) => ({ name: withCtx(c, "ціна ліда"), value: toNum(m[1]), unit: m[2], higher_is_better: false }) },
  { re: new RegExp(String.raw`ціна конверсії${DASH}(${NUM})\s*(\$|грн)`, "i"), make: (m, c) => ({ name: withCtx(c, "ціна конверсії"), value: toNum(m[1]), unit: m[2], higher_is_better: false }) },
  { re: new RegExp(String.raw`CPC${DASH}(${NUM})\s*(\$|грн)`), make: (m, c) => ({ name: withCtx(c, "CPC"), value: toNum(m[1]), unit: m[2], higher_is_better: false }) },
  { re: new RegExp(String.raw`CTR[^—–\d]{0,40}${DASH}(${NUM})\s*%`), make: (m, c) => ({ name: withCtx(c, "CTR"), value: toNum(m[1]), unit: "%", higher_is_better: true }) },
  { re: new RegExp(String.raw`(${NUM})\s+контакт`, "i"), make: (m) => ({ name: "Опрацьовано контактів", value: toNum(m[1]), unit: "шт", higher_is_better: true }) },
  { re: new RegExp(String.raw`(?:оформили|уклали|підписали)\s+(${NUM})\s+договор`, "i"), make: (m) => ({ name: "Договори", value: toNum(m[1]), unit: "шт", higher_is_better: true }) },
  {
    re: /час\S*\s+на\s+лінії\s+([А-ЯІЇЄҐ][^\s(]+)[^–—\n]*[–—-]\s*(?:(\d+)\s*годин\S*)?\s*(?:(\d+)\s*хвилин\S*)?/i,
    make: (m) => {
      const hours = Number(m[2] ?? 0) + Number(m[3] ?? 0) / 60;
      return hours ? { name: `Час на лінії: ${m[1]}`, value: Math.round(hours * 100) / 100, unit: "год", higher_is_better: true } : null;
    },
  },
  { re: /(\d+)\s+втрат/i, make: (m) => ({ name: "Втрати студентів", value: Number(m[1]), unit: "студ", higher_is_better: false }) },
  { re: /оптимізовано\s+(\d+)/i, make: (m) => ({ name: "Оптимізовано груп", value: Number(m[1]), unit: "груп", higher_is_better: true }) },
  { re: /поновлення[^–—\n]*[–—-]\s*(\d+)/i, make: (m) => ({ name: "Поновлено студентів", value: Number(m[1]), unit: "студ", higher_is_better: true }) },
  { re: /критичні боржники відсутні/i, make: () => ({ name: "Критичні боржники", value: 0, unit: "шт", higher_is_better: false }) },
  { re: /(\d+)\s+(?:критичн\S*\s+)?боржник/i, make: (m) => ({ name: "Боржники", value: Number(m[1]), unit: "шт", higher_is_better: false }) },
];

/** Контекст для маркетингових цифр: "Академія Meta", "Школа Google Ads". */
function contextOf(line: string): string | null {
  const m = line.match(/^(Академія|Школа)\s+(Meta|Google Ads|Google|TikTok)/i);
  return m ? `${m[2]} ${m[1].toLowerCase()}` : null;
}

const LOWER_BETTER = /витрат|ціна|cpc|cpl|втрат|боржник|борг|скарг|помилк|пропущен/i;

/** Значення з комірки шаблону: "1 115", "40,01", "1:34" (години:хвилини). */
function cellNumber(cell: string): number | null {
  const s = cell.trim();
  const hm = s.match(/^(\d+):(\d{2})$/);
  if (hm) return Math.round((Number(hm[1]) + Number(hm[2]) / 60) * 100) / 100;
  if (!new RegExp(String.raw`^-?(?:${NUM})$`).test(s.replace(/%$/, "").trim())) return null;
  return toNum(s.replace(/%$/, "").trim());
}

/** Таблиця шаблону "Показник | Значення | Одиниця": найнадійніше джерело KPI. */
function tableKpis(text: string): Kpi[] {
  const out: Kpi[] = [];
  let active = false;
  for (const line of text.split("\n")) {
    const cells = line.split(" | ").map((c) => c.trim());
    if (cells.length < 2) {
      if (line.trim()) active = false;
      continue;
    }
    if (/показник/i.test(cells[0]) && /значення/i.test(cells[1] ?? "")) {
      active = true;
      continue;
    }
    if (!active || !cells[0] || /^\[.*\]$/.test(cells[0])) continue;
    const value = cellNumber(cells[1] ?? "");
    if (value === null) continue;
    const unit = (cells[2] ?? "").replace(/^\[.*\]$/, "");
    out.push({ name: cells[0], value, unit, higher_is_better: !LOWER_BETTER.test(cells[0]) });
  }
  return out;
}

function extractKpis(text: string): Kpi[] {
  // Таблиця шаблону авторитетна: текстові евристики тоді лише додавали б шум з описів.
  const fromTable = tableKpis(text);
  if (fromTable.length) return fromTable;
  const found = new Map<string, Kpi>();
  let ctx = "";
  for (const line of text.split("\n")) {
    const c = contextOf(line.trim());
    if (c) {
      ctx = c;
      continue;
    }
    if ((line.match(/ \| /g) ?? []).length >= 2) continue; // рядки таблиць дублюють підсумки
    for (const rule of RULES) {
      const m = line.match(rule.re);
      if (!m) continue;
      const k = rule.make(m, ctx);
      if (k && !found.has(norm(k.name))) found.set(norm(k.name), k);
    }
  }
  return [...found.values()];
}

// ---------- Особистий табличний звіт (xlsx) ----------

function personalReport(doc: Doc): Dept | null {
  const lines = doc.text.split("\n").map((l) => l.split(" | ").map((c) => c.trim()));
  const title = lines[0]?.[0] ?? "";
  const who = title.match(/^([А-ЯІЇЄҐ][^\s-]+\s+[А-ЯІЇЄҐ][^\s-]+)\s*-\s*звіт/i)?.[1];
  if (!who) return null;
  const achievements: string[] = [];
  const plans: string[] = [];
  const kpis: Kpi[] = [];
  for (const cells of lines.slice(1)) {
    if (/^план/i.test(cells[0] ?? "")) {
      plans.push(...cells.slice(1).filter((c) => c.length > 10));
      continue;
    }
    if (!/^\d+$/.test(cells[0] ?? "")) continue;
    const activity = (cells[1] ?? "").split("(")[0].trim();
    const details = cells[2] ?? "";
    const total = cells[3] ?? "";
    if (details) achievements.push(`${activity}: ${details.replace(/\s+/g, " ")}`);
    const t = total.match(/^(\d+)\s+(.+)$/);
    const d = details.match(/по\s+(\d+)\s+(студ\S*)/i);
    const short = activity.split(/[,/]/)[0].split(/\s+/).slice(0, 4).join(" ");
    if (t) kpis.push({ name: short, value: Number(t[1]), unit: t[2], higher_is_better: true });
    else if (d) kpis.push({ name: short, value: Number(d[1]), unit: "студ", higher_is_better: true });
  }
  if (!achievements.length && !kpis.length) return null;
  return {
    name: who,
    status: "good",
    score: 0,
    score_reason: "",
    achievements: achievements.slice(0, 10),
    problems: [],
    plans,
    kpis,
  };
}

// ---------- Втрати студентів ----------

const LOSS_REASONS: { label: string; re: RegExp }[] = [
  { label: "Не влаштовує напрям навчання", re: /не подобається|бажає вивчати|інший напрям|предмет/i },
  { label: "Безпека, тривоги, віддаленість", re: /тривог|безпе|далеко|вивез|переїзд/i },
  { label: "Фінансові труднощі", re: /фінанс|оплат|кошт/i },
  { label: "Здоров'я", re: /хвор|здоров/i },
];

/** Таблиця шаблону "Причина втрати | Кількість | Можна повернути". */
function tableLosses(text: string): Review["student_losses"] {
  const out: Review["student_losses"] = [];
  let active = false;
  for (const line of text.split("\n")) {
    const cells = line.split(" | ").map((c) => c.trim());
    if (cells.length < 2) {
      if (line.trim()) active = false;
      continue;
    }
    if (/причина/i.test(cells[0]) && /кількість/i.test(cells[1] ?? "")) {
      active = true;
      continue;
    }
    const count = Number((cells[1] ?? "").replace(/\D/g, ""));
    if (!active || !cells[0] || /^\[.*\]$/.test(cells[0]) || !count) continue;
    out.push({ reason: cells[0], count, recoverable: /^(так|yes|\+|можна)/i.test(cells[2] ?? "") });
  }
  return out;
}

function studentLosses(text: string): Review["student_losses"] {
  const fromTable = tableLosses(text);
  if (fromTable.length) return fromTable;
  const counts = new Map<string, { count: number; recoverable: boolean }>();
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*[А-ЯІЇЄҐ][а-яіїєґ'’]+\s+[А-ЯІЇЄҐ][а-яіїєґ'’]+(?:\s+[А-ЯІЇЄҐ][а-яіїєґ'’]+)?\s*[-–—]\s*(.{10,})$/);
    if (!m) continue;
    const reason = LOSS_REASONS.find((r) => r.re.test(m[1]))?.label ?? "Інше";
    const c = counts.get(reason) ?? { count: 0, recoverable: false };
    c.count++;
    c.recoverable ||= /поновит|пізніше|онлайн/i.test(m[1]);
    counts.set(reason, c);
  }
  return [...counts].map(([reason, c]) => ({ reason, count: c.count, recoverable: c.recoverable }));
}

// ---------- Оцінка ----------

function scoreDept(d: Dept): Dept {
  const severe = d.problems.filter((p) => SEVERE.test(p)).length;
  const score = clamp(
    Math.round(64 + 5 * Math.min(d.achievements.length, 4) - 6 * Math.min(d.problems.length, 4) - 4 * Math.min(severe, 3) + (d.kpis.length ? 5 : 0) + (d.plans.length ? 3 : 0)),
    20,
    95,
  );
  const status = score >= 72 ? "good" : score >= 55 ? "watch" : "critical";
  const reason = `${d.achievements.length} досягнень, ${d.problems.length} проблем${severe ? ` (серйозних: ${severe})` : ""}, ${d.kpis.length} показників.`;
  return { ...d, score, status, score_reason: reason };
}

// ---------- Спільні теми ----------

const THEMES: { label: string; re: RegExp }[] = [
  { label: "Повітряні тривоги зривають заняття і роботу", re: /тривог/i },
  { label: "Відключення електроенергії", re: /електр|світл|генератор/i },
  { label: "Проблеми з CRM", re: /crm/i },
  { label: "Скарги батьків", re: /скарг|скаржат/i },
  { label: "Мало вхідних заявок і лідів", re: /немає вхідних|відсутність вхідних|мало лід|майже немає/i },
  { label: "Борги та оплати", re: /боржник|оплат/i },
];

function shorten(s: string, words = 9) {
  const w = s.split(/\s+/);
  return w.length > words ? `${w.slice(0, words).join(" ")}...` : s;
}

// ---------- Головна функція ----------

export function buildLocalReview(docs: Doc[]): Review {
  const allText = docs.map((d) => `${d.name}\n${d.text}`).join("\n");
  const year = Number(allText.match(/20\d\d/)?.[0] ?? new Date().getFullYear());

  // Період: пріоритет рев'ю директора, далі найчастіший.
  const periods = docs.map((d) => ({ doc: d, p: findPeriod(`${d.name}\n${d.text.slice(0, 800)}`, year) })).filter((x): x is { doc: Doc; p: Period } => !!x.p);
  const main = periods.find((x) => isReview(x.doc))?.p ?? periods[0]?.p ?? null;

  const branchRaw =
    allText.match(/^[ \t]*філія[ \t]*:[ \t]*([А-ЯІЇЄҐа-яіїєґ'’-]{3,})/im)?.[1] ??
    // "ФІЛІЇ ЖИТОМИР" або "філії Житомир": назва з великої літери, регістр важливий ("філії на тиждень" не філія).
    allText.match(/(?:[Фф]ілі[їя]|ФІЛІ[ЇЯ])[ \t]+(?!ФІЛІ|Філі)([А-ЯІЇЄҐ][А-ЯІЇЄҐа-яіїєґ'’-]+)/)?.[1];
  const branch = branchRaw ? cap(branchRaw.toLowerCase()) : null;

  // Збір секцій по відділах, окремі файли першими; повтори з рев'ю відкидаються.
  const sections = docs.flatMap(splitSections).sort((a, b) => Number(b.standalone) - Number(a.standalone));
  const depts = new Map<string, Dept>();
  for (const s of sections) {
    const d = depts.get(s.dept) ?? { name: s.dept, status: "good" as const, score: 0, score_reason: "", achievements: [], problems: [], plans: [], kpis: [] };
    const parts = splitParts(s.text);
    const all = () => [...d.achievements, ...d.problems, ...d.plans];
    for (const part of ["achievements", "problems", "plans"] as const) {
      for (const item of parts[part]) if (!all().some((x) => similar(x, item))) d[part].push(item);
    }
    for (const k of extractKpis(s.text)) if (!d.kpis.some((x) => norm(x.name) === norm(k.name))) d.kpis.push(k);
    depts.set(s.dept, d);
  }
  const personal = new Set<string>();
  for (const doc of docs) {
    if (!/\.xlsx$/i.test(doc.name)) continue;
    const p = personalReport(doc);
    if (p) {
      depts.set(p.name, p);
      personal.add(p.name);
    }
  }

  const order = ["Адміністрація", ...DEPTS.map((d) => d.name)];
  const departments = [...depts.values()]
    .filter((d) => d.achievements.length + d.problems.length + d.plans.length + d.kpis.length > 0)
    .map((d) => ({ ...d, achievements: d.achievements.slice(0, 8), problems: d.problems.slice(0, 8), plans: d.plans.slice(0, 6) }))
    .map(scoreDept)
    .sort((a, b) => (order.indexOf(a.name) + 1 || 99) - (order.indexOf(b.name) + 1 || 99));

  const eduText = [...new Set(sections.filter((s) => s.dept === "Навчальна частина").flatMap((s) => s.text.split("\n").map((l) => l.trim())))].join("\n");
  const student_losses = studentLosses(eduText);

  const cross_cutting = THEMES.filter((t) => departments.filter((d) => [...d.problems, ...d.achievements].some((x) => t.re.test(x))).length >= 2).map(
    (t) => `${t.label} (${departments.filter((d) => [...d.problems, ...d.achievements].some((x) => t.re.test(x))).map((d) => d.name).join(", ")})`,
  );

  const risks = departments
    .flatMap((d) => d.problems.map((p) => ({ title: shorten(p, 8), detail: p, severity: (SEVERE.test(p) ? "high" : "medium") as "high" | "medium", department: d.name })))
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1))
    .slice(0, 8);

  const data_quality: string[] = [];
  const labels = [...new Set(periods.map((x) => x.p.label))];
  if (labels.length > 1) {
    data_quality.push(`Звіти охоплюють різні періоди: ${periods.map((x) => `${x.p.label} (${x.doc.name})`).join("; ")}.`);
  }
  for (const doc of docs) {
    if (/не вказано|порожнє поле/i.test(doc.text) && !isReview(doc)) data_quality.push(`У файлі "${doc.name}" частина результатів не вказана у вивантаженні.`);
  }
  for (const d of DEPTS) if (!depts.has(d.name)) data_quality.push(`Немає звіту: ${d.name}.`);
  if (!main) data_quality.push("Не вдалося визначити звітний тиждень за текстом; огляд збережено з датою аналізу.");

  const priorityOf = (d: Dept) =>
    (d.name === GENERAL_PLANS || d.status === "critical" ? "high" : d.status === "watch" ? "medium" : "low") as "high" | "medium" | "low";
  const rank = { high: 0, medium: 1, low: 2 };
  const actions = departments
    .flatMap((d) => d.plans.slice(0, d.name === GENERAL_PLANS ? 5 : 2).map((p) => ({ action: p, owner: d.name === GENERAL_PLANS ? "Директор" : d.name, priority: priorityOf(d) })))
    .sort((a, b) => rank[a.priority] - rank[b.priority])
    .slice(0, 10);

  const questions = risks
    .filter((r) => r.severity === "high")
    .slice(0, 4)
    .map((r) => `${r.department}: який план і термін вирішення? (${shorten(r.detail, 10)})`);

  const coreNames = new Set(DEPTS.map((d) => d.name));
  const core = departments.filter((d) => coreNames.has(d.name));
  const sorted = (core.length ? core : departments.filter((d) => !personal.has(d.name))).sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const lossTotal = student_losses.reduce((a, l) => a + l.count, 0);
  const kpiTotal = departments.reduce((a, d) => a + d.kpis.length, 0);

  return {
    period: main ?? { label: new Date().toLocaleDateString("uk-UA"), start: null, end: null },
    branch,
    headline:
      departments.length >= 2 && best && worst
        ? `Найсильніше: ${best.name} (${best.score}). Потребує уваги: ${worst.name} (${worst.score}).`
        : departments.length
          ? `${departments[0].name}: ${departments[0].score} балів.`
          : "У файлах не знайдено розділів звітів.",
    summary: [
      `Оброблено ${docs.length} файлів: ${departments.length} розділів і ${kpiTotal} числових показників.`,
      cross_cutting.length ? `Спільні причини для кількох відділів: ${THEMES.filter((t) => cross_cutting.some((c) => c.startsWith(t.label))).map((t) => t.label.toLowerCase()).join("; ")}.` : "",
      lossTotal ? `Втрати студентів за тиждень: ${lossTotal}.` : "",
      `Оцінки розраховано за правилами (досягнення, проблеми, наявність показників); для глибших висновків скористайтеся аналізом у Claude.`,
    ]
      .filter(Boolean)
      .join(" "),
    departments,
    student_losses,
    cross_cutting,
    risks,
    data_quality,
    actions,
    questions,
  };
}
