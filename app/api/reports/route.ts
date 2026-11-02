import { askStructured, guard } from "@/lib/claude";
import { documentsBlock, kpiHint, REVIEW_SYSTEM } from "@/lib/prompts";
import { ReviewSchema } from "@/lib/review";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_TOTAL_CHARS = 300_000;

export async function POST(req: Request) {
  const blocked = guard(req);
  if (blocked) return blocked;

  let documents: { name: string; text: string }[];
  let knownKpis: string[];
  try {
    const body = (await req.json()) as { documents?: unknown; knownKpis?: unknown };
    if (!Array.isArray(body.documents)) throw new Error("documents");
    documents = body.documents
      .filter((d): d is { name: string; text: string } => !!d && typeof d === "object" && typeof d.name === "string" && typeof d.text === "string")
      .slice(0, 20);
    knownKpis = Array.isArray(body.knownKpis) ? body.knownKpis.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return Response.json({ error: "Некоректний запит." }, { status: 400 });
  }
  if (!documents.length) return Response.json({ error: "Додайте хоча б один звіт." }, { status: 400 });

  const docs = documentsBlock(documents);
  if (docs.length > MAX_TOTAL_CHARS) {
    return Response.json({ error: "Звіти завеликі для одного аналізу. Розділіть тиждень на частини." }, { status: 413 });
  }

  return askStructured(ReviewSchema, REVIEW_SYSTEM, `Підготуй тижневий огляд за цими звітами.${kpiHint(knownKpis)}\n\n${docs}`);
}
