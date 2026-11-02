"use client";

import { useState } from "react";
import { ArrowSquareOut, Check, Copy, WarningCircle } from "@phosphor-icons/react";
import type { z } from "zod";
import { parseChatAnswer } from "@/lib/prompts";
import { Button } from "./ui";

/**
 * Аналіз у Claude через звичайну підписку claude.ai, без API-ключа:
 * копіюємо готовий запит, користувач вставляє відповідь назад.
 */
export function ClaudeHandoff<T>({ buildPrompt, schema, onResult }: { buildPrompt: () => string; schema: z.ZodType<T>; onResult: (value: T) => void }) {
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    const prompt = buildPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setFallback(null);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Буфер обміну недоступний: показуємо текст для ручного копіювання.
      setFallback(prompt);
    }
  }

  function apply() {
    const res = parseChatAnswer(answer, schema);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    setAnswer("");
    onResult(res.value);
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="grid content-start gap-3">
        <p className="text-sm font-semibold text-ink">1. Скопіюйте запит і вставте в Claude</p>
        <p className="text-sm text-ink-2">Запит уже містить інструкції, формат відповіді і текст звітів. Працює зі звичайною підпискою, API-ключ не потрібен.</p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={copy}>
            {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? "Скопійовано" : "Скопіювати запит"}
          </Button>
          <a
            href="https://claude.ai/new"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-surface-2"
          >
            <ArrowSquareOut size={16} /> Відкрити claude.ai
          </a>
        </div>
        {fallback && (
          <textarea
            readOnly
            value={fallback}
            onFocus={(e) => e.currentTarget.select()}
            aria-label="Текст запиту для копіювання"
            className="h-32 rounded-xl border border-line bg-surface-2 p-3 font-mono text-xs text-ink-2"
          />
        )}
      </div>
      <div className="grid content-start gap-3">
        <label htmlFor="claude-answer" className="text-sm font-semibold text-ink">
          2. Вставте відповідь Claude
        </label>
        <textarea
          id="claude-answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder='{"period": ...}'
          className="h-32 rounded-xl border border-line bg-surface p-3 font-mono text-xs text-ink placeholder:text-muted focus-visible:outline-2 focus-visible:outline-accent"
        />
        <div>
          <Button onClick={apply} disabled={!answer.trim()}>
            Застосувати відповідь
          </Button>
        </div>
        {error && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-bad-bg px-3 py-2 text-sm text-bad">
            <WarningCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
          </p>
        )}
      </div>
    </div>
  );
}
