import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminSession } from "@/lib/server/requireAdminSession";
import { buildBraveQuery } from "@/lib/braveNodeQuery";
import { searchBrave } from "@/lib/braveSearch";
import { fetchArticleRelatedCoverage } from "@/lib/server/relatedCoverage";
import type { Node, OracleTheory } from "@/types";

export const maxDuration = 120;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
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

    type AnalysisRow = { id: string; nodes: Node[]; theories: OracleTheory[] };

    // Load oracle_analyses row + article title for context
    let analysisRow: AnalysisRow | null = null;
    let topicTitle = "";
    let primaryUrl = "";

    if (newsId) {
      const { data: a } = await admin
        .from("oracle_analyses")
        .select("id, nodes, theories")
        .eq("news_id", newsId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      analysisRow = (a as AnalysisRow | null);

      const { data: ni } = await admin.from("news_items").select("title, url").eq("id", newsId).maybeSingle();
      topicTitle = (ni as { title?: string } | null)?.title ?? "";
      primaryUrl = (ni as { url?: string } | null)?.url ?? "";
    } else {
      const { data: a } = await admin
        .from("oracle_analyses")
        .select("id, nodes, theories")
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
    const theories: OracleTheory[] = Array.isArray(analysisRow.theories) ? (analysisRow.theories as OracleTheory[]) : [];

    let enriched = 0;

    // ── Brave enrichment: gráf nodes[] ────────────────────────────────────
    await Promise.all(
      nodes.map(async (node) => {
        const nodeTitle = node.detail?.title || node.label;
        const results =
          node.type === "article"
            ? await fetchArticleRelatedCoverage(nodeTitle, topicKeywords, { excludeUrl: primaryUrl || undefined })
            : await searchBrave(buildBraveQuery(node.type, nodeTitle, topicKeywords), 8);
        if (!results.length) return;
        const braveStructured = results.map((r) => ({ title: r.title, url: r.url, description: r.description }));
        node.detail = { ...node.detail, brave_sources: braveStructured };
        enriched += 1;
      }),
    );

    // ── Brave enrichment: theories[] (conspiracy hypothesis cards) ────────
    let theoriesEnriched = 0;
    await Promise.all(
      theories.map(async (theory) => {
        const query = buildBraveQuery("theory", theory.name, topicKeywords);
        const results = await searchBrave(query, 6);
        if (!results.length) return;
        const existingUrls = new Set((theory.sources ?? []).filter((s) => /^https?:\/\//i.test(s)));
        const braveStructured = results
          .filter((r) => !existingUrls.has(r.url))
          .map((r) => ({ title: r.title, url: r.url, description: r.description }));
        if (braveStructured.length) {
          theory.brave_sources = braveStructured;
          theoriesEnriched += 1;
        }
      }),
    );

    const updatePatch: Record<string, unknown> = { nodes };
    if (theoriesEnriched > 0) updatePatch.theories = theories;

    const { error: upErr } = await admin
      .from("oracle_analyses")
      .update(updatePatch)
      .eq("id", analysisRow.id);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      enriched,
      theoriesEnriched,
      total: nodes.length,
      theoriesTotal: theories.length,
      analysisId: analysisRow.id,
    });
  } catch (e) {
    console.error("[admin/oracle-brave-refresh]", e);
    return NextResponse.json(
      { error: "brave_refresh_failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
