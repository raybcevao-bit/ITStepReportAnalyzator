"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Analysis } from "@/lib/ml";
import { fmtWeek } from "@/lib/format";
import { ChartTooltip, type TipItem } from "./ChartTooltip";
import { Panel } from "./ui";

/** Усі люди тонкими сірими лініями, обрана людина виділена акцентом. */
export function ScoreChart({ analysis, selected }: { analysis: Analysis; selected: string | null }) {
  const names = Object.keys(analysis.scoreSeries[0] ?? {}).filter((k) => k !== "week");
  const focus = selected ?? analysis.entities[0]?.name ?? null;
  const others = names.filter((n) => n !== focus);

  return (
    <Panel title={focus ? `Бал продуктивності: ${focus}` : "Бал продуктивності"}>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={analysis.scoreSeries} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="week" tickFormatter={fmtWeek} stroke="var(--axis)" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} />
            <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} stroke="var(--axis)" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={false} width={36} />
            <ReferenceLine y={50} stroke="var(--axis)" strokeDasharray="3 3" />
            <Tooltip
              cursor={{ stroke: "var(--axis)" }}
              content={(props) => (
                <ChartTooltip
                  active={props.active}
                  label={props.label as string | undefined}
                  payload={([...(props.payload ?? [])] as TipItem[]).filter((p) => p.name === focus)}
                  extra="50 = середній рівень команди"
                />
              )}
            />
            {others.map((n) => (
              <Line key={n} type="monotone" dataKey={(p: Record<string, unknown>) => p[n]} name={n} stroke="var(--axis)" strokeWidth={1} dot={false} activeDot={false} connectNulls isAnimationActive={false} />
            ))}
            {focus && (
              <Line type="monotone" dataKey={(p: Record<string, unknown>) => p[focus]} name={focus} stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-sm text-ink-2">Сірі лінії: решта команди. Оберіть людину в таблиці, щоб побачити її динаміку.</p>
    </Panel>
  );
}
