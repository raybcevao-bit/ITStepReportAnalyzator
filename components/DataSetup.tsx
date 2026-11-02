"use client";

import { ArrowDown } from "@phosphor-icons/react";
import type { DatasetSchema, Table } from "@/lib/types";
import { Select } from "./ui";

export function DataSetup({ table, schema, onChange }: { table: Table; schema: DatasetSchema; onChange: (s: DatasetSchema) => void }) {
  const cols = table.headers.map((h) => ({ value: h, label: h }));
  const none = { value: "", label: "Не обрано" };
  const candidates = table.headers.filter((h) => h !== schema.dateCol && h !== schema.entityCol && h !== schema.textCol);

  const toggleMetric = (h: string) => {
    const on = schema.metricCols.includes(h);
    onChange({
      ...schema,
      metricCols: on ? schema.metricCols.filter((m) => m !== h) : [...schema.metricCols, h],
      lowerIsBetter: on ? schema.lowerIsBetter.filter((m) => m !== h) : schema.lowerIsBetter,
    });
  };
  const toggleLower = (h: string) =>
    onChange({
      ...schema,
      lowerIsBetter: schema.lowerIsBetter.includes(h) ? schema.lowerIsBetter.filter((m) => m !== h) : [...schema.lowerIsBetter, h],
    });

  return (
    <details className="group rounded-2xl border border-line bg-surface p-5 md:p-6" open={!schema.dateCol || !schema.entityCol || schema.metricCols.length === 0}>
      <summary className="cursor-pointer list-none text-sm text-ink-2 marker:hidden">
        <span className="font-semibold text-ink">Структура даних</span>
        <span className="ml-2">
          {table.rows.length} рядків, {schema.metricCols.length} метрик. Натисніть, щоб змінити колонки.
        </span>
      </summary>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Select label="Дата звіту" value={schema.dateCol} onChange={(v) => onChange({ ...schema, dateCol: v, metricCols: schema.metricCols.filter((m) => m !== v) })} options={[none, ...cols]} />
        <Select label="Виконавець" value={schema.entityCol} onChange={(v) => onChange({ ...schema, entityCol: v, metricCols: schema.metricCols.filter((m) => m !== v) })} options={[none, ...cols]} />
        <Select label="Коментар (текст)" value={schema.textCol ?? ""} onChange={(v) => onChange({ ...schema, textCol: v || null, metricCols: schema.metricCols.filter((m) => m !== v) })} options={[none, ...cols]} />
      </div>
      <div className="mt-5">
        <p className="mb-2 text-sm text-ink-2">Метрики (стрілка вниз означає "менше = краще")</p>
        <div className="flex flex-wrap gap-2">
          {candidates.map((h) => {
            const on = schema.metricCols.includes(h);
            const low = schema.lowerIsBetter.includes(h);
            return (
              <span key={h} className={`inline-flex items-center overflow-hidden rounded-full border text-sm ${on ? "border-accent" : "border-line"}`}>
                <button type="button" onClick={() => toggleMetric(h)} aria-pressed={on} className={`px-3 py-1.5 ${on ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-surface-2"}`}>
                  {h}
                </button>
                {on && (
                  <button
                    type="button"
                    onClick={() => toggleLower(h)}
                    aria-pressed={low}
                    title="Менше = краще"
                    aria-label={`${h}: менше значення краще`}
                    className={`border-l border-line px-2 py-1.5 ${low ? "bg-warn-bg text-warn" : "text-muted hover:bg-surface-2"}`}
                  >
                    <ArrowDown size={14} weight="bold" />
                  </button>
                )}
              </span>
            );
          })}
        </div>
      </div>
    </details>
  );
}
