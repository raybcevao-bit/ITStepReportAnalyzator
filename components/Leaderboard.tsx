"use client";

import { useState } from "react";
import { ArrowsDownUp, TrendDown, TrendUp, Minus } from "@phosphor-icons/react";
import type { Analysis, EntityStat } from "@/lib/ml";
import { fmt, signed } from "@/lib/format";
import { Delta } from "./KpiStrip";
import { Panel } from "./ui";

type SortKey = "score" | "scoreDelta" | "trendSlope" | "forecast" | "name";

const CLUSTER_TONE: Record<string, string> = {
  "Лідери": "bg-good-bg text-good",
  "Сильніша група": "bg-good-bg text-good",
  "Стабільне ядро": "bg-surface-2 text-ink-2",
  "Зона уваги": "bg-warn-bg text-warn",
};

export function Leaderboard({ analysis, selected, onSelect }: { analysis: Analysis; selected: string | null; onSelect: (n: string) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "score", dir: -1 });
  const rows = [...analysis.entities].sort((a, b) => {
    const av = a[sort.key] ?? -Infinity;
    const bv = b[sort.key] ?? -Infinity;
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv, "uk") * sort.dir;
    return ((av as number) - (bv as number)) * sort.dir;
  });

  const head = (key: SortKey, label: string, align = "text-right") => (
    <th className={`px-3 py-2 font-medium ${align}`} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : -1 }))}>
        {label}
        <ArrowsDownUp size={12} aria-hidden />
      </button>
    </th>
  );

  return (
    <Panel title="Рейтинг тижня">
      <div className="-mx-2 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-xs text-ink-2">
            <tr className="border-b border-line">
              {head("name", "Виконавець", "text-left")}
              {head("score", "Бал")}
              {head("scoreDelta", "За тиждень")}
              {head("trendSlope", "Тренд")}
              {head("forecast", "Прогноз")}
              <th className="px-3 py-2 text-left font-medium">Група</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <Row key={e.name} e={e} active={e.name === selected} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-ink-2">Бал 0-100 рахується відносно команди цього тижня; тренд це нахил регресії балу за тиждень.</p>
    </Panel>
  );
}

function Row({ e, active, onSelect }: { e: EntityStat; active: boolean; onSelect: (n: string) => void }) {
  const TrendIcon = Math.abs(e.trendSlope) < 0.5 ? Minus : e.trendSlope > 0 ? TrendUp : TrendDown;
  const trendTone = Math.abs(e.trendSlope) < 0.5 ? "text-muted" : e.trendSlope > 0 ? "text-good" : "text-bad";
  return (
    <tr
      onClick={() => onSelect(e.name)}
      className={`tabular cursor-pointer transition-colors ${active ? "bg-surface-2" : "hover:bg-surface-2"}`}
      aria-selected={active}
    >
      <td className="px-3 py-2.5 text-left">
        <button type="button" className="font-medium text-ink hover:underline" onClick={() => onSelect(e.name)}>
          {e.name}
        </button>
      </td>
      <td className="px-3 py-2.5 text-right font-semibold text-ink">{fmt(e.score)}</td>
      <td className="px-3 py-2.5 text-right">
        <Delta value={e.scoreDelta} suffix="" />
      </td>
      <td className={`px-3 py-2.5 text-right ${trendTone}`}>
        <span className="inline-flex items-center gap-1">
          <TrendIcon size={14} aria-hidden />
          {signed(e.trendSlope)}
        </span>
      </td>
      <td className="px-3 py-2.5 text-right text-ink-2">{fmt(e.forecast)}</td>
      <td className="px-3 py-2.5">
        {e.cluster && <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${CLUSTER_TONE[e.cluster] ?? "bg-surface-2 text-ink-2"}`}>{e.cluster}</span>}
      </td>
    </tr>
  );
}
