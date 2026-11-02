"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SavedWeek } from "@/lib/history";
import { departmentOrder, departmentScoreSeries, kpiTrends } from "@/lib/trends";
import { fmt, signed } from "@/lib/format";
import { ChartTooltip, type TipItem } from "./ChartTooltip";
import { Delta } from "./KpiStrip";
import { Panel } from "./ui";

const seriesColor = (i: number) => `var(--series-${(i % 6) + 1})`;

export function HistoryTrends({ history }: { history: SavedWeek[] }) {
  const departments = departmentOrder(history);
  const data = departmentScoreSeries(history);
  const trends = kpiTrends(history)
    .filter((t) => t.points.length >= 2)
    .sort((a, b) => Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0) || Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0));

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Panel title="Оцінки відділів по тижнях">
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2" aria-label="Легенда">
          {departments.map((d, i) => (
            <li key={d} className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ background: seriesColor(i), height: 2 }} />
              {d}
            </li>
          ))}
        </ul>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="week" stroke="var(--axis)" tick={{ fill: "var(--muted)", fontSize: 11 }} tickLine={false} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} stroke="var(--axis)" tick={{ fill: "var(--muted)", fontSize: 12 }} tickLine={false} axisLine={false} width={36} />
              <Tooltip
                cursor={{ stroke: "var(--axis)" }}
                content={(props) => (
                  <ChartTooltip active={props.active} label={props.label as string | undefined} payload={[...(props.payload ?? [])] as TipItem[]} />
                )}
              />
              {departments.map((d, i) => (
                <Line
                  key={d}
                  type="monotone"
                  dataKey={(p: Record<string, unknown>) => p[d]}
                  name={d}
                  stroke={seriesColor(i)}
                  strokeWidth={2}
                  dot={{ r: 4, fill: seriesColor(i), stroke: "var(--surface)", strokeWidth: 2 }}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        {history.length < 3 && <p className="mt-3 text-sm text-ink-2">Тренди і прогноз з'являться після 3 проаналізованих тижнів.</p>}
      </Panel>

      <Panel title="Динаміка KPI">
        {trends.length === 0 ? (
          <p className="text-sm text-ink-2">Додайте звіти ще хоча б за один тиждень, щоб порівняти показники.</p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="tabular w-full min-w-[560px] text-sm">
              <thead className="text-xs text-ink-2">
                <tr className="border-b border-line text-left">
                  <th className="px-2 py-2 font-medium">Показник</th>
                  <th className="px-2 py-2 text-right font-medium">Зараз</th>
                  <th className="px-2 py-2 text-right font-medium">Зміна</th>
                  <th className="px-2 py-2 text-right font-medium">Прогноз</th>
                  <th className="px-2 py-2 text-right font-medium">Відхилення</th>
                </tr>
              </thead>
              <tbody>
                {trends.slice(0, 25).map((t) => (
                  <tr key={t.key}>
                    <td className="px-2 py-2">
                      <span className="text-ink">{t.name}</span>
                      <span className="block text-xs text-muted">{t.department}</span>
                    </td>
                    <td className="px-2 py-2 text-right text-ink">
                      {fmt(t.last)} <span className="text-xs text-ink-2">{t.unit}</span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Delta value={t.changePct} lowerIsBetter={!t.higherIsBetter} />
                    </td>
                    <td className="px-2 py-2 text-right text-ink-2">{t.forecast === null ? "-" : fmt(t.forecast)}</td>
                    <td className={`px-2 py-2 text-right ${t.z !== null && Math.abs(t.z) >= 2.5 ? "font-semibold text-bad" : "text-ink-2"}`}>
                      {t.z === null ? "-" : `${signed(t.z)} σ`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">Прогноз: лінійна регресія від 3 тижнів. Відхилення: стійкий z (медіана, MAD) від 4 тижнів, |z| ≥ 2,5 виділено.</p>
      </Panel>
    </div>
  );
}
