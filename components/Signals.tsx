import { CheckCircle, UserMinus, WarningCircle } from "@phosphor-icons/react";
import type { Analysis } from "@/lib/ml";
import { fmt } from "@/lib/format";
import { Panel } from "./ui";

export function Signals({ analysis }: { analysis: Analysis }) {
  const { anomalies, missingReports } = analysis;
  const empty = anomalies.length === 0 && missingReports.length === 0;

  return (
    <Panel title="Сигнали тижня">
      {empty && (
        <p className="flex items-center gap-2 text-sm text-ink-2">
          <CheckCircle size={18} className="text-good" aria-hidden />
          {analysis.weeks.length < 4
            ? "Для пошуку аномалій потрібно щонайменше 4 тижні історії."
            : "Різких відхилень від звичної роботи не знайдено."}
        </p>
      )}

      {missingReports.length > 0 && (
        <div className="mb-4 flex gap-3 rounded-xl bg-warn-bg p-3 text-sm">
          <UserMinus size={18} className="mt-0.5 shrink-0 text-warn" aria-hidden />
          <div>
            <p className="font-medium text-ink">Немає звіту цього тижня</p>
            <p className="text-ink-2">{missingReports.join(", ")}</p>
          </div>
        </div>
      )}

      {anomalies.length > 0 && (
        <ul className="grid gap-3">
          {anomalies.slice(0, 8).map((a, i) => (
            <li key={i} className="flex gap-3 text-sm">
              {a.good ? (
                <CheckCircle size={18} className="mt-0.5 shrink-0 text-good" aria-label="Позитивне відхилення" />
              ) : (
                <WarningCircle size={18} className="mt-0.5 shrink-0 text-bad" aria-label="Негативне відхилення" />
              )}
              <div className="min-w-0">
                <p className="text-ink">
                  <span className="font-medium">{a.name}</span>: {a.metric.toLowerCase()} {fmt(a.value)}
                </p>
                <p className="tabular text-ink-2">
                  Зазвичай близько {fmt(a.expected)}, відхилення {a.z > 0 ? "+" : ""}
                  {fmt(a.z)} σ
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      {anomalies.length > 0 && (
        <p className="mt-4 text-xs text-muted">Порівняння з власною історією людини (медіана і MAD), поріг |z| ≥ 2,5.</p>
      )}
    </Panel>
  );
}
