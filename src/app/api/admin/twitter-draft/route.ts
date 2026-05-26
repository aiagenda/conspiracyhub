import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";

export const maxDuration = 120;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-theorist.com";
const MAX_PICKS = 5;
const HIGH_SCORE_MIN = 55;
const HIGH_SCORE_LOOKBACK_DAYS = 7;
const ORACLE_LOOKBACK_DAYS = 7;
const DRAFT_EXCLUDE_DAYS = 14;
const DRAFT_CACHE_TTL_HOURS = 24;

function articleKey(kind: TwitterCandidate["kind"], id: string): string {
  return kind === "generated_article" ? `gen:${id}` : id;
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

type OracleRow = {
  news_id?: string | null;
  generated_article_id?: string | null;
  nodes?: Array<{ label?: string }>;
  theories?: Array<{ name?: string; summary?: string }>;
  conclusion?: string;
  verdict?: string;
};

type TwitterCandidate = {
  kind: "news_item" | "generated_article";
  id: string;
  title: string;
  summary: string;
  angle: string;
  score: number | null;
  section: string | null;
  site_url: string;
  oracleContext: string;
  priority: number;
  has_oracle: boolean;
};

const TWEET_SYSTEM = `You are a social media strategist for The Theorist — an AI-powered conspiracy investigation platform.
Write 3 tweet variants for the given article or Oracle investigation. Each must:
- Be under 240 characters (leave room for URL)
- Hook the reader immediately — question, shocking claim, or mystery
- NOT sound like a bot or marketing copy
- Reference the specific content (article summary and/or Oracle verdict, conclusion, key theories)
- When Oracle investigation data is provided, lean on the verdict or a compelling theory angle
- End naturally (no "Check it out!" type phrases)

Return ONLY valid JSON:
{
  "variants": [
    { "style": "shocking", "text": "tweet text without URL" },
    { "style": "question", "text": "tweet text without URL" },
    { "style": "investigative", "text": "tweet text without URL" }
  ],
  "hashtags": ["tag1", "tag2", "tag3"],
  "best_time": "morning|afternoon|evening"
}`;

function formatOracleContext(row: OracleRow): string {
  const nodes = Array.isArray(row.nodes) ? row.nodes : [];
  const theories = Array.isArray(row.theories) ? row.theories : [];
  const nodeLabels = nodes.map((n) => String(n.label ?? "").trim()).filter(Boolean).slice(0, 8);
  const theoryLines = theories
    .slice(0, 3)
    .map((t) => `- ${String(t.name ?? "").trim()}: ${String(t.summary ?? "").slice(0, 120)}`)
    .filter((l) => l.length > 2);

  return [
    "Oracle investigation board:",
    row.verdict ? `Verdict: ${row.verdict}` : "",
    row.conclusion ? `Conclusion: ${String(row.conclusion).slice(0, 400)}` : "",
    nodeLabels.length ? `Key nodes: ${nodeLabels.join(", ")}` : "",
    theoryLines.length ? `Theories:\n${theoryLines.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function loadOracleByNews(admin: SupabaseClient, sinceIso: string) {
  const map = new Map<string, string>();
  const { data } = await admin
    .from("oracle_analyses")
    .select("news_id, nodes, theories, conclusion, verdict, created_at")
    .not("news_id", "is", null)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(80);

  for (const row of data ?? []) {
    const id = row.news_id ? String(row.news_id) : "";
    if (id && !map.has(id)) map.set(id, formatOracleContext(row as OracleRow));
  }
  return map;
}

async function loadOracleByGenerated(admin: SupabaseClient, sinceIso: string) {
  const map = new Map<string, string>();
  const { data } = await admin
    .from("oracle_analyses")
    .select("generated_article_id, nodes, theories, conclusion, verdict, created_at")
    .not("generated_article_id", "is", null)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(40);

  for (const row of data ?? []) {
    const id = row.generated_article_id ? String(row.generated_article_id) : "";
    if (id && !map.has(id)) map.set(id, formatOracleContext(row as OracleRow));
  }
  return map;
}

async function loadExcludedArticleKeys(admin: SupabaseClient): Promise<Set<string>> {
  const since = new Date(Date.now() - DRAFT_EXCLUDE_DAYS * 24 * 3600_000).toISOString();
  const { data } = await admin
    .from("twitter_draft_batches")
    .select("article_keys")
    .gte("created_at", since)
    .limit(200);
  const out = new Set<string>();
  for (const row of data ?? []) {
    for (const key of row.article_keys ?? []) {
      if (key) out.add(String(key));
    }
  }
  return out;
}

async function loadLatestCachedBatch(admin: SupabaseClient) {
  const since = new Date(Date.now() - DRAFT_CACHE_TTL_HOURS * 3600_000).toISOString();
  const { data } = await admin
    .from("twitter_draft_batches")
    .select("picks, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.picks || !Array.isArray(data.picks)) return null;
  return {
    picks: data.picks,
    cached_at: data.created_at as string,
  };
}

async function saveDraftBatch(
  admin: SupabaseClient,
  picks: ReturnType<typeof mapVariants>[],
  candidates: TwitterCandidate[],
) {
  const article_keys = candidates.map((c) => articleKey(c.kind, c.id));
  await admin.from("twitter_draft_batches").insert({
    picks,
    article_keys,
  });
}

async function loadCandidates(admin: SupabaseClient, excludeKeys: Set<string>): Promise<TwitterCandidate[]> {
  const highScoreSince = new Date(Date.now() - HIGH_SCORE_LOOKBACK_DAYS * 24 * 3600_000).toISOString();
  const oracleSince = new Date(Date.now() - ORACLE_LOOKBACK_DAYS * 24 * 3600_000).toISOString();
  const byId = new Map<string, TwitterCandidate>();

  const [oracleNews, oracleGen, { data: highScoreNews }] = await Promise.all([
    loadOracleByNews(admin, oracleSince),
    loadOracleByGenerated(admin, oracleSince),
    admin
      .from("news_items")
      .select("id, title, summary, angle, score, section")
      .gte("published_at", highScoreSince)
      .gte("score", HIGH_SCORE_MIN)
      .order("score", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(15),
  ]);

  for (const row of highScoreNews ?? []) {
    const id = String(row.id);
    const oracleContext = oracleNews.get(id) ?? "";
    const score = Number(row.score ?? 0);
    byId.set(id, {
      kind: "news_item",
      id,
      title: String(row.title ?? ""),
      summary: String(row.summary ?? ""),
      angle: String(row.angle ?? ""),
      score,
      section: row.section ? String(row.section) : null,
      site_url: `${SITE_URL}/board/${id}`,
      oracleContext,
      has_oracle: Boolean(oracleContext),
      priority: score + (oracleContext ? 20 : 0),
    });
  }

  const missingOracleNewsIds = [...oracleNews.keys()].filter((id) => !byId.has(id));
  if (missingOracleNewsIds.length) {
    const { data: oracleNewsRows } = await admin
      .from("news_items")
      .select("id, title, summary, angle, score, section")
      .in("id", missingOracleNewsIds.slice(0, 20));
    for (const row of oracleNewsRows ?? []) {
      const id = String(row.id);
      const oracleContext = oracleNews.get(id) ?? "";
      const score = Number(row.score ?? 0);
      byId.set(id, {
        kind: "news_item",
        id,
        title: String(row.title ?? ""),
        summary: String(row.summary ?? ""),
        angle: String(row.angle ?? ""),
        score: score || null,
        section: row.section ? String(row.section) : null,
        site_url: `${SITE_URL}/board/${id}`,
        oracleContext,
        has_oracle: true,
        priority: Math.max(score, 55) + 25,
      });
    }
  }

  if (oracleGen.size) {
    const { data: genRows } = await admin
      .from("generated_articles")
      .select("id, title, slug, excerpt")
      .in("id", [...oracleGen.keys()].slice(0, 15));
    for (const row of genRows ?? []) {
      const id = String(row.id);
      const slug = String(row.slug ?? "").trim();
      if (!slug) continue;
      const oracleContext = oracleGen.get(id) ?? "";
      byId.set(`gen:${id}`, {
        kind: "generated_article",
        id,
        title: String(row.title ?? ""),
        summary: String(row.excerpt ?? ""),
        angle: "",
        score: null,
        section: "Analysis",
        site_url: `${SITE_URL}/blog/${slug}`,
        oracleContext,
        has_oracle: true,
        priority: 78,
      });
    }
  }

  return [...byId.values()]
    .filter((c) => c.title.trim())
    .filter((c) => !excludeKeys.has(articleKey(c.kind, c.id)))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_PICKS);
}

async function loadSingleCandidate(admin: SupabaseClient, articleId: string): Promise<TwitterCandidate | null> {
  const { data: news } = await admin
    .from("news_items")
    .select("id, title, summary, angle, score, section")
    .eq("id", articleId)
    .maybeSingle();

  if (news) {
    const { data: oracle } = await admin
      .from("oracle_analyses")
      .select("nodes, theories, conclusion, verdict")
      .eq("news_id", articleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const oracleContext = oracle ? formatOracleContext(oracle as OracleRow) : "";
    return {
      kind: "news_item",
      id: String(news.id),
      title: String(news.title ?? ""),
      summary: String(news.summary ?? ""),
      angle: String(news.angle ?? ""),
      score: Number(news.score ?? 0) || null,
      section: news.section ? String(news.section) : null,
      site_url: `${SITE_URL}/board/${news.id}`,
      oracleContext,
      has_oracle: Boolean(oracleContext),
      priority: Number(news.score ?? 0),
    };
  }

  const { data: gen } = await admin
    .from("generated_articles")
    .select("id, title, slug, excerpt")
    .eq("id", articleId)
    .maybeSingle();

  if (!gen) return null;

  const slug = String(gen.slug ?? "").trim();
  if (!slug) return null;

  const { data: oracle } = await admin
    .from("oracle_analyses")
    .select("nodes, theories, conclusion, verdict")
    .eq("generated_article_id", articleId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const oracleContext = oracle ? formatOracleContext(oracle as OracleRow) : "";

  return {
    kind: "generated_article",
    id: String(gen.id),
    title: String(gen.title ?? ""),
    summary: String(gen.excerpt ?? ""),
    angle: "",
    score: null,
    section: "Analysis",
    site_url: `${SITE_URL}/blog/${slug}`,
    oracleContext,
    has_oracle: Boolean(oracleContext),
    priority: 70,
  };
}

function buildUserPrompt(candidate: TwitterCandidate): string {
  const lines = [
    `Type: ${candidate.kind === "generated_article" ? "Investigative analysis article" : "Board news article"}`,
    `Title: ${candidate.title}`,
    candidate.angle ? `Conspiracy angle: ${candidate.angle}` : "",
    candidate.score != null ? `Threat score: ${candidate.score}%` : "",
    candidate.section ? `Section: ${candidate.section}` : "",
    candidate.summary ? `Summary: ${candidate.summary}` : "",
    candidate.oracleContext ? `\n${candidate.oracleContext}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function mapVariants(
  candidate: TwitterCandidate,
  result: { variants: Array<{ style: string; text: string }>; hashtags: string[]; best_time: string },
) {
  const hashtags = result.hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ");
  return {
    article: {
      id: candidate.id,
      title: candidate.title,
      score: candidate.score,
      section: candidate.section,
      kind: candidate.kind,
      has_oracle: candidate.has_oracle,
      board_url: candidate.site_url,
    },
    variants: result.variants.map((v) => {
      const full_tweet = `${v.text}\n\n${candidate.site_url}\n\n${hashtags}`;
      return {
        style: v.style,
        text: v.text,
        full_tweet,
        char_count: full_tweet.length,
        twitter_intent_url: `https://twitter.com/intent/tweet?text=${encodeURIComponent(full_tweet)}`,
      };
    }),
    hashtags: result.hashtags,
    best_time: result.best_time,
  };
}

async function generateForCandidate(candidate: TwitterCandidate, apiKey: string) {
  const result = await callOpenAIJSON<{
    variants: Array<{ style: string; text: string }>;
    hashtags: string[];
    best_time: string;
  }>({
    apiKey,
    system: TWEET_SYSTEM,
    user: buildUserPrompt(candidate),
    maxTokens: 600,
    model: "gpt-4o-mini",
  });
  return mapVariants(candidate, result);
}

/** Open access for now — same as other /api/admin/* routes. */
export async function GET(req: NextRequest) {
  const admin = getAdmin();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const articleId = searchParams.get("id");
  const refresh = searchParams.get("refresh") === "1";
  const latestOnly = searchParams.get("latest") === "1";

  if (!articleId && !refresh) {
    const cached = await loadLatestCachedBatch(admin);
    if (cached) {
      return NextResponse.json({
        picks: cached.picks,
        count: cached.picks.length,
        cached: true,
        cached_at: cached.cached_at,
      });
    }
    if (latestOnly) {
      return NextResponse.json({ error: "no_cached_drafts" }, { status: 404 });
    }
  }

  let candidates: TwitterCandidate[];
  if (articleId) {
    const one = await loadSingleCandidate(admin, articleId);
    if (!one) {
      return NextResponse.json({ error: "no_article_found" }, { status: 404 });
    }
    candidates = [one];
  } else {
    const excludeKeys = await loadExcludedArticleKeys(admin);
    candidates = await loadCandidates(admin, excludeKeys);
    if (candidates.length === 0) {
      return NextResponse.json(
        {
          error: "no_article_found",
          hint: `No new eligible articles (score ≥${HIGH_SCORE_MIN}, last ${HIGH_SCORE_LOOKBACK_DAYS}d, or Oracle ${ORACLE_LOOKBACK_DAYS}d) outside the ${DRAFT_EXCLUDE_DAYS}-day draft window. Try refresh after more ingest or wait for exclusions to expire.`,
        },
        { status: 404 },
      );
    }
  }

  const picks = [];
  const usedCandidates: TwitterCandidate[] = [];
  for (const candidate of candidates) {
    try {
      picks.push(await generateForCandidate(candidate, apiKey));
      usedCandidates.push(candidate);
    } catch (e) {
      console.error("[twitter-draft] generate failed", candidate.id, e);
    }
  }

  if (picks.length === 0) {
    return NextResponse.json({ error: "generation_failed" }, { status: 500 });
  }

  if (!articleId) {
    try {
      await saveDraftBatch(admin, picks, usedCandidates);
    } catch (e) {
      console.warn("[twitter-draft] cache save failed", e);
    }
  }

  return NextResponse.json({ picks, count: picks.length, cached: false });
}
