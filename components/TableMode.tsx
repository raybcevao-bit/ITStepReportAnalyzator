"use client";

import { useMemo, useState } from "react";
import { ArrowCounterClockwise } from "@phosphor-icons/react";
import { fmtWeekRange } from "@/lib/format";
import { analyze, type Analysis } from "@/lib/ml";
import { detectSchema, readTable } from "@/lib/parse";
import { sampleTable } from "@/lib/sample";
import type { DatasetSchema, Table } from "@/lib/types";
import { AiPanel } from "./AiPanel";
import { DataSetup } from "./DataSetup";
import { Dropzone } from "./Dropzone";
import { KpiStrip } from "./KpiStrip";
import { Leaderboard } from "./Leaderboard";
import { ScoreChart } from "./ScoreChart";
import { Signals } from "./Signals";
import { TeamTrend } from "./TeamTrend";
import { Button } from "./ui";

/** Режим для табличних звітів "людина x метрики" (CSV/Excel). */
export function TableMode() {
  const [table, setTable] = useState<Table | null>(null);
  const [schema, setSchema] = useState<DatasetSchema | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const result = useMemo<{ analysis: Analysis } | { error: string } | null>(() => {
    if (!table || !schema) return null;
    if (!schema.dateCol || !schema.entityCol) return { error: "Оберіть колонки з датою та виконавцем." };
    if (schema.metricCols.length === 0) return { error: "Оберіть хоча б одну числову метрику." };
    try {
      return { analysis: analyze(table.rows, schema) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Не вдалося проаналізувати дані." };
    }
  }, [table, schema]);

  function load(t: Table) {
    setTable(t);
    setSchema(detectSchema(t));
    setSelected(null);
    setLoadError(null);
  }

  async function onFile(file: File) {
    setLoading(true);
    try {
      load(await readTable(file));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Не вдалося прочитати файл.");
    } finally {
      setLoading(false);
    }
  }

  const analysis = result && "analysis" in result ? result.analysis : null;

  if (!table || !schema) {
    return (
      <div aria-busy={loading}>
        <Dropzone onFile={onFile} onSample={() => load(sampleTable())} error={loadError} />
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {analysis ? `Тиждень ${fmtWeekRange(analysis.currentWeek)}` : "Тижневі звіти"}
          </h1>
          <p className="mt-1 text-sm text-ink-2">
            {table.fileName}
            {analysis && `, ${analysis.weeks.length} тиж. історії, ${analysis.entities.length} виконавців у звіті`}
            {analysis && analysis.skippedRows > 0 && `, пропущено рядків без дати чи виконавця: ${analysis.skippedRows}`}
          </p>
        </div>
        <Button variant="ghost" onClick={() => { setTable(null); setSchema(null); }}>
          <ArrowCounterClockwise size={16} /> Інший файл
        </Button>
      </header>

      <DataSetup table={table} schema={schema} onChange={setSchema} />

      {result && "error" in result && (
        <p role="alert" className="rounded-xl bg-bad-bg px-4 py-3 text-sm text-bad">
          {result.error}
        </p>
      )}

      {analysis && (
        <>
          <KpiStrip forecasts={analysis.forecasts} />
          <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
            <TeamTrend analysis={analysis} />
            <Signals analysis={analysis} />
          </div>
          <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
            <Leaderboard analysis={analysis} selected={selected} onSelect={setSelected} />
            <ScoreChart analysis={analysis} selected={selected} />
          </div>
          <AiPanel analysis={analysis} />
        </>
      )}
    </div>
  );
}
