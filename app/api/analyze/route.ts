import { askStructured, guard } from "@/lib/claude";
import { InsightsSchema } from "@/lib/insights";
import { INSIGHTS_SYSTEM } from "@/lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_PAYLOAD_CHARS = 400_000;

export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;

  let payload: string;
  try {
    const body = (await req.json()) as { analysis?: unknown };
    if (!body.analysis || typeof body.analysis !== "object") throw new Error("missing");
    payload = JSON.stringify(body.analysis);
  } catch {
    return Response.json({ error: "Некоректний запит." }, { status: 400 });
  }
  if (payload.length > MAX_PAYLOAD_CHARS) {
    return Response.json({ error: "Забагато даних для одного аналізу. Відфільтруйте файл." }, { status: 413 });
  }

  return askStructured(
    InsightsSchema,
    INSIGHTS_SYSTEM,
    `Проаналізуй тижневі звіти команди і дай висновки за схемою.\n\n<weekly_data>\n${payload}\n</weekly_data>`,
  );
}
