import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminSession } from "@/lib/server/requireAdminSession";
import { searchBrave } from "@/lib/braveSearch";
import type { Node } from "@/types";

export const maxDuration = 120;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

function buildBraveQuery(type: string, nodeTitle: string, topic: string): string {
  const t = nodeTitle.slice(0, 50);
  const ctx = topic.slice(0, 40);
  switch (type) {
    case "person":
      return `"${t}" ${ctx} investigation connections profile background`;
    case "company":
      return `"${t}" ${ctx} corporate fraud scandal investigation exposed`;
    case "event":
      return `"${t}" ${ctx} evidence timeline what really happened`;
    case "theory":
      return `"${t}" ${ctx} conspiracy evidence proof claims`;
    case "foia":
      return `"${t}" ${ctx} declassified document FOIA leaked`;
    case "patent":
      return `"${t}" ${ctx} patent secret technology hidden`;
    case "article":
    default:
      return `"${t}" ${ctx} investigation report`;
  }
}

/**
 * POST `{ newsId? } | { generatedArticleId? }`
 *
 * Refreshes brave_sources on an existing oracle_analyses row WITHOUT re-running OpenAI.
 * Loads the nodes JSONB, calls Brave per node, patches nodes back → single DB UPDATE.
 * Admin-only.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.BRAVE_SEARCH_API_KEY?.trim()) {
      return NextResponse.json({ error: "brave_missing", message: "BRAVE_SEARCH_API_KEY not configured." }, { status: 503 });
    }

    const admin = getAdminClient();
    const gate = await requireAdminSession(admin, req);
    if ("response" in gate) return gate.response;

    const body = (await req.json()) as { newsId?: string; generatedArticleId?: string };
    const newsId = body.newsId?.trim() || null;
    const generatedArticleId = body.generatedArticleId?.trim() || null;

    if ((!newsId && !generatedArticleId) || (newsId && generatedArticleId)) {
      return NextResponse.json({ error: "provide exactly one of newsId or generatedArticleId" }, { status: 400 });
    }

    type AnalysisRow = { id: string; nodes: Node[] };

    // Load oracle_analyses row + article title for context
    let analysisRow: AnalysisRow | null = null;
    let topicTitle = "";

    if (newsId) {
      const { data: a } = await admin
        .from("oracle_analyses")
        .select("id, nodes")
        .eq("news_id", newsId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      analysisRow = (a as AnalysisRow | null);

      const { data: ni } = await admin.from("news_items").select("title").eq("id", newsId).maybeSingle();
      topicTitle = (ni as { title?: string } | null)?.title ?? "";
    } else {
      const { data: a } = await admin
        .from("oracle_analyses")
        .select("id, nodes")
        .eq("generated_article_id", generatedArticleId!)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      analysisRow = (a as AnalysisRow | null);

      const { data: ga } = await admin.from("generated_articles").select("title").eq("id", generatedArticleId!).maybeSingle();
      topicTitle = (ga as { title?: string } | null)?.title ?? "";
    }

    if (!analysisRow) {
      return NextResponse.json({ error: "no_oracle", message: "No oracle analysis found for this item. Run Oracle ↻ first." }, { status: 404 });
    }

    const topicKeywords = topicTitle.slice(0, 55);
    const nodes: Node[] = Array.isArray(analysisRow.nodes) ? (analysisRow.nodes as Node[]) : [];

    let enriched = 0;
    await Promise.all(
      nodes.map(async (node) => {
        const nodeTitle = node.detail?.title || node.label;
        const query = buildBraveQuery(node.type, nodeTitle, topicKeywords);
        const results = await searchBrave(query, 8);
        if (!results.length) return;
        const braveStructured = results.map((r) => ({ title: r.title, url: r.url, description: r.description }));
        node.detail = { ...node.detail, brave_sources: braveStructured };
        enriched += 1;
      }),
    );

    const { error: upErr } = await admin
      .from("oracle_analyses")
      .update({ nodes })
      .eq("id", analysisRow.id);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, enriched, total: nodes.length, analysisId: analysisRow.id });
  } catch (e) {
    console.error("[admin/oracle-brave-refresh]", e);
    return NextResponse.json(
      { error: "brave_refresh_failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
