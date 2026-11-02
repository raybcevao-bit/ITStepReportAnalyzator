import { CheckCircle, Question, Warning, WarningCircle } from "@phosphor-icons/react";
import type { Review } from "@/lib/review";
import { fmt } from "@/lib/format";
import { Panel } from "./ui";

export const DEPT_STATUS: Record<Review["departments"][number]["status"], { label: string; tone: string }> = {
  good: { label: "Добре", tone: "bg-good-bg text-good" },
  watch: { label: "Під контролем", tone: "bg-warn-bg text-warn" },
  critical: { label: "Критично", tone: "bg-bad-bg text-bad" },
};

const SEVERITY: Record<"low" | "medium" | "high", { label: string; tone: string }> = {
  high: { label: "Високий", tone: "bg-bad-bg text-bad" },
  medium: { label: "Середній", tone: "bg-warn-bg text-warn" },
  low: { label: "Низький", tone: "bg-surface-2 text-ink-2" },
};

function List({ items, tone }: { items: string[]; tone: string }) {
  if (!items.length) return <p className="text-sm text-muted">Немає даних у звітах.</p>;
  return (
    <ul className="grid gap-1.5 text-sm text-ink-2">
      {items.map((x, i) => (
        <li key={i} className={`border-l-2 pl-3 ${tone}`}>
          {x}
        </li>
      ))}
    </ul>
  );
}

