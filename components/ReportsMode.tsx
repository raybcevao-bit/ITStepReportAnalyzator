"use client";

import { useEffect, useRef, useState } from "react";
import { Cpu, DownloadSimple, FileArrowUp, Lightning, Sparkle, Trash, UploadSimple, WarningCircle, X } from "@phosphor-icons/react";
import { DOC_ACCEPT, isSupportedDoc, readDoc, type Doc } from "@/lib/docText";
import { knownKpiNames, loadHistory, parseImport, saveHistory, upsertWeek, weekId, type SavedWeek } from "@/lib/history";
import { buildLocalReview } from "@/lib/localReview";
import { chatPrompt, documentsBlock, kpiHint, REVIEW_SYSTEM } from "@/lib/prompts";
import { ReviewSchema, type Review } from "@/lib/review";
import { useApiStatus } from "@/lib/useApiStatus";
import { ClaudeHandoff } from "./ClaudeHandoff";
import { HistoryTrends } from "./HistoryTrends";
import { ReviewView, reviewToMarkdown } from "./ReviewView";
import { TemplatesPanel } from "./TemplatesPanel";
import { Button, Panel } from "./ui";

type State = { kind: "idle" } | { kind: "reading" } | { kind: "api" } | { kind: "error"; message: string };

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function ReportsMode() {
  const [files, setFiles] = useState<File[]>([]);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [history, setHistory] = useState<SavedWeek[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Тексти звітів тримаємо лише в пам'яті сесії: вони потрібні для запиту в Claude.
  const [docsById, setDocsById] = useState<Record<string, Doc[]>>({});
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const apiEnabled = useApiStatus();

  useEffect(() => {
    const h = loadHistory();
    setHistory(h);
    setActiveId(h.at(-1)?.id ?? null);
  }, []);

  const active = history.find((w) => w.id === activeId) ?? null;
  const activeDocs = active ? docsById[active.id] : undefined;
  const busy = state.kind === "reading" || state.kind === "api";

  function addFiles(list: FileList | File[]) {
    const incoming = [...list].filter((f) => isSupportedDoc(f.name));
    setFiles((prev) => [...prev.filter((p) => !incoming.some((n) => n.name === p.name)), ...incoming]);
  }

  function commit(next: SavedWeek[]) {
    setHistory(next);
    saveHistory(next);
  }

  function saveReview(review: Review, source: SavedWeek["source"], fileNames: string[], docs: Doc[] | undefined, replaceId?: string) {
    const id = replaceId ?? weekId(review);
    const week: SavedWeek = { id, savedAt: new Date().toISOString(), files: fileNames, source, review };
    commit(upsertWeek(history, week));
    if (docs) setDocsById((m) => ({ ...m, [id]: docs }));
    setActiveId(id);
  }

  async function analyzeLocally() {
    if (!files.length) return;
    setState({ kind: "reading" });
    try {
      const docs = await Promise.all(files.map(readDoc));
      const review = buildLocalReview(docs);
      saveReview(review, "local", files.map((f) => f.name), docs);
      setFiles([]);
      setState({ kind: "idle" });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Не вдалося прочитати файли." });
    }
  }

  async function analyzeViaApi(week: SavedWeek, docs: Doc[]) {
    setState({ kind: "api" });
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documents: docs, knownKpis: knownKpiNames(history.filter((w) => w.id !== week.id)) }),
      });
      const data = (await res.json().catch(() => ({}))) as { result?: Review; error?: string };
      if (!res.ok || !data.result) {
        setState({ kind: "error", message: data.error ?? `Помилка сервера (${res.status}).` });
        return;
      }
      saveReview(data.result, "claude", week.files, docs, week.id);
      setState({ kind: "idle" });
    } catch {
      setState({ kind: "error", message: "Немає зв'язку з сервером." });
    }
  }

  async function importHistory(file: File) {
    try {
      const weeks = parseImport(await file.text());
      const merged = weeks.reduce((acc, w) => upsertWeek(acc, w), history);
      commit(merged);
      setActiveId(merged.at(-1)?.id ?? null);
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : "Не вдалося імпортувати історію." });
    }
  }

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`flex min-w-0 flex-col gap-5 rounded-2xl border-2 border-dashed p-6 transition-colors md:p-8 ${over ? "border-accent bg-surface-2" : "border-line bg-surface"}`}
        >
          <div className="max-w-[58ch]">
            <h1 className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">Тижневий огляд за звітами відділів</h1>
            <p className="mt-2 leading-relaxed text-ink-2">
              Перетягніть усі звіти за тиждень: маркетинг, продажі, МУП, фінанси, рев&apos;ю. Аналіз безкоштовний і відбувається у вашому браузері, файли нікуди не надсилаються.
            </p>
          </div>

          {files.length > 0 && (
            <ul className="grid gap-2">
              {files.map((f) => (
                <li key={f.name} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-ink">{f.name}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                    {Math.max(1, Math.round(f.size / 1024))} КБ
                    <button type="button" onClick={() => setFiles((p) => p.filter((x) => x !== f))} aria-label={`Прибрати ${f.name}`} className="rounded p-1 hover:bg-surface hover:text-ink" disabled={busy}>
                      <X size={14} />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-3">
            <Button variant={files.length ? "ghost" : "primary"} onClick={() => input.current?.click()} disabled={busy}>
              <FileArrowUp size={18} /> {files.length ? "Додати ще" : "Обрати звіти"}
            </Button>
            {files.length > 0 && (
              <Button onClick={analyzeLocally} disabled={busy}>
                <Lightning size={18} /> {state.kind === "reading" ? "Читаю звіти..." : "Проаналізувати тиждень"}
              </Button>
            )}
          </div>
          <input ref={input} type="file" multiple accept={DOC_ACCEPT} className="hidden" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />

          {state.kind === "error" && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-bad-bg px-4 py-3 text-sm text-bad">
              <WarningCircle size={18} className="mt-0.5 shrink-0" aria-hidden /> {state.message}
            </p>
          )}
          <p className="text-xs text-muted">Формати: .docx, .xlsx, .txt, .csv. Історія оглядів зберігається лише в цьому браузері; для перенесення є експорт.</p>
        </div>

        <Panel
          title="Історія тижнів"
          action={
            <div className="flex gap-2">
              <Button variant="ghost" className="px-3 py-1.5" onClick={() => importInput.current?.click()} title="Імпорт історії з JSON">
                <UploadSimple size={16} /> Імпорт
              </Button>
              {history.length > 0 && (
                <Button variant="ghost" className="px-3 py-1.5" onClick={() => download("istoriia-tyzhniv.json", JSON.stringify(history, null, 2), "application/json")} title="Експорт історії в JSON">
                  <DownloadSimple size={16} /> Експорт
                </Button>
              )}
            </div>
          }
        >
          <input ref={importInput} type="file" accept=".json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importHistory(f); e.target.value = ""; }} />
          {history.length === 0 ? (
            <p className="text-sm text-ink-2">Тут з&apos;являться проаналізовані тижні. Від трьох тижнів додаток будує тренди й прогнози по відділах і KPI.</p>
          ) : (
            <ul className="grid gap-1">
              {[...history].reverse().map((w) => (
                <li key={w.id} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveId(w.id)}
                    aria-current={w.id === activeId}
                    className={`min-w-0 flex-1 rounded-xl px-3 py-2 text-left text-sm transition-colors ${w.id === activeId ? "bg-surface-2 text-ink" : "text-ink-2 hover:bg-surface-2"}`}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <span className="truncate">{w.review.period.label}</span>
                      {w.source === "claude" && <Sparkle size={12} weight="fill" className="shrink-0 text-accent" aria-label="Аналіз Claude" />}
                    </span>
                    <span className="block truncate text-xs text-muted">{w.review.departments.map((d) => `${d.name} ${d.score}`).join(", ")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm(`Видалити огляд за ${w.review.period.label}?`)) return;
                      const next = history.filter((x) => x.id !== w.id);
                      commit(next);
                      if (activeId === w.id) setActiveId(next.at(-1)?.id ?? null);
                    }}
                    aria-label={`Видалити ${w.review.period.label}`}
                    className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-bad"
                  >
                    <Trash size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <TemplatesPanel defaultOpen={history.length === 0} />

      {history.length >= 2 && <HistoryTrends history={history} />}

      {state.kind === "api" && (
        <div className="rounded-2xl border border-line bg-surface p-6" aria-busy="true">
          <div className="skeleton h-4 w-40" />
          <div className="skeleton mt-4 h-7 w-3/4" />
          <div className="skeleton mt-3 h-4 w-full" />
          <p className="mt-4 text-sm text-ink-2">Claude читає звіти. Зазвичай це 30-90 секунд.</p>
        </div>
      )}

      {active && state.kind !== "api" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="inline-flex flex-wrap items-center gap-2 text-sm text-ink-2">
              {active.source === "claude" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink">
                  <Sparkle size={12} weight="fill" className="text-accent" aria-hidden /> Аналіз Claude
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-ink">
                  <Cpu size={12} aria-hidden /> Локальний аналіз за правилами
                </span>
              )}
              Файли: {active.files.join(", ")}
            </p>
            <Button variant="ghost" onClick={() => download(`ohliad-${active.id}.md`, reviewToMarkdown(active.review), "text/markdown;charset=utf-8")}>
              <DownloadSimple size={16} /> Огляд .md
            </Button>
          </div>
          <ReviewView review={active.review} />

          <Panel
            title={
              <span className="inline-flex items-center gap-2">
                <Sparkle size={18} weight="fill" className="text-accent" aria-hidden /> Глибший аналіз у Claude
              </span>
            }
            action={
              apiEnabled && activeDocs ? (
                <Button variant="ghost" onClick={() => analyzeViaApi(active, activeDocs)}>
                  <Sparkle size={16} /> Через API
                </Button>
              ) : undefined
            }
          >
            {activeDocs ? (
              <ClaudeHandoff
                schema={ReviewSchema}
                buildPrompt={() =>
                  chatPrompt(
                    REVIEW_SYSTEM,
                    ReviewSchema,
                    `Підготуй тижневий огляд за цими звітами.${kpiHint(knownKpiNames(history.filter((w) => w.id !== active.id)))}\n\n${documentsBlock(activeDocs)}`,
                  )
                }
                onResult={(review) => saveReview(review, "claude", active.files, activeDocs, active.id)}
              />
            ) : (
              <p className="text-sm text-ink-2">
                Claude оцінить звіти глибше: причини, якість маркетингових кампаній, точніші оцінки відділів. Щоб скласти запит, завантажте файли цього тижня ще раз і натисніть &quot;Проаналізувати тиждень&quot;.
              </p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}
