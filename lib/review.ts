import { z } from "zod";

export const ReviewSchema = z.object({
  period: z.object({
    label: z.string().describe("Звітний період, як у звітах, напр. '19.10 - 25.10.2026'."),
    start: z.string().nullable().describe("Перший день тижня YYYY-MM-DD або null."),
    end: z.string().nullable().describe("Останній день тижня YYYY-MM-DD або null."),
  }),
  branch: z.string().nullable().describe("Філія або підрозділ, якщо вказано."),
  headline: z.string().describe("Один рядок: головне про тиждень."),
  summary: z.string().describe("3-5 речень для директора."),
  departments: z.array(
    z.object({
      name: z.string().describe("Маркетинг, Продажі, Навчальна частина, Фінансовий відділ, Адміністрація або інша назва зі звіту."),
      status: z.enum(["good", "watch", "critical"]),
      score: z.number().int().describe("Оцінка роботи відділу за тиждень 0-100 за шкалою з інструкції."),
      score_reason: z.string().describe("Чому така оцінка, одним реченням."),
      achievements: z.array(z.string()),
      problems: z.array(z.string()),
      plans: z.array(z.string()),
      kpis: z.array(
        z.object({
          name: z.string().describe("Коротка стабільна назва показника."),
          value: z.number().nullable(),
          unit: z.string().describe("$, грн, %, шт, год тощо; порожній рядок, якщо без одиниць."),
          higher_is_better: z.boolean(),
        }),
      ),
    }),
  ),
  student_losses: z
    .array(z.object({ reason: z.string(), count: z.number().int(), recoverable: z.boolean() }))
    .describe("Втрати студентів за причинами, без імен."),
  cross_cutting: z.array(z.string()).describe("Спільні причини, що зачіпають кілька відділів."),
  risks: z.array(
    z.object({
      title: z.string(),
      detail: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      department: z.string(),
    }),
  ),
  data_quality: z.array(z.string()).describe("Невідповідності між звітами, різні періоди, відсутні дані, звіти, яких бракує."),
  actions: z.array(
    z.object({
      action: z.string(),
      owner: z.string().describe("Відділ або роль."),
      priority: z.enum(["high", "medium", "low"]),
    }),
  ),
  questions: z.array(z.string()).describe("Запитання, які директору варто поставити командам."),
});

export type Review = z.infer<typeof ReviewSchema>;
