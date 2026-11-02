import { CaretDown, FileDoc } from "@phosphor-icons/react";

// Файли генерує scripts/make-templates.mjs (npm run templates) у public/templates.
const TEMPLATES = [
  { file: "Шаблон - Маркетинг.docx", title: "Маркетинг", note: "Meta і Google Ads по Академії та Школі" },
  { file: "Шаблон - Продажі.docx", title: "Продажі", note: "Контакти, заявки, договори, час на лінії, заходи" },
  { file: "Шаблон - Навчальна частина.docx", title: "Навчальна частина (МУП)", note: "Втрати за причинами без імен, відпрацювання, скарги" },
  { file: "Шаблон - Фінансовий відділ.docx", title: "Фінансовий відділ", note: "Боржники, заборгованість, надходження" },
  { file: "Шаблон - Тижневе рев'ю філії.docx", title: "Тижневе рев'ю філії", note: "Аналіз тижня, колектив, ЦУП, плани директора" },
];

export function TemplatesPanel({ defaultOpen }: { defaultOpen: boolean }) {
  return (
    <details className="group rounded-2xl border border-line bg-surface p-5 md:p-6" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 marker:hidden">
        <span>
          <span className="text-base font-semibold tracking-tight text-ink">Шаблони звітів</span>
          <span className="ml-2 text-sm text-ink-2">Заповнені за шаблоном звіти читаються без помилок і порівнюються між тижнями.</span>
        </span>
        <CaretDown size={18} className="shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <ul className="grid gap-2 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <li key={t.file}>
              <a
                href={`/templates/${encodeURIComponent(t.file)}`}
                download={t.file}
                className="flex h-full items-start gap-3 rounded-xl border border-line p-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <FileDoc size={28} weight="light" className="shrink-0 text-accent" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">{t.title}</span>
                  <span className="block text-xs text-ink-2">{t.note}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>

        <div className="text-sm text-ink-2">
          <p className="mb-2 font-medium text-ink">Як заповнювати</p>
          <ul className="grid list-disc gap-1.5 pl-5 marker:text-muted">
            <li>Кожен відділ заповнює свій шаблон щотижня, директор заповнює рев&apos;ю.</li>
            <li>У шапці вкажіть філію і період: 26.10.2026 - 01.11.2026.</li>
            <li>Числа пишіть лише в колонку Значення: 1 115 або 40,01; час на лінії як 1:34.</li>
            <li>Назви показників не змінюйте, інакше тренди між тижнями не зійдуться. Свій показник можна додати новим рядком.</li>
            <li>Порожні рядки таблиці пропускаються, це не помилка.</li>
            <li>Підказки в [квадратних дужках] замініть своїм текстом або видаліть.</li>
            <li>Втрати студентів вносьте кількістю за причинами, без імен.</li>
          </ul>
          <p className="mt-3 text-xs text-muted">Звіти у старому вільному форматі теж читаються, але цифри з них витягуються менш точно.</p>
        </div>
      </div>
    </details>
  );
}
