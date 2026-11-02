const num = new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("uk-UA", { notation: "compact", maximumFractionDigits: 1 });

export const fmt = (v: number | null | undefined) => (v === null || v === undefined ? "-" : num.format(v));
export const fmtCompact = (v: number | null | undefined) =>
  v === null || v === undefined ? "-" : Math.abs(v) >= 10000 ? compact.format(v) : num.format(v);

export const fmtWeek = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}.${m}`;
};

export const fmtWeekRange = (iso: string) => {
  const start = new Date(`${iso}T00:00:00Z`);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const f = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${f(start)} - ${f(end)}.${end.getUTCFullYear()}`;
};

export const signed = (v: number | null | undefined, suffix = "") =>
  v === null || v === undefined ? "-" : `${v > 0 ? "+" : ""}${num.format(v)}${suffix}`;
