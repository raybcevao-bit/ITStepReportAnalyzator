"use client";

import { useState } from "react";
import { DownloadSimple, Sparkle, Warning, WarningCircle } from "@phosphor-icons/react";
import { InsightsSchema, type Insights } from "@/lib/insights";
import type { Analysis } from "@/lib/ml";
import { toClaudePayload } from "@/lib/ml";
import { chatPrompt, INSIGHTS_SYSTEM } from "@/lib/prompts";
import { fmtWeekRange } from "@/lib/format";
import { useApiStatus } from "@/lib/useApiStatus";
import { ClaudeHandoff } from "./ClaudeHandoff";
import { Button, Panel } from "./ui";

type State = { kind: "idle" } | { kind: "loading" } | { kind: "error"; message: string } | { kind: "done"; insights: Insights };

const SEVERITY: Record<Insights["risks"][number]["severity"], { label: string; tone: string }> = {
  high: { label: "Високий", tone: "bg-bad-bg text-bad" },
  medium: { label: "Середній", tone: "bg-warn-bg text-warn" },
  low: { label: "Низький", tone: "bg-surface-2 text-ink-2" },
};

const STATUS: Record<Insights["people"][number]["status"], { label: string; tone: string }> = {
  leader: { label: "Лідер", tone: "bg-good-bg text-good" },
  stable: { label: "Стабільно", tone: "bg-surface-2 text-ink-2" },
  attention: { label: "Потрібна увага", tone: "bg-warn-bg text-warn" },
};

export function AiPanel({ analysis }: { analysis: Analysis }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const apiEnabled = useApiStatus();

  const task = () => `Проаналізуй тижневі звіти команди і дай висновки за схемою.\n\n<weekly_data>\n${JSON.stringify(toClaudePayload(analysis))}\n</weekly_data>`;

  async function runApi() {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ analysis: toClaudePayload(analysis) }),
      });
      const data = (await res.json().catch(() => ({}))) as { result?: Insights; error?: string };
      if (!res.ok || !data.result) {
        setState({ kind: "error", message: data.error ?? `Помилка сервера (${res.status}).` });
        return;
      }
      setState({ kind: "done", insights: data.result });
    } catch {
      setState({ kind: "error", message: "Немає зв'язку з сервером." });
    }
  }

  return (
    <Panel
      title={
        <span className="inline-flex items-center gap-2">
          <Sparkle size={18} weight="fill" className="text-accent" aria-hidden /> Висновки Claude
        </span>
      }
      action={
        <div className="flex flex-wrap gap-2">
          {state.kind === "done" && (
            <>
              <Button variant="ghost" onClick={() => downloadMarkdown(analysis, state.insights)}>
                <DownloadSimple size={16} /> Звіт .md
              </Button>
              <Button variant="ghost" onClick={() => setState({ kind: "idle" })}>
                Новий запит
              </Button>
            </>
          )}
          {apiEnabled && state.kind !== "done" && (
            <Button variant="ghost" onClick={runApi} disabled={state.kind === "loading"}>
              <Sparkle size={16} /> Через API
            </Button>
          )}
        </div>
      }
    >
      {(state.kind === "idle" || state.kind === "error") && (
        <div className="grid gap-4">
          <p className="max-w-[75ch] text-sm leading-relaxed text-ink-2">
            Claude отримає агреговані метрики, бали, тренди, аномалії та коментарі поточного тижня (не весь файл) і підготує підсумок, ризики, оцінку кожної людини та план дій.
          </p>
          <ClaudeHandoff schema={InsightsSchema} buildPrompt={() => chatPrompt(INSIGHTS_SYSTEM, InsightsSchema, task())} onResult={(insights) => setState({ kind: "done", insights })} />
        </div>
      )}

      {state.kind === "loading" && (
        <div className="grid gap-3" aria-busy="true" aria-label="Claude аналізує звіти">
          <div className="skeleton h-6 w-2/3" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
        </div>
      )}

      {state.kind === "error" && (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-bad-bg px-4 py-3 text-sm text-bad">
          <WarningCircle size={18} className="mt-0.5 shrink-0" aria-hidden /> {state.message}
        </p>
      )}

      {state.kind === "done" && <InsightsView insights={state.insights} />}
    </Panel>
  );
}

function InsightsView({ insights }: { insights: Insights }) {
  return (
    <div className="grid gap-8">
      <div className="max-w-[80ch]">
        <p className="text-xl font-semibold leading-snug tracking-tight text-ink">{insights.headline}</p>
        <p className="mt-3 leading-relaxed text-ink-2">{insights.summary}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Що вдалося</h3>
          <ul className="grid gap-2 text-sm text-ink-2">
            {insights.highlights.map((h, i) => (
              <li key={i} className="border-l-2 border-good pl-3">{h}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Ризики</h3>
          <ul className="grid gap-3 text-sm">
            {insights.risks.map((r, i) => (
              <li key={i} className="flex gap-3">
                <Warning size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
                <div>
                  <p className="font-medium text-ink">
                    {r.title}{" "}
                    <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-normal ${SEVERITY[r.severity].tone}`}>{SEVERITY[r.severity].label}</span>
                  </p>
                  <p className="text-ink-2">{r.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-ink">По людях</h3>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {insights.people.map((p) => (
            <div key={p.name} className="rounded-xl border border-line p-4 text-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-medium text-ink">{p.name}</span>
                <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs ${STATUS[p.status].tone}`}>{STATUS[p.status].label}</span>
              </div>
              <p className="text-ink-2">{p.assessment}</p>
              <p className="mt-2 text-ink">{p.recommendation}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">План на наступний тиждень</h3>
          <ol className="grid list-decimal gap-2 pl-5 text-sm text-ink-2 marker:text-muted">
            {insights.actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ol>
        </div>
        <div className="grid gap-5 text-sm">
          <div>
            <h3 className="mb-2 font-semibold text-ink">Прогноз</h3>
            <p className="text-ink-2">{insights.forecast_comment}</p>
          </div>
          {insights.report_themes.length > 0 && (
            <div>
              <h3 className="mb-2 font-semibold text-ink">Теми зі звітів</h3>
              <ul className="flex flex-wrap gap-2">
                {insights.report_themes.map((t, i) => (
                  <li key={i} className="rounded-full bg-surface-2 px-3 py-1 text-ink-2">{t}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted">Висновки згенеровані AI на основі ваших даних. Перевіряйте важливі рішення.</p>
    </div>
  );
}

function downloadMarkdown(a: Analysis, ins: Insights) {
  const lines = [
    `# Тижневий звіт: ${fmtWeekRange(a.currentWeek)}`,
    "",
    `**${ins.headline}**`,
    "",
    ins.summary,
    "",
    "## Що вдалося",
    ...ins.highlights.map((h) => `- ${h}`),
    "",
    "## Ризики",
    ...ins.risks.map((r) => `- **${r.title}** (${SEVERITY[r.severity].label.toLowerCase()}): ${r.detail}`),
    "",
    "## По людях",
    ...ins.people.map((p) => `- **${p.name}** (${STATUS[p.status].label.toLowerCase()}): ${p.assessment} Рекомендація: ${p.recommendation}`),
    "",
    "## План на наступний тиждень",
    ...ins.actions.map((x, i) => `${i + 1}. ${x}`),
    "",
    "## Прогноз",
    ins.forecast_comment,
    "",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `zvit-${a.currentWeek}.md`;
  link.click();
  URL.revokeObjectURL(url);
}
