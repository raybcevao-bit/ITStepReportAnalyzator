import { fmt, fmtWeekRange } from "@/lib/format";

export interface TipItem {
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
}

export function ChartTooltip({ active, payload, label, extra }: { active?: boolean; payload?: TipItem[]; label?: string | number; extra?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-[0_8px_24px_rgba(11,11,11,0.12)]">
      {label !== undefined && (
        <div className="mb-1 font-medium text-ink">{/^\d{4}-\d{2}-\d{2}$/.test(String(label)) ? fmtWeekRange(String(label)) : String(label)}</div>
      )}
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p, i) => (
          <div key={i} className="flex items-center gap-2 text-ink-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
            <span>{p.name}</span>
            <span className="tabular ml-auto pl-4 font-medium text-ink">
              {Array.isArray(p.value) ? p.value.map((v) => fmt(Number(v))).join(" - ") : fmt(Number(p.value))}
            </span>
          </div>
        ))}
      {extra && <div className="mt-1 text-muted">{extra}</div>}
    </div>
  );
}
