import { z } from "zod";

export const InsightsSchema = z.object({
  headline: z.string().describe("Один рядок: головний висновок тижня."),
  summary: z.string().describe("3-5 речень про стан команди цього тижня порівняно з попереднім і трендом."),
  highlights: z.array(z.string()).describe("Що пішло добре, з конкретними цифрами."),
  risks: z
    .array(
      z.object({
        title: z.string(),
        detail: z.string(),
        severity: z.enum(["low", "medium", "high"]),
      }),
    )
    .describe("Ризики й проблеми, відсортовані від найважливішого."),
  people: z
    .array(
      z.object({
        name: z.string(),
        status: z.enum(["leader", "stable", "attention"]),
        assessment: z.string().describe("1-2 речення з цифрами."),
        recommendation: z.string().describe("Одна конкретна дія для керівника."),
      }),
    )
    .describe("Оцінка кожної людини з поточного тижня."),
  report_themes: z.array(z.string()).describe("Повторювані теми з текстових коментарів у звітах. Порожньо, якщо коментарів немає."),
  forecast_comment: z.string().describe("Що чекати наступного тижня і наскільки можна довіряти прогнозу."),
  actions: z.array(z.string()).describe("3-6 пріоритетних дій на наступний тиждень."),
});

export type Insights = z.infer<typeof InsightsSchema>;
