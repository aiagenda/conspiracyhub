import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";
import { ensureOracleTheoriesAtLeastOne } from "@/lib/oracleTheories";
import { SYSTEM_ORACLE } from "@/lib/prompts";
import { sanitizeOracleHttpUrl, sanitizeOracleTheoryUrlStrings } from "@/lib/oracleSourceUrls";
import { createSourceUrlAllowlist, extractHttpsUrlsFromText, mergeUrlSeeds } from "@/lib/sourceUrlAllowlist";
import { normalizeVerdict } from "@/lib/verdict";
import type { Edge, Node, OracleAnalysis, OracleSource } from "@/types";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

function siteBase(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://conspiracyhub.vercel.app";
}

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function urlsFromGeneratedSources(sources: unknown): string[] {
  if (!Array.isArray(sources)) return [];
  const out: string[] = [];
  for (const s of sources) {
    if (s && typeof s === "object" && "url" in s) {
      const u = String((s as { url?: string }).url ?? "");
      if (/^https?:\/\//i.test(u)) out.push(u);
    }
  }
  return out;
}

/** `source_documents.source_type` check constraint (no `testimony`). */
function clampDbSourceType(st: unknown): "official" | "media" | "research" | "archive" {
  const t = String(st ?? "media").toLowerCase().trim();
  if (t === "official" || t === "media" || t === "research" || t === "archive") return t;
  if (t === "testimony") return "archive";
  return "media";
}

function clampDbTier(tier: unknown): "A" | "B" | "C" {
  const t = String(tier ?? "B").toUpperCase().trim();
  return t === "A" || t === "B" || t === "C" ? t : "B";
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

    let articleLine: string;
    let primaryTitle: string;
    let primaryUrl: string;
    let primaryExcerpt: string;
    let generatedArticleSources: unknown = undefined;

    if (newsId) {
      const { data: news, error } = await admin.from("news_items").select("*").eq("id", newsId).single();
      if (error || !news) return NextResponse.json({ error: "news_not_found" }, { status: 404 });

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

      primaryTitle = news.title as string;
      primaryUrl = news.url as string;
      primaryExcerpt = (news.summary as string) ?? "";
      articleLine = `Article: ${primaryTitle}\nSummary: ${primaryExcerpt}\nURL: ${primaryUrl}`;
    } else {
      const { data: gen, error } = await admin
        .from("generated_articles")
        .select("*")
        .eq("id", generatedArticleId)
        .eq("status", "published")
        .single();
      if (error || !gen) return NextResponse.json({ error: "generated_article_not_found" }, { status: 404 });

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

      primaryTitle = gen.title as string;
      primaryUrl = `${siteBase().replace(/\/$/, "")}/blog/${gen.slug as string}`;
      primaryExcerpt =
        (typeof gen.excerpt === "string" && gen.excerpt.trim()) ||
        (typeof gen.meta_description === "string" && gen.meta_description.trim()) ||
        "";
      const bodyPreview = String(gen.content ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 2500);
      articleLine = `Investigation report: ${primaryTitle}\nSummary: ${primaryExcerpt}\nBody preview:\n${bodyPreview}\nURL: ${primaryUrl}`;
      generatedArticleSources = gen.sources;
    }

    const oracleSeeds = newsId
      ? mergeUrlSeeds([primaryUrl], extractHttpsUrlsFromText(`${primaryExcerpt}\n${primaryUrl}`))
      : mergeUrlSeeds([primaryUrl], urlsFromGeneratedSources(generatedArticleSources), extractHttpsUrlsFromText(articleLine));

    const oracleAllow = createSourceUrlAllowlist(oracleSeeds);
    const oracleUserMessage = articleLine + oracleAllow.promptBlock;

    const analysisRaw = await callOpenAIJSON<OracleAnalysis>({
      apiKey: process.env.OPENAI_API_KEY!,
      system: SYSTEM_ORACLE,
      user: oracleUserMessage,
      maxTokens: 8192,
      maxAttempts: 4,
    });

    const analysisMerged = await ensureOracleTheoriesAtLeastOne(analysisRaw, oracleUserMessage, {
      apiKey: process.env.OPENAI_API_KEY!,
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
        source_tier: clampDbTier(node.detail?.source_tier),
        source_type: clampDbSourceType(node.detail?.source_type ?? "media"),
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
        return {
          id: `node-source-${index}`,
          title: node.detail?.source || node.label,
          url,
          domain: safeHostname(url),
          tier: clampDbTier(node.detail?.source_tier),
          source_type: clampDbSourceType(node.detail?.source_type ?? "media"),
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
        id: "primary-article",
        title: primaryTitle,
        url: primaryUrl,
        domain: safeHostname(primaryUrl),
        tier: "B",
        source_type: "media",
        excerpt: primaryExcerpt.slice(0, 240),
      } satisfies OracleSource);
    }

    if (validSources.length < 2 && !newsId && generatedArticleId) {
      const { data: genRow } = await admin.from("generated_articles").select("sources").eq("id", generatedArticleId).maybeSingle();
      for (const u of urlsFromGeneratedSources(genRow?.sources)) {
        const clean = sanitizeOracleHttpUrl(u);
        if (!clean || validSources.some((s) => s.url === clean)) continue;
        validSources.push({
          id: `gen-src-${validSources.length}`,
          title: clean,
          url: clean,
          domain: safeHostname(clean),
          tier: "B",
          source_type: "research",
          excerpt: "",
        });
        if (validSources.length >= 2) break;
      }
    }

    const analysisInsertBase = {
      nodes: normalizedNodes,
      edges: normalizedEdges,
      sources: validSources,
      theories: theoriesSanitized,
      conclusion: analysisAfterAllowlist.conclusion,
      verdict: normalizeVerdict(analysisAfterAllowlist.verdict),
    };

    const insertRes = newsId
      ? await admin
          .from("oracle_analyses")
          .insert({ ...analysisInsertBase, news_id: newsId, generated_article_id: null })
          .select("*")
          .single()
      : await admin
          .from("oracle_analyses")
          .insert({
            ...analysisInsertBase,
            news_id: null,
            generated_article_id: generatedArticleId as string,
          })
          .select("*")
          .single();

    const { data: inserted, error: insertErr } = insertRes;
    if (insertErr) {
      throw new Error(insertErr.message || "oracle_insert_failed");
    }

    if (validSources.length && inserted?.id) {
      const rowsForDb = validSources.map((source) => ({
        url: source.url,
        domain: typeof source.domain === "string" && source.domain.trim() ? source.domain.trim() : safeHostname(source.url),
        title: String(source.title || "Source").slice(0, 500),
        source_type: clampDbSourceType(source.source_type),
        tier: clampDbTier(source.tier),
        excerpt: source.excerpt ?? null,
      }));

      try {
        const { data: sourceRows, error: upErr } = await admin
          .from("source_documents")
          .upsert(rowsForDb, { onConflict: "url" })
          .select("id,url");

        if (upErr) {
          console.warn("[oracle] source_documents upsert:", upErr.message);
        } else if (sourceRows?.length) {
          const { error: linkErr } = await admin.from("analysis_sources").upsert(
            sourceRows.map((row) => ({
              analysis_id: inserted.id,
              source_id: row.id,
              relation_note: "Auto-linked from oracle analysis",
            })),
            { onConflict: "analysis_id,source_id" },
          );
          if (linkErr) console.warn("[oracle] analysis_sources upsert:", linkErr.message);
        }
      } catch (regErr) {
        console.warn("[oracle] source registry skipped:", regErr);
      }
    }

    return NextResponse.json(inserted);
  } catch (error) {
    if (error instanceof Error && error.message === "oracle_no_theories") {
      return NextResponse.json({ error: "oracle_no_theories", message: "Model returned no usable theories." }, { status: 422 });
    }
    console.error("[oracle]", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "oracle_failed", message }, { status: 500 });
  }
}
