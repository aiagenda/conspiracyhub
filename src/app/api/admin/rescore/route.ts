import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";
import { SYSTEM_SCORE } from "@/lib/prompts";
import { requireAdminSession } from "@/lib/server/requireAdminSession";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

/**
 * POST `{ newsId }` — re-scores an existing news_item with fresh OpenAI call.
 * Updates `score` and `angle` on the row. Does NOT touch oracle_analyses.
 * Admin + signed-in required.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "openai_missing", message: "OPENAI_API_KEY is not configured." },
        { status: 503 },
      );
    }

    const admin = getAdminClient();
    const gate = await requireAdminSession(admin, req);
    if ("response" in gate) return gate.response;

    const body = (await req.json()) as { newsId?: string };
    const newsId = body.newsId?.trim();
    if (!newsId) {
      return NextResponse.json({ error: "newsId required" }, { status: 400 });
    }

    const { data: article, error: fetchErr } = await admin
      .from("news_items")
      .select("id, title, summary, section")
      .eq("id", newsId)
      .single();

    if (fetchErr || !article) {
      return NextResponse.json({ error: fetchErr?.message ?? "article not found" }, { status: 404 });
    }

    const headline = `0: ${article.title}`;
    const scored = await callOpenAIJSON<{ scores: Array<{ index: number; score: number; angle: string }> }>({
      apiKey: process.env.OPENAI_API_KEY!,
      system: SYSTEM_SCORE,
      user: `Score these headlines:\n${headline}`,
      maxTokens: 200,
      model: "gpt-4o-mini",
    });

    const result = scored.scores?.[0];
    if (!result) {
      return NextResponse.json({ error: "no_score", message: "Model returned no score." }, { status: 422 });
    }

    const { error: updateErr } = await admin
      .from("news_items")
      .update({ score: result.score, angle: result.angle })
      .eq("id", newsId);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, score: result.score, angle: result.angle });
  } catch (e) {
    console.error("[admin/rescore]", e);
    return NextResponse.json(
      { error: "rescore_failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
