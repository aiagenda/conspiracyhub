import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";
import { ensureOracleTheoriesAtLeastOne } from "@/lib/oracleTheories";
import { SYSTEM_ORACLE } from "@/lib/prompts";
import { sanitizeOracleHttpUrl, sanitizeOracleTheoryUrlStrings } from "@/lib/oracleSourceUrls";
import { createSourceUrlAllowlist, extractHttpsUrlsFromText, mergeUrlSeeds } from "@/lib/sourceUrlAllowlist";
import { normalizeVerdict } from "@/lib/verdict";
import { userHasEffectivePro } from "@/lib/server/requireEffectivePro";
import type { Edge, Node, OracleAnalysis, OracleSource } from "@/types";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const admin = getAdminClient();
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) return NextResponse.json({ error: "missing_token" }, { status: 401 });
    const token = auth.replace("Bearer ", "");

    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(token);
    if (userErr || !user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });

    const { newsId } = await req.json();
    if (!newsId) return NextResponse.json({ error: "newsId_required" }, { status: 400 });

    if (!(await userHasEffectivePro(admin, user.id))) {
      return NextResponse.json({ error: "upgrade_required" }, { status: 403 });
    }

    const { data: news } = await admin.from("news_items").select("*").eq("id", newsId).single();
    if (!news) return NextResponse.json({ error: "news_not_found" }, { status: 404 });

    const { data: cached } = await admin.from("oracle_analyses").select("*").eq("news_id", newsId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (cached) return NextResponse.json(cached);

    const articleLine = `Article: ${news.title}\nSummary: ${news.summary}\nURL: ${news.url}`;

    const oracleSeeds = mergeUrlSeeds([news.url], extractHttpsUrlsFromText(`${news.summary ?? ""}\n${news.url}`));
    const oracleAllow = createSourceUrlAllowlist(oracleSeeds);
    const oracleUserMessage = articleLine + oracleAllow.promptBlock;

    const analysisRaw = await callOpenAIJSON<OracleAnalysis>({
      apiKey: process.env.OPENAI_API_KEY!,
      system: SYSTEM_ORACLE,
      user: oracleUserMessage,
      maxTokens: 4500,
    });

    const analysisMerged = await ensureOracleTheoriesAtLeastOne(analysisRaw, oracleUserMessage, {
      apiKey: process.env.OPENAI_API_KEY!,
      maxTokens: 3500,
    });

    const analysisAfterAllowlist = oracleAllow.applyToOracleAnalysis(analysisMerged);

    const theoriesSanitized = (analysisAfterAllowlist.theories ?? []).map((t) => ({
      ...t,
      sources: sanitizeOracleTheoryUrlStrings(t.sources),
    }));

    const genericLabels = new Set(["connection", "link", "contextual relationship"]);
    const normalizedEdges: Edge[] = (analysisAfterAllowlist.edges ?? []).map((edge) => ({
      ...edge,
      label:
        edge.label && !genericLabels.has(edge.label.trim().toLowerCase())
          ? edge.label
          : "Evidence-backed contextual relationship",
      confidence: typeof edge.confidence === "number" ? edge.confidence : Math.round((edge.strength ?? 0.5) * 100),
    }));

    const normalizedNodes: Node[] = (analysisAfterAllowlist.nodes ?? []).map((node) => ({
      ...node,
      detail: {
        ...node.detail,
        source_url: (() => {
          const u = sanitizeOracleHttpUrl(node.detail?.source_url);
          return u || undefined;
        })(),
        source_tier: node.detail?.source_tier ?? "B",
        source_type: node.detail?.source_type ?? "media",
        why_it_matters:
          node.detail?.why_it_matters && node.detail.why_it_matters.trim().length > 0
            ? node.detail.why_it_matters
            : `This node can influence the interpretation of the main story through contextual signals and evidence overlap.`,
        key_claims:
          Array.isArray(node.detail?.key_claims) && node.detail.key_claims.length > 0
            ? node.detail.key_claims
            : [
                `Primary claim: ${node.detail?.title ?? node.label}`,
                `Source-linked signal: ${node.detail?.source ?? "Unspecified source reference"}`,
              ],
        uncertainties:
          Array.isArray(node.detail?.uncertainties) && node.detail.uncertainties.length > 0
            ? node.detail.uncertainties
            : ["Independent verification depth is limited for at least one sub-claim."],
        counter_evidence:
          Array.isArray(node.detail?.counter_evidence) && node.detail.counter_evidence.length > 0
            ? node.detail.counter_evidence
            : ["No strong contradiction was provided by the model output for this node."],
        timeline:
          Array.isArray(node.detail?.timeline) && node.detail.timeline.length > 0
            ? node.detail.timeline
            : [{ date: "Unknown", event: node.detail?.title ?? node.label }],
        actors:
          Array.isArray(node.detail?.actors) && node.detail.actors.length > 0
            ? node.detail.actors
            : [node.label],
        confidence:
          typeof node.detail?.confidence === "number"
            ? Math.max(0, Math.min(100, node.detail.confidence))
            : Math.round((typeof node.detail?.threat === "number" ? node.detail.threat : 50) * 0.9),
        open_questions:
          Array.isArray(node.detail?.open_questions) && node.detail.open_questions.length > 0
            ? node.detail.open_questions
            : ["Which additional primary source could independently confirm this relationship?"],
      },
    }));

    const inferredSourcesFromNodes: OracleSource[] = normalizedNodes
      .map((node, index) => {
        const url = node.detail?.source_url;
        if (!url || !/^https?:\/\//i.test(url)) return null;
        let domain = "unknown";
        try {
          domain = new URL(url).hostname;
        } catch {
          domain = "unknown";
        }
        return {
          id: `node-source-${index}`,
          title: node.detail?.source || node.label,
          url,
          domain,
          tier: node.detail?.source_tier ?? "B",
          source_type: node.detail?.source_type ?? "media",
          excerpt: node.detail?.body?.slice(0, 240),
        } satisfies OracleSource;
      })
      .filter(Boolean) as OracleSource[];

    const providedSources = (Array.isArray(analysisAfterAllowlist.sources) ? analysisAfterAllowlist.sources : [])
      .map((source) => ({
        ...source,
        url: sanitizeOracleHttpUrl((source as OracleSource).url),
      }))
      .filter((source) => source.url && /^https?:\/\//i.test(source.url)) as OracleSource[];

    const mergedSources = [...providedSources, ...inferredSourcesFromNodes].filter(
      (source, idx, arr) => source?.url && arr.findIndex((s) => s.url === source.url) === idx,
    );
    const validSources = mergedSources.filter((source) => /^https?:\/\//i.test(source.url));

    if (validSources.length < 2) {
      validSources.push({
        id: "guardian-article",
        title: news.title,
        url: news.url,
        domain: new URL(news.url).hostname,
        tier: "B",
        source_type: "media",
        excerpt: news.summary ?? "",
      });
    }

    const payload = {
      news_id: newsId,
      nodes: normalizedNodes,
      edges: normalizedEdges,
      sources: validSources,
      theories: theoriesSanitized,
      conclusion: analysisAfterAllowlist.conclusion,
      verdict: normalizeVerdict(analysisAfterAllowlist.verdict),
    };

    const { data: inserted, error } = await admin.from("oracle_analyses").insert(payload).select("*").single();
    if (error) throw error;

    // Best-effort source registry writes — skip silently if tables don't exist
    try {
      if (validSources.length) {
        const { data: sourceRows } = await admin
          .from("source_documents")
          .upsert(
            validSources.map((source) => ({
              url: source.url,
              domain: source.domain,
              title: source.title,
              source_type: source.source_type,
              tier: source.tier,
              excerpt: source.excerpt ?? null,
            })),
            { onConflict: "url" },
          )
          .select("id,url");

        if (sourceRows?.length && inserted?.id) {
          await admin.from("analysis_sources").upsert(
            sourceRows.map((row) => ({
              analysis_id: inserted.id,
              source_id: row.id,
              relation_note: "Auto-linked from oracle analysis",
            })),
            { onConflict: "analysis_id,source_id" },
          );
        }
      }
    } catch (sourceErr) {
      console.warn("[oracle] source registry skipped:", sourceErr instanceof Error ? sourceErr.message : sourceErr);
    }

    return NextResponse.json(inserted);
  } catch (error) {
    if (error instanceof Error && error.message === "oracle_no_theories") {
      return NextResponse.json({ error: "oracle_no_theories", message: "Model returned no usable theories." }, { status: 422 });
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[oracle] FAILED:", msg, error);
    return NextResponse.json({ error: "oracle_failed" }, { status: 500 });
  }
}
