import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runOraclePipelineInsert } from "@/lib/server/oraclePipeline";
import { requireAdminSession } from "@/lib/server/requireAdminSession";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

/** POST `{ newsId }` or `{ generatedArticleId }` — admin-only fresh Oracle run (new DB row). */
export async function POST(req: NextRequest) {
  try {
    const admin = getAdminClient();
    const gate = await requireAdminSession(admin, req);
    if ("response" in gate) return gate.response;

    const body = (await req.json()) as { newsId?: string; generatedArticleId?: string };
    const newsId = body.newsId?.trim();
    const generatedArticleId = body.generatedArticleId?.trim();
    if ((!newsId && !generatedArticleId) || (Boolean(newsId) && Boolean(generatedArticleId))) {
      return NextResponse.json({ error: "provide exactly one of newsId or generatedArticleId" }, { status: 400 });
    }

    const result = await runOraclePipelineInsert(admin, { newsId, generatedArticleId });
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, message: result.message },
        { status: result.status },
      );
    }
    return NextResponse.json(result.inserted);
  } catch (e) {
    console.error("[admin/oracle-rerun]", e);
    return NextResponse.json(
      { error: "oracle_rerun_failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
