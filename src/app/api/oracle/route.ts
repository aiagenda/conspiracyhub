import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runOraclePipelineInsert } from "@/lib/server/oraclePipeline";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "oracle_config", message: "OPENAI_API_KEY is not configured on the server." },
        { status: 503 },
      );
    }

    const admin = getAdminClient();
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return NextResponse.json({ error: "missing_token" }, { status: 401 });
    const token = auth.replace("Bearer ", "");

    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(token);
    if (userErr || !user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

    const body = (await req.json()) as { newsId?: string; generatedArticleId?: string };
    const newsId = body.newsId?.trim();
    const generatedArticleId = body.generatedArticleId?.trim();
    if ((!newsId && !generatedArticleId) || (Boolean(newsId) && Boolean(generatedArticleId))) {
      return NextResponse.json({ error: "provide exactly one of newsId or generatedArticleId" }, { status: 400 });
    }

    if (newsId) {
      const { data: cached } = await admin
        .from("oracle_analyses")
        .select("*")
        .eq("news_id", newsId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cached) return NextResponse.json(cached);

      const { data: profile } = await admin.from("user_profiles").select("plan").eq("id", user.id).single();
      if (profile?.plan !== "pro") return NextResponse.json({ error: "upgrade_required" }, { status: 403 });

      const result = await runOraclePipelineInsert(admin, { newsId });
      if (!result.ok) {
        return NextResponse.json({ error: result.error, message: result.message }, { status: result.status });
      }
      return NextResponse.json(result.inserted);
    }

    const { data: cached } = await admin
      .from("oracle_analyses")
      .select("*")
      .eq("generated_article_id", generatedArticleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (cached) return NextResponse.json(cached);

    const { data: profile } = await admin.from("user_profiles").select("plan").eq("id", user.id).single();
    if (profile?.plan !== "pro") return NextResponse.json({ error: "upgrade_required" }, { status: 403 });

    const result = await runOraclePipelineInsert(admin, { generatedArticleId });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, message: result.message }, { status: result.status });
    }
    return NextResponse.json(result.inserted);
  } catch (error) {
    console.error("[oracle]", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "oracle_failed", message }, { status: 500 });
  }
}
