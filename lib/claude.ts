import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

// Необов'язковий шлях: працює, лише якщо на сервері задано ANTHROPIC_API_KEY.
// Без ключа додаток аналізує локально і пропонує Claude через підписку claude.ai.
export const MODEL = "claude-opus-5-5";

export const apiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

export function guard(req: Request): Response | null {
  const password = process.env.APP_PASSWORD;
  if (password && req.headers.get("x-app-password") !== password) {
    return Response.json({ error: "Потрібен пароль доступу.", code: "auth" }, { status: 401 });
  }
  if (!apiEnabled()) {
    return Response.json({ error: "Аналіз через API вимкнено: на сервері не задано ANTHROPIC_API_KEY." }, { status: 503 });
  }
  return null;
}

/**
 * Структурований запит до Claude. Серверний fallback ("default") повторює запит на іншій моделі,
 * якщо класифікатори безпеки помилково відхилять звіт.
 */
export async function askStructured<S extends z.ZodType>(schema: S, system: string, user: string): Promise<Response> {
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system,
      output_config: { effort: "medium", format: betaZodOutputFormat(schema) },
      messages: [{ role: "user", content: user }],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "Модель відмовилась аналізувати ці дані." }, { status: 422 });
    }
    if (response.stop_reason === "max_tokens" || !response.parsed_output) {
      return Response.json({ error: "Відповідь моделі обірвалась. Спробуйте ще раз або зменшіть обсяг даних." }, { status: 502 });
    }
    return Response.json({
      result: response.parsed_output,
      model: response.model,
      usage: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    });
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "Ключ ANTHROPIC_API_KEY на сервері недійсний." }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "Перевищено ліміт запитів до Claude. Спробуйте за хвилину." }, { status: 429 });
    }
    if (error instanceof Anthropic.BadRequestError) {
      return Response.json({ error: `Claude API відхилив запит: ${error.message}` }, { status: 400 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: `Помилка Claude API (${error.status ?? "мережа"}).` }, { status: 502 });
    }
    console.error(error);
    return Response.json({ error: "Внутрішня помилка сервера." }, { status: 500 });
  }
}
