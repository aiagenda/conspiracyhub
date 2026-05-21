import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.the-theorist.com").replace(/\/$/, "");

/** Subreddits aligned with site sections — monitored for topic overlap. */
export const REDDIT_RADAR_SUBS = [
  "UFOs",
  "HighStrangeness",
  "aliens",
  "conspiracy",
  "Intelligence",
  "NSALeaks",
  "ufo",
  "UnresolvedMysteries",
  "worldnews",
  "science",
  "infectiousdisease",
  "Health",
] as const;

const MIN_MATCH_SCORE = 38;
const LOOKBACK_DAYS = 14;
const RSS_LIMIT = 12;

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
  "from", "is", "are", "was", "were", "be", "been", "has", "have", "had", "do", "does", "did",
  "will", "would", "could", "should", "may", "might", "must", "shall", "can", "need", "this",
  "that", "these", "those", "it", "its", "they", "them", "their", "we", "our", "you", "your",
  "he", "she", "his", "her", "who", "what", "when", "where", "why", "how", "not", "no", "yes",
  "all", "any", "some", "new", "says", "said", "after", "about", "into", "over", "just", "now",
  "report", "reports", "breaking", "update", "video", "watch", "live",
]);

export type RedditPostRow = {
  title: string;
  url: string;
  subreddit: string;
  pubDate: string;
  summary: string;
};

export type SiteMatchCandidate = {
  match_type: "news_item" | "uap_sighting" | "generated_article";
  matched_id: string;
  matched_title: string;
  site_url: string;
  blob: string;
};

export type RedditMatchRow = {
  id: string;
  reddit_url: string;
  reddit_title: string;
  subreddit: string;
  reddit_published_at: string | null;
  match_type: string;
  matched_id: string | null;
  matched_title: string | null;
  site_url: string;
  match_score: number;
  status: string;
  draft_variants: unknown;
  created_at: string;
};

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

function overlapScore(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = tokenize(b);
  if (ta.size === 0 || tb.length === 0) return 0;
  let hits = 0;
  for (const w of tb) {
    if (ta.has(w)) hits++;
  }
  const denom = Math.min(ta.size, tb.length);
  return Math.round((hits / Math.max(denom, 1)) * 100);
}

function parseSubreddit(url: string): string {
  const m = url.match(/reddit\.com\/r\/([^/]+)/i);
  return m?.[1] ?? "unknown";
}

