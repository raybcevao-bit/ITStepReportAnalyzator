"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Analysis } from "@/lib/ml";
import { fmtCompact, fmtWeek } from "@/lib/format";
import { ChartTooltip, type TipItem } from "./ChartTooltip";
import { Panel, Select } from "./ui";

export function TeamTrend({ analysis }: { analysis: Analysis }) {
  const [metric, setMetric] = useState(analysis.metrics[0] ?? "");
  const m = analysis.metrics.includes(metric) ? metric : (analysis.metrics[0] ?? "");
  const fc = analysis.forecasts.find((f) => f.metric === m);

  const data: { week: string; actual: number | null; forecast: number | null; range: [number, number] | null }[] = analysis.teamSeries.map((p, i) => {
    const v = typeof p[m] === "number" ? (p[m] as number) : null;
    const last = i === analysis.teamSeries.length - 1;
    return { week: p.week, actual: v, forecast: last ? v : null, range: null };
  });
  if (fc && analysis.weeks.length >= 3) {
    data.push({ week: analysis.nextWeek, actual: null, forecast: fc.forecast, range: [fc.low, fc.high] });
  }

  return (
    <Panel
      title="Динаміка команди"
      action={
        <div className="w-56 max-w-full">
          <Select label="Метрика" value={m} onChange={setMetric} options={analysis.metrics.map((x) => ({ value: x, label: x }))} />
        </div>
      }
    >
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="week" tickFormatter={fmtWeek} stroke="var(--axis)" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} />
            <YAxis tickFormatter={(v: number) => fmtCompact(v)} stroke="var(--axis)" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={false} width={56} />
            <Tooltip
              cursor={{ stroke: "var(--axis)" }}
              content={(props) => {
                const items = ([...(props.payload ?? [])] as TipItem[]).filter((p, idx, arr) => !(p.name === "Прогноз" && arr.some((q) => q.name === "Факт" && q.value === p.value)));
                const range = data.find((d) => d.week === props.label)?.range;
                return (
                  <ChartTooltip
                    active={props.active}
                    payload={items}
                    label={props.label as string | undefined}
                    extra={range ? `95% інтервал: ${fmtCompact(range[0])} - ${fmtCompact(range[1])}` : undefined}
                  />
                );
              }}
            />
            <Line type="monotone" dataKey="actual" name="Факт" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls={false} isAnimationActive={false} />
            <Line type="monotone" dataKey="forecast" name="Прогноз" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 4, fill: "var(--surface)", stroke: "var(--accent)", strokeWidth: 2 }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {fc && (
        <p className="mt-3 text-sm text-ink-2">
          Лінійний тренд: {fc.slope > 0 ? "+" : ""}
          {fmtCompact(fc.slope)} за тиждень, R² = {fc.r2.toFixed(2)}.{" "}
          {analysis.weeks.length < 4 || fc.r2 < 0.3 ? "Тренд слабкий, прогноз орієнтовний." : "Пунктир показує прогноз на наступний тиждень."}
        </p>
      )}
    </Panel>
  );
}
