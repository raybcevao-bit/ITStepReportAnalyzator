import Papa from "papaparse";
import readXlsxFile from "read-excel-file";
import type { Cell, DatasetSchema, RawRow, Table } from "./types";

const DATE_RE = /дата|date|тиждень|week|період|period|день|day/i;
const ENTITY_RE = /співробітн|працівн|менеджер|викладач|виконав|піб|ім'я|імя|name|employee|manager|сотрудн|фио|відділ|філія|branch/i;
const LOWER_BETTER_RE = /скарг|complaint|помилк|error|баг|bug|пропуск|запізн|absen|відмов|churn|відтік|борг|debt|простій|downtime|час відповіді|response time/i;

export async function readTable(file: File): Promise<Table> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx")) {
    const sheet = await readXlsxFile(file);
    const [head = [], ...body] = sheet;
    const headers = uniqueHeaders(head.map((h, i) => String(h ?? "").trim() || `Колонка ${i + 1}`));
    const rows = body
      .filter((r) => r.some((c) => c !== null && c !== ""))
      .map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? null) as Cell])));
    return { fileName: file.name, headers, rows };
  }
  if (name.endsWith(".xls")) {
    throw new Error("Старий формат .xls не підтримується. Збережіть файл як .xlsx або .csv.");
  }
  const text = await file.text();
  const res = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h, i) => h.trim() || `Колонка ${i + 1}`,
  });
  const headers = (res.meta.fields ?? []).filter(Boolean);
  if (headers.length < 2) throw new Error("Не вдалося прочитати колонки. Перевірте, що перший рядок містить заголовки.");
  return { fileName: file.name, headers, rows: res.data as RawRow[] };
}

function uniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();
  return headers.map((h) => {
    const n = seen.get(h) ?? 0;
    seen.set(h, n + 1);
    return n === 0 ? h : `${h} (${n + 1})`;
  });
}

export function toNumber(v: Cell | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "boolean" || v instanceof Date) return null;
  const s = v.replace(/[\s ]/g, "").replace(/%$/, "").replace(",", ".");
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return null;
  return Number(s);
}

export function toDate(v: Cell | undefined): Date | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Порядковий номер дати Excel (1955..2119).
    if (v > 20000 && v < 80000) return new Date(Math.round((v - 25569) * 86_400_000));
    return null;
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return validDate(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (m) {
    const y = +m[3] < 100 ? +m[3] + 2000 : +m[3];
    return validDate(y, +m[2], +m[1]);
  }
  return null;
}

function validDate(y: number, mo: number, d: number): Date | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return Number.isNaN(date.getTime()) ? null : date;
}

function share(rows: RawRow[], col: string, test: (v: Cell) => boolean): number {
  let filled = 0;
  let ok = 0;
  for (const r of rows) {
    const v = r[col];
    if (v === null || v === undefined || v === "") continue;
    filled++;
    if (test(v)) ok++;
  }
  return filled === 0 ? 0 : ok / filled;
}

export function isLowerBetter(metric: string): boolean {
  return LOWER_BETTER_RE.test(metric);
}

/** Евристично визначає, яка колонка дата, хто виконавець, що метрики і де коментарі. */
export function detectSchema({ headers, rows }: Table): DatasetSchema {
  const sample = rows.slice(0, 500);
  const dateLike = (c: string) => share(sample, c, (v) => toDate(typeof v === "number" ? null : v) !== null || v instanceof Date);

  const dateCol =
    headers.find((h) => DATE_RE.test(h) && share(sample, h, (v) => toDate(v) !== null) > 0.7) ??
    headers.find((h) => dateLike(h) > 0.8) ??
    "";

  const isTextCol = (h: string) => h !== dateCol && share(sample, h, (v) => toNumber(v) === null) > 0.8;
  const distinct = (h: string) => new Set(sample.map((r) => String(r[h] ?? "").trim()).filter(Boolean)).size;

  const entityCol =
    headers.find((h) => ENTITY_RE.test(h) && isTextCol(h)) ??
    headers.find((h) => isTextCol(h) && distinct(h) >= 1 && distinct(h) <= Math.max(2, sample.length / 1.5)) ??
    "";

  const metricCols = headers.filter(
    (h) => h !== dateCol && h !== entityCol && share(sample, h, (v) => toNumber(v) !== null) > 0.8,
  );

  const avgLen = (h: string) => {
    const lens = sample.map((r) => String(r[h] ?? "").length).filter((n) => n > 0);
    return lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  };
  const textCandidates = headers
    .filter((h) => h !== dateCol && h !== entityCol && !metricCols.includes(h) && isTextCol(h))
    .sort((a, b) => avgLen(b) - avgLen(a));
  const textCol = textCandidates[0] && avgLen(textCandidates[0]) >= 12 ? textCandidates[0] : null;

  return {
    dateCol,
    entityCol,
    metricCols,
    textCol,
    lowerIsBetter: metricCols.filter(isLowerBetter),
  };
}
