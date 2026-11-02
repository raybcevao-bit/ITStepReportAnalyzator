import { ArrowDown, ArrowUp, Minus } from "@phosphor-icons/react";
import type { MetricForecast } from "@/lib/ml";
import { fmtCompact, signed } from "@/lib/format";

export function Delta({ value, lowerIsBetter = false, suffix = "%" }: { value: number | null; lowerIsBetter?: boolean; suffix?: string }) {
  if (value === null) return <span className="text-sm text-muted">немає порівняння</span>;
  const flat = Math.abs(value) < 0.5;
  const good = !flat && value > 0 !== lowerIsBetter;
  const Icon = flat ? Minus : value > 0 ? ArrowUp : ArrowDown;
  const tone = flat ? "text-ink-2 bg-surface-2" : good ? "text-good bg-good-bg" : "text-bad bg-bad-bg";
  return (
    <span className={`tabular inline-flex w-fit items-center gap-1 self-start rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      <Icon size={12} weight="bold" aria-hidden />
      {signed(value, suffix)}
      <span className="sr-only">{flat ? "без змін" : good ? "покращення" : "погіршення"}</span>
    </span>
  );
}

export function KpiStrip({ forecasts }: { forecasts: MetricForecast[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {forecasts.map((f) => (
        <div key={f.metric} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
          <span className="truncate text-sm text-ink-2" title={f.metric}>
            {f.metric}
          </span>
          <span className="text-3xl font-semibold tracking-tight text-ink">{fmtCompact(f.current)}</span>
          <Delta value={f.changePct} lowerIsBetter={f.lowerIsBetter} />
          <span className="tabular text-xs text-muted">
            Прогноз: {fmtCompact(f.forecast)} ({fmtCompact(f.low)} - {fmtCompact(f.high)})
          </span>
        </div>
      ))}
    </div>
  );
}
