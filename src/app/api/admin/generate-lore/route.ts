import { NextRequest, NextResponse } from "next/server";
import { runLoreDossierCore } from "@/lib/server/generateArticleCore";

export const maxDuration = 120;

/**
 * POST /api/admin/generate-lore
 * Body: { topic: string; angle?: string; seedUrls?: string[] }
 * No extra auth — same trust model as other /api/admin/* routes (admin page only).
 */
export async function POST(req: NextRequest) {

  let body: { topic?: string; angle?: string; seedUrls?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const topic = String(body.topic ?? "").trim();
  if (!topic) return NextResponse.json({ error: "topic is required" }, { status: 400 });

  const seedUrls = (body.seedUrls ?? []).filter((u) => typeof u === "string" && u.startsWith("http"));

  const { status, payload } = await runLoreDossierCore({
    topic,
    angle: body.angle ? String(body.angle).trim() : undefined,
    seedUrls,
  });

  return NextResponse.json(payload, { status });
}