export async function fetchRedditRadarPosts(): Promise<RedditPostRow[]> {
  const out: RedditPostRow[] = [];
  const seen = new Set<string>();

  for (const sub of REDDIT_RADAR_SUBS) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.rss?limit=${RSS_LIMIT}`, {
        headers: { "User-Agent": "TheTheorist/1.0 (reddit-radar)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
        const x = m[1];
        const title = x.match(/<title[^>]*>(.*?)<\/title>/)?.[1]?.trim() ?? "";
        const link = x.match(/href="(https:\/\/www\.reddit\.com\/r\/[^"]+)"/)?.[1] ?? "";
        const pub = x.match(/<updated>(.*?)<\/updated>/)?.[1] ?? "";
        const summary =
          x
            .match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]
            ?.replace(/<[^>]+>/g, " ")
            .trim()
            .slice(0, 300) ?? "";
        if (!title || !link || seen.has(link)) continue;
        seen.add(link);
        out.push({
          title,
          url: link,
          subreddit: sub,
          pubDate: pub,
          summary,
        });
      }
    } catch {
      continue;
    }
  }
  return out;
}

async function loadSiteCandidates(admin: SupabaseClient): Promise<SiteMatchCandidate[]> {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600_000).toISOString();
  const out: SiteMatchCandidate[] = [];

  const { data: news } = await admin
    .from("news_items")
    .select("id, title, summary, angle, section, score")
    .gte("published_at", cutoff)
    .gte("score", 55)
    .order("published_at", { ascending: false })
    .limit(150);

  for (const row of news ?? []) {
    const title = String(row.title ?? "").trim();
    if (!title) continue;
    const blob = [title, row.summary, row.angle, row.section].filter(Boolean).join(" ");
    out.push({
      match_type: "news_item",
      matched_id: String(row.id),
      matched_title: title,
      site_url: `${SITE_URL}/board/${row.id}`,
      blob,
    });
  }

  const { data: uap } = await admin
    .from("uap_sightings")
    .select("id, title, location_name, description, summary_brief")
    .gte("scraped_at", cutoff)
    .order("scraped_at", { ascending: false })
    .limit(80);

  for (const row of uap ?? []) {
    const title = String(row.title ?? "").trim();
    if (!title) continue;
    const blob = [title, row.location_name, row.summary_brief, row.description?.slice(0, 200)].filter(Boolean).join(" ");
    out.push({
      match_type: "uap_sighting",
      matched_id: String(row.id),
      matched_title: title,
      site_url: `${SITE_URL}/uap/${row.id}`,
      blob,
    });
  }

  const { data: blog } = await admin
    .from("generated_articles")
    .select("id, title, slug, excerpt")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(40);

  for (const row of blog ?? []) {
    const title = String(row.title ?? "").trim();
    const slug = String(row.slug ?? "").trim();
    if (!title || !slug) continue;
    out.push({
      match_type: "generated_article",
      matched_id: String(row.id),
      matched_title: title,
      site_url: `${SITE_URL}/blog/${slug}`,
      blob: [title, row.excerpt].filter(Boolean).join(" "),
    });
  }

  return out;
}

function bestMatch(
  reddit: RedditPostRow,
  candidates: SiteMatchCandidate[],
): { candidate: SiteMatchCandidate; score: number } | null {
  const query = `${reddit.title} ${reddit.summary}`;
  let best: { candidate: SiteMatchCandidate; score: number } | null = null;

  for (const c of candidates) {
    const score = overlapScore(c.blob, query);
    if (score >= MIN_MATCH_SCORE && (!best || score > best.score)) {
      best = { candidate: c, score };
    }
  }
  return best;
}

export async function runRedditRadarScan(): Promise<{
  ok: boolean;
  scanned: number;
  new_matches: number;
  skipped_existing: number;
  payload: { matches: RedditMatchRow[] };
}> {
  const admin = adminClient();
  const [posts, candidates] = await Promise.all([
    fetchRedditRadarPosts(),
    loadSiteCandidates(admin),
  ]);

  const { data: existingRows } = await admin
    .from("reddit_matches")
    .select("reddit_url")
    .gte("created_at", new Date(Date.now() - 7 * 24 * 3600_000).toISOString());

  const existingUrls = new Set((existingRows ?? []).map((r) => r.reddit_url));
  let newMatches = 0;
  let skippedExisting = 0;

  for (const post of posts) {
    if (existingUrls.has(post.url)) {
      skippedExisting++;
      continue;
    }
    const hit = bestMatch(post, candidates);
    if (!hit) continue;

    const { error } = await admin.from("reddit_matches").insert({
      reddit_url: post.url,
      reddit_title: post.title,
      subreddit: parseSubreddit(post.url) || post.subreddit,
      reddit_published_at: post.pubDate ? new Date(post.pubDate).toISOString() : null,
      match_type: hit.candidate.match_type,
      matched_id: hit.candidate.matched_id,
      matched_title: hit.candidate.matched_title,
      site_url: hit.candidate.site_url,
      match_score: hit.score,
      status: "pending",
    });

    if (!error) {
      newMatches++;
      existingUrls.add(post.url);
    }
  }

  const { data: recent } = await admin
    .from("reddit_matches")
    .select("*")
    .in("status", ["pending", "drafted"])
    .order("match_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  return {
    ok: true,
    scanned: posts.length,
    new_matches: newMatches,
    skipped_existing: skippedExisting,
    payload: { matches: (recent ?? []) as RedditMatchRow[] },
  };
}

const REDDIT_DRAFT_SYSTEM = `You are a Reddit community member who runs The Theorist — an AI-powered investigation platform for UAP, conspiracy, and outbreak intelligence.
Write Reddit reply drafts for a thread where someone is discussing a topic we already covered on our site.

Rules:
- Sound human, not promotional or bot-like
- Lead with value: a fact, angle, or insight from our coverage
- Mention The Theorist naturally once (not "check out our amazing platform")
- Include the site link once at the end
- Comment variants: 2–4 sentences, conversational
- Post variant: title under 120 chars, body 3–5 sentences
- NEVER spam, NEVER copy-paste marketing speak
- Match the subreddit tone (r/UFOs = curious/skeptical, r/conspiracy = analytical)

Return ONLY valid JSON:
{
  "comment_variants": [
    { "style": "helpful", "text": "comment without URL" },
    { "style": "investigative", "text": "comment without URL" }
  ],
  "post_variant": {
    "title": "post title",
    "body": "post body without URL"
  }
}`;

export type RedditDraftVariants = {
  comment_variants: Array<{ style: string; text: string; full_text: string }>;
  post_variant: { title: string; body: string; full_text: string };
};

export async function generateRedditDraft(matchId: string): Promise<{
  ok: boolean;
  match: RedditMatchRow;
  drafts: RedditDraftVariants;
}> {
  const admin = adminClient();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");

  const { data: match, error } = await admin
    .from("reddit_matches")
    .select("*")
    .eq("id", matchId)
    .single();

  if (error || !match) throw new Error("match_not_found");

  let context = "";
  if (match.match_type === "news_item" && match.matched_id) {
    const { data: article } = await admin
      .from("news_items")
      .select("title, summary, angle, score, section")
      .eq("id", match.matched_id)
      .maybeSingle();
    if (article) {
      context = `Our board analysis:\nTitle: ${article.title}\nSection: ${article.section}\nThreat score: ${article.score}%\nAngle: ${article.angle}\nSummary: ${article.summary}`;
    }
  } else if (match.match_type === "uap_sighting" && match.matched_id) {
    const { data: sighting } = await admin
      .from("uap_sightings")
      .select("title, location_name, summary_brief, description")
      .eq("id", match.matched_id)
      .maybeSingle();
    if (sighting) {
      context = `Our UAP dossier:\nTitle: ${sighting.title}\nLocation: ${sighting.location_name}\nBrief: ${sighting.summary_brief ?? sighting.description?.slice(0, 300)}`;
    }
  }

  const result = await callOpenAIJSON<{
    comment_variants: Array<{ style: string; text: string }>;
    post_variant: { title: string; body: string };
  }>({
    apiKey,
    system: REDDIT_DRAFT_SYSTEM,
    user: `Subreddit: r/${match.subreddit}\nReddit thread title: ${match.reddit_title}\nReddit URL: ${match.reddit_url}\nOur page: ${match.site_url}\nMatched article: ${match.matched_title}\n\n${context}`,
    maxTokens: 700,
    model: "gpt-4o-mini",
  });

  const drafts: RedditDraftVariants = {
    comment_variants: result.comment_variants.map((v) => ({
      style: v.style,
      text: v.text,
      full_text: `${v.text}\n\nWe dug into this on The Theorist: ${match.site_url}`,
    })),
    post_variant: {
      title: result.post_variant.title,
      body: result.post_variant.body,
      full_text: `${result.post_variant.title}\n\n${result.post_variant.body}\n\n${match.site_url}`,
    },
  };

  await admin
    .from("reddit_matches")
    .update({ draft_variants: drafts, status: "drafted" })
    .eq("id", matchId);

  return {
    ok: true,
    match: { ...match, draft_variants: drafts, status: "drafted" } as RedditMatchRow,
    drafts,
  };
}

export async function listRedditMatches(limit = 25): Promise<{
  pending_count: number;
  matches: RedditMatchRow[];
}> {
  const admin = adminClient();

  const { count } = await admin
    .from("reddit_matches")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const { data } = await admin
    .from("reddit_matches")
    .select("*")
    .in("status", ["pending", "drafted"])
    .order("match_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  return {
    pending_count: count ?? 0,
    matches: (data ?? []) as RedditMatchRow[],
  };
}

export async function updateRedditMatchStatus(
  matchId: string,
  status: "posted" | "dismissed",
): Promise<void> {
  const admin = adminClient();
  const { error } = await admin.from("reddit_matches").update({ status }).eq("id", matchId);
  if (error) throw new Error(error.message);
}
