import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { isBillingEnabled } from "@/lib/featureFlags";
import { runOraclePipelineInsert } from "@/lib/server/oraclePipeline";
import { userHasEffectivePro } from "@/lib/server/requireEffectivePro";
import { getPostHogClient } from "@/lib/posthog-server";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

function parseSubject(searchParams: URLSearchParams) {
  const newsId = searchParams.get("newsId")?.trim() || undefined;
  const generatedArticleId = searchParams.get("generatedArticleId")?.trim() || undefined;
  if ((!newsId && !generatedArticleId) || (Boolean(newsId) && Boolean(generatedArticleId))) {
    return { error: "provide exactly one of newsId or generatedArticleId" as const };
  }
  return { newsId, generatedArticleId };
}

function parseSubjectBody(body: { newsId?: string; generatedArticleId?: string }) {
  const newsId = body.newsId?.trim() || undefined;
  const generatedArticleId = body.generatedArticleId?.trim() || undefined;
  if ((!newsId && !generatedArticleId) || (Boolean(newsId) && Boolean(generatedArticleId))) {
    return { error: "provide exactly one of newsId or generatedArticleId" as const };
  }
  return { newsId, generatedArticleId };
}

async function loadCachedAnalysis(
  admin: SupabaseClient,
  subject: { newsId?: string; generatedArticleId?: string },
) {
  if (subject.newsId) {
    const { data } = await admin
      .from("oracle_analyses")
      .select("*")
      .eq("news_id", subject.newsId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  }
  const { data } = await admin
    .from("oracle_analyses")
    .select("*")
    .eq("generated_article_id", subject.generatedArticleId!)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Public read — returns cached Oracle analysis only (for shared /board links). */
export async function GET(req: NextRequest) {
  try {
    const admin = getAdminClient();
    const subject = parseSubject(new URL(req.url).searchParams);
    if ("error" in subject) {
      return NextResponse.json({ error: subject.error }, { status: 400 });
    }

    const cached = await loadCachedAnalysis(admin, subject);
    if (!cached) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json(cached);
  } catch (error) {
    console.error("[oracle GET]", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "oracle_failed", message }, { status: 500 });
  }
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
    const body = (await req.json()) as { newsId?: string; generatedArticleId?: string };
    const subject = parseSubjectBody(body);
    if ("error" in subject) {
      return NextResponse.json({ error: subject.error }, { status: 400 });
    }

    const cached = await loadCachedAnalysis(admin, subject);
    if (cached) return NextResponse.json(cached);

    const auth = req.headers.get("authorization");
    let userId: string | null = null;
    if (auth?.startsWith("Bearer ")) {
      const token = auth.replace("Bearer ", "");
      const {
        data: { user },
        error: userErr,
      } = await admin.auth.getUser(token);
      if (!userErr && user) userId = user.id;
    }

    if (!userId && isBillingEnabled()) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }

    if (userId && !(await userHasEffectivePro(admin, userId))) {
      return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
    }

    const result = await runOraclePipelineInsert(
      admin,
      subject.newsId ? { newsId: subject.newsId } : { generatedArticleId: subject.generatedArticleId! },
    );
    if (!result.ok) {
      return NextResponse.json({ error: result.error, message: result.message }, { status: result.status });
    }

    getPostHogClient().capture({
      distinctId: userId ?? `anon-board:${subject.newsId ?? subject.generatedArticleId}`,
      event: "oracle_analysis_requested",
      properties: {
        ...(subject.newsId ? { news_id: subject.newsId, source: "article" } : {}),
        ...(subject.generatedArticleId
          ? { generated_article_id: subject.generatedArticleId, source: "generated_article" }
          : {}),
        anonymous: !userId,
      },
    });
    return NextResponse.json(result.inserted);
  } catch (error) {
    console.error("[oracle]", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "oracle_failed", message }, { status: 500 });
  }
}
