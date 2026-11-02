import type { Review } from "./review";

export interface SavedWeek {
  id: string;
  savedAt: string;
  files: string[];
  /** local: правила в браузері; claude: відповідь Claude (чат або API). */
  source?: "local" | "claude";
  review: Review;
}

// Історія тижнів живе лише в цьому браузері; для перенесення є експорт/імпорт JSON.
const KEY = "weekly-insights:history:v1";

export function loadHistory(): SavedWeek[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedWeek[]) : [];
    return Array.isArray(parsed) ? parsed.filter((w) => w?.review?.departments) : [];
  } catch {
    return [];
  }
}

export function saveHistory(weeks: SavedWeek[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(weeks));
  } catch {
    // Приватний режим або переповнене сховище: історія просто не збережеться.
  }
}

export function weekId(review: Review): string {
  return review.period.start ?? review.period.label;
}

export function weekSortKey(w: SavedWeek): string {
  return w.review.period.start ?? w.savedAt.slice(0, 10);
}

/** Додає тиждень або замінює той самий період, повертає відсортований список. */
export function upsertWeek(history: SavedWeek[], week: SavedWeek): SavedWeek[] {
  return [...history.filter((w) => w.id !== week.id), week].sort((a, b) => weekSortKey(a).localeCompare(weekSortKey(b)));
}

export function knownKpiNames(history: SavedWeek[]): string[] {
  const names = new Set<string>();
  for (const w of history) for (const d of w.review.departments) for (const k of d.kpis) names.add(`${d.name}: ${k.name}`);
  return [...names];
}

export function parseImport(text: string): SavedWeek[] {
  const data = JSON.parse(text) as unknown;
  if (!Array.isArray(data)) throw new Error("Файл не схожий на експорт історії.");
  const weeks = data.filter((w): w is SavedWeek => !!w && typeof w === "object" && "review" in w && "id" in w);
  if (weeks.length === 0) throw new Error("У файлі немає збережених тижнів.");
  return weeks;
}
