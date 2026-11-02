"use client";

import { useRef, useState } from "react";
import { FileArrowUp, Flask } from "@phosphor-icons/react";
import { Button } from "./ui";

const EXAMPLE = [
  ["Дата", "Співробітник", "Дзвінки", "Продажі", "Скарги", "Коментар"],
  ["31.10.2026", "Олена Гринчук", "126", "11", "0", "Закрила 2 корпоративні угоди"],
  ["31.10.2026", "Тарас Мельник", "98", "7", "1", "CRM гальмувала у вівторок"],
];

export function Dropzone({ onFile, onSample, error }: { onFile: (f: File) => void; onSample: () => void; error: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        className={`flex min-h-[340px] flex-col justify-center gap-6 rounded-2xl border-2 border-dashed p-8 transition-colors md:p-12 ${
          over ? "border-accent bg-surface-2" : "border-line bg-surface"
        }`}
      >
        <FileArrowUp size={40} weight="light" className="text-accent" />
        <div className="max-w-[48ch]">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">Аналіз тижневих звітів команди</h1>
          <p className="mt-3 text-ink-2 leading-relaxed">
            Завантажте CSV або Excel зі звітами. Бал продуктивності, тренди, прогноз і аномалії рахуються у вашому браузері, висновки пише Claude.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={() => input.current?.click()}>
            <FileArrowUp size={18} /> Обрати файл
          </Button>
          <Button variant="ghost" onClick={onSample}>
            <Flask size={18} /> Демо-дані
          </Button>
        </div>
        <input
          ref={input}
          type="file"
          accept=".csv,.tsv,.txt,.xlsx"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        {error && (
          <p role="alert" className="rounded-xl bg-bad-bg px-4 py-3 text-sm text-bad">
            {error}
          </p>
        )}
      </div>

      <div className="min-w-0">
        <p className="mb-3 text-sm text-ink-2">Очікуваний формат: один рядок на людину за звіт. Назви колонок можуть бути будь-якими, їх можна перевибрати після завантаження.</p>
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-line text-ink-2">
                {EXAMPLE[0].map((h) => (
                  <th key={h} className="whitespace-nowrap px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="text-ink">
              {EXAMPLE.slice(1).map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className="tabular whitespace-nowrap px-3 py-2">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-4 grid gap-2 text-sm text-ink-2">
          <li><span className="font-medium text-ink">Дата</span> звіту: дні групуються в тижні (пн-нд).</li>
          <li><span className="font-medium text-ink">Виконавець</span>: співробітник, викладач, філія.</li>
          <li><span className="font-medium text-ink">Числові колонки</span> стають метриками; скарги й помилки рахуються як "менше = краще".</li>
          <li><span className="font-medium text-ink">Текстовий коментар</span> необов'язковий, Claude знайде в ньому повторювані теми.</li>
        </ul>
      </div>
    </div>
  );
}
