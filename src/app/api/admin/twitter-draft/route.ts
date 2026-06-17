import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";

export const maxDuration = 120;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-theorist.com";
const MAX_PICKS = 5;
const HIGH_SCORE_MIN = 55;
const HIGH_SCORE_MIN_RELAXED = 42;
const HIGH_SCORE_LOOKBACK_DAYS = 7;
const HIGH_SCORE_LOOKBACK_RELAXED_DAYS = 21;
const ORACLE_LOOKBACK_DAYS = 7;
const ORACLE_LOOKBACK_RELAXED_DAYS = 21;
const BLOG_LOOKBACK_DAYS = 30;
const DRAFT_EXCLUDE_DAYS = 14;
const DRAFT_EXCLUDE_RELAXED_DAYS = 3;
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

async function loadExcludedArticleKeys(admin: SupabaseClient, excludeDays = DRAFT_EXCLUDE_DAYS): Promise<Set<string>> {
  const since = new Date(Date.now() - excludeDays * 24 * 3600_000).toISOString();
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
    .limit(5);
  // Skip dismiss-marker rows (picks: []) — only a real batch counts as the cache.
  const row = (data ?? []).find((r) => Array.isArray(r.picks) && r.picks.length > 0);
  if (!row) return null;
  return {
    picks: row.picks as Array<{ article?: { id?: string; kind?: string } }>,
    cached_at: row.created_at as string,
  };
}

/** article_key for a cached pick object (mirrors articleKey()). */
function pickKey(pick: { article?: { id?: string; kind?: string } }): string {
  const id = String(pick.article?.id ?? "");
  return pick.article?.kind === "generated_article" ? `gen:${id}` : id;
}

/** Record a single article as dismissed so it is excluded from future batches (14d). */
async function recordDismissal(admin: SupabaseClient, key: string) {
  await admin.from("twitter_draft_batches").insert({ picks: [], article_keys: [key] });
}

/**
 * Keys the admin explicitly DISMISSED — only the marker rows (empty `picks`), NOT the
 * article_keys of real saved batches. Used to drop dismissed topics from the cached batch
 * without filtering out the cached batch's own (still-valid) picks.
 */