export function ReviewView({ review }: { review: Review }) {
  return (
    <div className="grid gap-5">
      <Panel>
        <p className="text-sm text-ink-2">
          {review.period.label}
          {review.branch && `, ${review.branch}`}
        </p>
        <p className="mt-2 max-w-[80ch] text-2xl font-semibold leading-snug tracking-tight text-ink">{review.headline}</p>
        <p className="mt-3 max-w-[80ch] leading-relaxed text-ink-2">{review.summary}</p>
      </Panel>

      <div className="grid gap-5 md:grid-cols-2">
        {review.departments.map((d) => (
          <Panel
            key={d.name}
            title={d.name}
            action={
              <span className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${DEPT_STATUS[d.status].tone}`}>{DEPT_STATUS[d.status].label}</span>
                <span className="tabular text-2xl font-semibold text-ink" aria-label={`Оцінка ${d.score} зі 100`}>
                  {d.score}
                </span>
              </span>
            }
          >
            <p className="-mt-2 mb-4 text-sm text-muted">{d.score_reason}</p>
            {d.kpis.length > 0 && (
              <div className="mb-5 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                {d.kpis.map((k) => (
                  <div key={k.name} className="min-w-0">
                    <p className="truncate text-xs text-ink-2" title={k.name}>
                      {k.name}
                    </p>
                    <p className="tabular text-lg font-semibold text-ink">
                      {fmt(k.value)}
                      {k.unit && <span className="ml-1 text-sm font-normal text-ink-2">{k.unit}</span>}
                    </p>
                  </div>
                ))}
              </div>
            )}
            <div className="grid gap-4">
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">Досягнення</h3>
                <List items={d.achievements} tone="border-good" />
              </div>
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">Проблеми</h3>
                <List items={d.problems} tone="border-bad" />
              </div>
              {d.plans.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-ink">Плани</h3>
                  <List items={d.plans} tone="border-line" />
                </div>
              )}
            </div>
          </Panel>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel title="Пріоритетні дії">
          <ol className="grid gap-3">
            {review.actions.map((a, i) => (
              <li key={i} className="grid grid-cols-[auto_1fr] gap-3 text-sm">
                <span className="tabular mt-0.5 text-muted">{i + 1}.</span>
                <div>
                  <p className="text-ink">{a.action}</p>
                  <p className="mt-0.5 text-xs text-ink-2">
                    {a.owner}
                    <span className={`ml-2 rounded-full px-2 py-0.5 ${SEVERITY[a.priority].tone}`}>{SEVERITY[a.priority].label}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title="Ризики">
          <ul className="grid gap-3 text-sm">
            {review.risks.map((r, i) => (
              <li key={i} className="flex gap-3">
                <Warning size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
                <div>
                  <p className="font-medium text-ink">
                    {r.title} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-normal ${SEVERITY[r.severity].tone}`}>{SEVERITY[r.severity].label}</span>
                  </p>
                  <p className="text-ink-2">{r.detail}</p>
                  <p className="text-xs text-muted">{r.department}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Спільні причини">
          <List items={review.cross_cutting} tone="border-accent" />
        </Panel>
        <Panel title="Втрати студентів">
          {review.student_losses.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-ink-2">
              <CheckCircle size={18} className="text-good" aria-hidden /> Втрат у звітах не зазначено.
            </p>
          ) : (
            <ul className="grid gap-2 text-sm">
              {review.student_losses.map((l, i) => (
                <li key={i} className="flex items-start justify-between gap-3">
                  <span className="text-ink-2">
                    {l.reason}
                    {l.recoverable && <span className="ml-2 rounded-full bg-good-bg px-2 py-0.5 text-xs text-good">можна повернути</span>}
                  </span>
                  <span className="tabular font-semibold text-ink">{l.count}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Якість даних">
          {review.data_quality.length === 0 ? (
            <p className="text-sm text-ink-2">Розбіжностей не знайдено.</p>
          ) : (
            <ul className="grid gap-2 text-sm text-ink-2">
              {review.data_quality.map((q, i) => (
                <li key={i} className="flex gap-2">
                  <WarningCircle size={16} className="mt-0.5 shrink-0 text-warn" aria-hidden />
                  {q}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {review.questions.length > 0 && (
        <Panel title="Запитання до команд">
          <ul className="grid gap-2 text-sm text-ink-2 md:grid-cols-2">
            {review.questions.map((q, i) => (
              <li key={i} className="flex gap-2">
                <Question size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                {q}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <p className="text-xs text-muted">Огляд згенеровано Claude за текстом звітів. Перевіряйте цифри перед важливими рішеннями.</p>
    </div>
  );
}

export function reviewToMarkdown(r: Review): string {
  const lines = [
    `# Тижневий огляд: ${r.period.label}${r.branch ? `, ${r.branch}` : ""}`,
    "",
    `**${r.headline}**`,
    "",
    r.summary,
    "",
  ];
  for (const d of r.departments) {
    lines.push(`## ${d.name}: ${d.score}/100 (${DEPT_STATUS[d.status].label.toLowerCase()})`, "", d.score_reason, "");
    if (d.kpis.length) lines.push(...d.kpis.map((k) => `- ${k.name}: ${k.value ?? "-"} ${k.unit}`.trim()), "");
    if (d.achievements.length) lines.push("**Досягнення**", ...d.achievements.map((x) => `- ${x}`), "");
    if (d.problems.length) lines.push("**Проблеми**", ...d.problems.map((x) => `- ${x}`), "");
    if (d.plans.length) lines.push("**Плани**", ...d.plans.map((x) => `- ${x}`), "");
  }
  lines.push("## Пріоритетні дії", ...r.actions.map((a, i) => `${i + 1}. ${a.action} (${a.owner}, ${SEVERITY[a.priority].label.toLowerCase()})`), "");
  lines.push("## Ризики", ...r.risks.map((x) => `- **${x.title}** (${SEVERITY[x.severity].label.toLowerCase()}): ${x.detail}`), "");
  if (r.cross_cutting.length) lines.push("## Спільні причини", ...r.cross_cutting.map((x) => `- ${x}`), "");
  if (r.student_losses.length) lines.push("## Втрати студентів", ...r.student_losses.map((l) => `- ${l.reason}: ${l.count}`), "");
  if (r.data_quality.length) lines.push("## Якість даних", ...r.data_quality.map((x) => `- ${x}`), "");
  if (r.questions.length) lines.push("## Запитання до команд", ...r.questions.map((x) => `- ${x}`), "");
  return lines.join("\n");
}
