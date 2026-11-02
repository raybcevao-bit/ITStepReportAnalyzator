"use client";

import { useState } from "react";
import { ReportsMode } from "@/components/ReportsMode";
import { TableMode } from "@/components/TableMode";

const MODES = [
  { id: "reports", label: "Звіти відділів" },
  { id: "table", label: "Таблиця метрик" },
] as const;

export default function Home() {
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("reports");

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8 md:py-8">
      <nav className="mb-6 inline-flex rounded-xl border border-line bg-surface p-1" aria-label="Режим аналізу">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            aria-pressed={mode === m.id}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${mode === m.id ? "bg-accent text-accent-ink" : "text-ink-2 hover:text-ink"}`}
          >
            {m.label}
          </button>
        ))}
      </nav>
      {/* Обидва режими лишаються змонтованими, щоб не втрачати стан при перемиканні. */}
      <div hidden={mode !== "reports"}>
        <ReportsMode />
      </div>
      <div hidden={mode !== "table"}>
        <TableMode />
      </div>
    </main>
  );
}