async function loadDismissedKeys(admin: SupabaseClient, days = DRAFT_EXCLUDE_DAYS): Promise<Set<string>> {
  const since = new Date(Date.now() - days * 24 * 3600_000).toISOString();
  const { data } = await admin
    .from("twitter_draft_batches")
    .select("picks, article_keys")
    .gte("created_at", since)
    .limit(200);
  const out = new Set<string>();
  for (const row of data ?? []) {
    const isDismissMarker = !Array.isArray(row.picks) || row.picks.length === 0;
    if (!isDismissMarker) continue;
    for (const key of row.article_keys ?? []) {
      if (key) out.add(String(key));
    }
  }
  return out;
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

async function loadCandidatesFromPool(
  admin: SupabaseClient,
  excludeKeys: Set<string>,
  opts: {
    minScore: number;
    lookbackDays: number;
    oracleDays: number;
    includeBlog?: boolean;
  },
): Promise<TwitterCandidate[]> {
  const highScoreSince = new Date(Date.now() - opts.lookbackDays * 24 * 3600_000).toISOString();
  const oracleSince = new Date(Date.now() - opts.oracleDays * 24 * 3600_000).toISOString();
  const byId = new Map<string, TwitterCandidate>();

  const [oracleNews, oracleGen, { data: highScoreNews }] = await Promise.all([
    loadOracleByNews(admin, oracleSince),
    loadOracleByGenerated(admin, oracleSince),
    admin
      .from("news_items")
      .select("id, title, summary, angle, score, section")
      .gte("published_at", highScoreSince)
      .gte("score", opts.minScore)
      .order("score", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(20),
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
        priority: Math.max(score, opts.minScore) + 25,
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

  if (opts.includeBlog) {
    const blogSince = new Date(Date.now() - BLOG_LOOKBACK_DAYS * 24 * 3600_000).toISOString();
    const { data: blogRows } = await admin
      .from("generated_articles")
      .select("id, title, slug, excerpt, published_at")
      .eq("status", "published")
      .gte("published_at", blogSince)
      .order("published_at", { ascending: false })
      .limit(12);
    for (const row of blogRows ?? []) {
      const id = String(row.id);
      const key = `gen:${id}`;
      if (byId.has(key)) continue;
      const slug = String(row.slug ?? "").trim();
      if (!slug) continue;
      byId.set(key, {
        kind: "generated_article",
        id,
        title: String(row.title ?? ""),
        summary: String(row.excerpt ?? ""),
        angle: "",
        score: null,
        section: "Analysis",
        site_url: `${SITE_URL}/blog/${slug}`,
        oracleContext: "",
        has_oracle: false,
        priority: 62,
      });
    }
  }

  return [...byId.values()]
    .filter((c) => c.title.trim())
    .filter((c) => !excludeKeys.has(articleKey(c.kind, c.id)))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_PICKS);
}

async function loadCandidates(admin: SupabaseClient, excludeKeys: Set<string>): Promise<TwitterCandidate[]> {
  const tiers = [
    {
      minScore: HIGH_SCORE_MIN,
      lookbackDays: HIGH_SCORE_LOOKBACK_DAYS,
      oracleDays: ORACLE_LOOKBACK_DAYS,
      includeBlog: false,
    },
    {
      minScore: HIGH_SCORE_MIN_RELAXED,
      lookbackDays: HIGH_SCORE_LOOKBACK_RELAXED_DAYS,
      oracleDays: ORACLE_LOOKBACK_RELAXED_DAYS,
      includeBlog: true,
    },
  ];

  for (const tier of tiers) {
    const picks = await loadCandidatesFromPool(admin, excludeKeys, tier);
    if (picks.length > 0) return picks;
  }

  const shortExclude = await loadExcludedArticleKeys(admin, DRAFT_EXCLUDE_RELAXED_DAYS);
  const relaxed = await loadCandidatesFromPool(admin, shortExclude, tiers[1]!);
  if (relaxed.length > 0) return relaxed;

  // Nothing left after exclusions — allow re-use of recent articles so admin can still post.
  return loadCandidatesFromPool(admin, new Set(), tiers[1]!);
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
      // Drop only picks the admin has since DISMISSED (not the batch's own keys) so the
      // cache still serves — otherwise every load would regenerate (OpenAI cost).
      const dismissed = await loadDismissedKeys(admin);
      const visiblePicks = cached.picks.filter((p) => !dismissed.has(pickKey(p)));
      if (visiblePicks.length > 0) {
        return NextResponse.json({
          picks: visiblePicks,
          count: visiblePicks.length,
          cached: true,
          cached_at: cached.cached_at,
        });
      }
      // All cached picks dismissed — fall through to generate a fresh batch.
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
          hint: `No eligible articles (score ≥${HIGH_SCORE_MIN} in ${HIGH_SCORE_LOOKBACK_DAYS}d, Oracle ${ORACLE_LOOKBACK_DAYS}d, blog ${BLOG_LOOKBACK_DAYS}d fallback, or score ≥${HIGH_SCORE_MIN_RELAXED} in ${HIGH_SCORE_LOOKBACK_RELAXED_DAYS}d). Run news ingest or fix OPENAI_API_KEY for writers.`,
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

/**
 * Dismiss a single drafted topic: `{ action: "dismiss", id, kind, shown?: string[] }`.
 * Records it as excluded (so it won't be picked again for 14 days, and is filtered out of
 * the cached batch on reload) and returns one fresh replacement pick so the list stays full.
 */
export async function POST(req: NextRequest) {
  const admin = getAdmin();
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const action = String(body.action ?? "dismiss");
  if (action !== "dismiss") {
    return NextResponse.json({ error: "unknown_action" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  const kind: TwitterCandidate["kind"] = body.kind === "generated_article" ? "generated_article" : "news_item";
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const dismissedKey = articleKey(kind, id);
  const shown = Array.isArray(body.shown) ? body.shown.map((k) => String(k)) : [];

  try {
    await recordDismissal(admin, dismissedKey);
  } catch (e) {
    return NextResponse.json(
      { error: "dismiss_failed", hint: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }

  // Try to serve a fresh replacement so the admin always has new topics to work with.
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ok: true, dismissed: dismissedKey, pick: null });
  }

  try {
    const excludeKeys = await loadExcludedArticleKeys(admin);
    for (const k of shown) excludeKeys.add(k);
    excludeKeys.add(dismissedKey);

    const candidates = await loadCandidatesFromPool(admin, excludeKeys, {
      minScore: HIGH_SCORE_MIN_RELAXED,
      lookbackDays: HIGH_SCORE_LOOKBACK_RELAXED_DAYS,
      oracleDays: ORACLE_LOOKBACK_RELAXED_DAYS,
      includeBlog: true,
    });
    const next = candidates.find((c) => !shown.includes(articleKey(c.kind, c.id)));
    if (!next) {
      return NextResponse.json({ ok: true, dismissed: dismissedKey, pick: null });
    }
    const pick = await generateForCandidate(next, apiKey);
    return NextResponse.json({ ok: true, dismissed: dismissedKey, pick });
  } catch (e) {
    // Dismissal already persisted; replacement is best-effort.
    console.warn("[twitter-draft] replacement failed", e);
    return NextResponse.json({ ok: true, dismissed: dismissedKey, pick: null });
  }
}
