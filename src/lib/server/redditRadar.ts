import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.the-theorist.com").replace(/\/$/, "");
const UA = "TheTheorist/1.0 (reddit-radar; +https://www.the-theorist.com)";

/** Investigation-relevant subreddits only — no generic news/hobby subs. */
export const REDDIT_RADAR_SUBS = [
  "UFOs",
  "HighStrangeness",
  "aliens",
  "conspiracy",
  "conspiracytheories",
  "Intelligence",
  "NSALeaks",
  "ufo",
  "UnresolvedMysteries",
  "UAP",
  "disclosure",
  "Glitch_in_the_Matrix",
  "CredibleDefense",
  "infectiousdisease",
] as const;

/** Subreddits that should never produce matches (consumer, sports, gaming, etc.). */
const SUBREDDIT_BLOCKLIST = new Set([
  "fuckamazon",
  "amazon",
  "printers",
  "techsupport",
  "greenbay",
  "nfl",
  "nba",
  "gaming",
  "games",
  "middleeastcrisis", // RTS game community, not geopolitics
  "prodromo",
  "lincolnproject",
  "globalnews",
  "mediatouch",
  "health",
  "science",
  "worldnews",
  "askreddit",
  "pics",
  "funny",
  "todayilearned",
]);

/** Title patterns that indicate off-topic / news-article / consumer content. */
const OFF_TOPIC_TITLE =
  /\b(printer|toner|amazon delivery|shipping date|dates don.t mean|green bay|packers|video game|steam sale|laptop|wifi router|customer service|refund|coupon|recipe|meme|today i learned|on this day|years ago|decades ago|throwback)\b/i;

/** Historical posts that aren't fresh discussion threads. */
const STALE_HISTORICAL =
  /\b(in 19\d{2}|in 20[01]\d|from 19\d{2}|from 20[01]\d|\b\d{4}:\s|a glimpse from the past)\b/i;

const MIN_MATCH_SCORE = 45;
const MIN_SEARCH_MATCH_SCORE = 40;
const MAX_POST_AGE_DAYS = 7;
const LOOKBACK_DAYS = 21;
const RSS_LIMIT = 10;
const SEARCH_CANDIDATE_MAX = 24;
const SEARCH_RESULTS_PER_QUERY = 8;

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
  "from", "is", "are", "was", "were", "be", "been", "has", "have", "had", "do", "does", "did",
  "will", "would", "could", "should", "may", "might", "must", "shall", "can", "need", "this",
  "that", "these", "those", "it", "its", "they", "them", "their", "we", "our", "you", "your",
  "he", "she", "his", "her", "who", "what", "when", "where", "why", "how", "not", "no", "yes",
  "all", "any", "some", "new", "says", "said", "after", "about", "into", "over", "just", "now",
  "report", "reports", "breaking", "update", "video", "watch", "live", "says", "amid", " amid",
]);

export type RedditPostRow = {
  title: string;
  url: string;
  subreddit: string;
  pubDate: string;
  summary: string;
  source: "feed_hot" | "feed_new" | "search";
  searchQuery?: string;
  linkedCandidate?: SiteMatchCandidate;
};

export type SiteMatchCandidate = {
  match_type: "news_item" | "uap_sighting" | "generated_article" | "outbreak";
  matched_id: string;
  matched_title: string;
  site_url: string;
  blob: string;
  search_query: string;
  priority: number;
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

export type RedditScanStats = {
  candidates_count: number;
  feed_posts: number;
  search_queries: number;
  search_posts: number;
  total_reddit_posts: number;
  new_matches: number;
  revived_matches: number;
  skipped_existing: number;
  below_threshold: number;
  insert_errors: number;
  purged: number;
};

function filterVisibleMatches(rows: RedditMatchRow[]): RedditMatchRow[] {
  return rows.filter(
    (m) =>
      m.match_type !== "insider_post" &&
      m.match_score >= MIN_MATCH_SCORE &&
      !isBlockedSubreddit(m.subreddit) &&
      !OFF_TOPIC_TITLE.test(m.reddit_title) &&
      !STALE_HISTORICAL.test(m.reddit_title) &&
      isInvestigationTopic(m.reddit_title, ""),
  );
}

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

const ENTITY_BOOST_TOKENS = [
  "uap", "ufo", "epstein", "maxwell", "grusch", "palantir", "disclosure",
  "whistleblow", "pentagon", "aaro", "conspiracy", "outbreak", "alien",
];

/** Weighted overlap — longer/rarer tokens count more. */
function overlapScore(siteBlob: string, redditText: string): number {
  const siteTokens = tokenize(siteBlob);
  const redditTokens = new Set(tokenize(redditText));
  if (siteTokens.length === 0 || redditTokens.size === 0) return 0;

  let hits = 0;
  let weight = 0;
  for (const w of siteTokens) {
    const wgt = w.length >= 6 ? 2 : 1;
    weight += wgt;
    if (redditTokens.has(w)) hits += wgt;
  }

  const base = Math.round((hits / Math.max(weight, 1)) * 100);

  const siteLower = siteBlob.toLowerCase();
  const redditLower = redditText.toLowerCase();
  let bonus = 0;
  for (const w of siteTokens) {
    if (w.length >= 5 && redditLower.includes(w)) bonus += 4;
  }
  for (const entity of ENTITY_BOOST_TOKENS) {
    if (siteLower.includes(entity) && redditLower.includes(entity)) bonus += 18;
  }
  if (siteLower.length >= 12 && redditLower.includes(siteLower.slice(0, 20))) bonus += 10;

  return Math.min(100, base + bonus);
}

function parseSubreddit(url: string): string {
  const m = url.match(/reddit\.com\/r\/([^/]+)/i);
  return m?.[1] ?? "unknown";
}

function normalizeSub(name: string): string {
  return name.replace(/^r\//i, "").toLowerCase();
}

function isBlockedSubreddit(subreddit: string): boolean {
  return SUBREDDIT_BLOCKLIST.has(normalizeSub(subreddit));
}

function isFreshPost(pubDate: string): boolean {
  if (!pubDate) return false;
  const ts = new Date(pubDate).getTime();
  if (Number.isNaN(ts)) return false;
  const maxAge = MAX_POST_AGE_DAYS * 24 * 3600_000;
  return Date.now() - ts <= maxAge;
}

function isInvestigationTopic(title: string, summary: string): boolean {
  const text = `${title} ${summary}`;
  if (OFF_TOPIC_TITLE.test(text)) return false;
  if (STALE_HISTORICAL.test(text)) return false;
  // Require at least one signal of investigatable content
  const INVESTIGATION_SIGNAL =
    /\b(ufo|uap|disclosure|cover.?up|whistleblow|leak|conspir|classified|pentagon|cia|nsa|fbi|sighting|encounter|outbreak|pandemic|virus|mystery|unexplained|document|hearing|testimony|investigat|timeline|contradict|insider|grusch|aaro|nuforc|epstein|maxwell|palantir|jeffrey|extraterrestrial|alien|nhi|non.?human)\b/i;
  return INVESTIGATION_SIGNAL.test(text);
}

function isAllowedForMatch(post: RedditPostRow): boolean {
  if (isBlockedSubreddit(post.subreddit)) return false;
  if (!isFreshPost(post.pubDate)) return false;
  if (!isInvestigationTopic(post.title, post.summary)) return false;
  return true;
}

function buildSearchQuery(title: string): string {
  const words = tokenize(title)
    .filter((w) => w.length >= 4)
    .slice(0, 5);
  if (words.length === 0) {
    return tokenize(title).slice(0, 3).join(" ");
  }
  return words.join(" ");
}

function parseRssEntries(xml: string, defaults: Partial<RedditPostRow>): RedditPostRow[] {
  const items: RedditPostRow[] = [];
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
    if (title && link) {
      items.push({
        title,
        url: link,
        subreddit: parseSubreddit(link) || defaults.subreddit || "unknown",
        pubDate: pub,
        summary,
        source: defaults.source ?? "feed_hot",
        searchQuery: defaults.searchQuery,
        linkedCandidate: defaults.linkedCandidate,
      });
    }
  }
  return items;
}

async function fetchRss(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/atom+xml, application/rss+xml, */*" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Subreddit hot + new feeds. */
export async function fetchRedditSubFeeds(): Promise<RedditPostRow[]> {
  const out: RedditPostRow[] = [];
  const seen = new Set<string>();

  for (const sub of REDDIT_RADAR_SUBS) {
    for (const sort of ["hot", "new"] as const) {
      const xml = await fetchRss(`https://www.reddit.com/r/${sub}/${sort}.rss?limit=${RSS_LIMIT}`);
      if (!xml) continue;
      for (const item of parseRssEntries(xml, {
        subreddit: sub,
        source: sort === "hot" ? "feed_hot" : "feed_new",
      })) {
        if (seen.has(item.url)) continue;
        if (isBlockedSubreddit(item.subreddit)) continue;
        if (!isFreshPost(item.pubDate)) continue;
        seen.add(item.url);
        out.push(item);
      }
    }
  }
  return out;
}

/** Site topic → Reddit search (reverse direction). */
async function fetchRedditSearchForCandidate(candidate: SiteMatchCandidate): Promise<RedditPostRow[]> {
  // Restrict search to investigation subs + last week only
  const subFilter = REDDIT_RADAR_SUBS.slice(0, 8)
    .map((s) => `subreddit:${s}`)
    .join(" OR ");
  const q = encodeURIComponent(`${candidate.search_query} (${subFilter})`);
  const xml = await fetchRss(
    `https://www.reddit.com/search.rss?q=${q}&sort=new&t=week&limit=${SEARCH_RESULTS_PER_QUERY}`,
  );
  if (!xml) return [];
  return parseRssEntries(xml, {
    source: "search",
    searchQuery: candidate.search_query,
    linkedCandidate: candidate,
  })
    .filter((p) => !isBlockedSubreddit(p.subreddit) && isFreshPost(p.pubDate))
    .slice(0, SEARCH_RESULTS_PER_QUERY);
}

async function loadOutbreakCandidates(): Promise<SiteMatchCandidate[]> {
  const admin = adminClient();
  const out: SiteMatchCandidate[] = [];
  try {
    const { data } = await admin
      .from("outbreak_cache")
      .select("data")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const outbreaks = (data?.data as { outbreaks?: Array<{ disease?: string; title?: string; description?: string }> })?.outbreaks ?? [];
    for (const ob of outbreaks.slice(0, 12)) {
      const title = String(ob.title ?? ob.disease ?? "").trim();
      const disease = String(ob.disease ?? title.split(/[—\-–]/)[0] ?? "").trim();
      if (!disease) continue;
      const blob = [disease, title, ob.description].filter(Boolean).join(" ");
      out.push({
        match_type: "outbreak",
        matched_id: disease.toLowerCase().replace(/\s+/g, "-"),
        matched_title: disease,
        site_url: `${SITE_URL}/outbreaks`,
        blob,
        search_query: `${disease} outbreak`,
        priority: 75,
      });
    }
  } catch {
    /* cache may not exist */
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
    .gte("score", 40)
    .order("score", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(120);

  for (const row of news ?? []) {
    const title = String(row.title ?? "").trim();
    if (!title) continue;
    const score = Number(row.score ?? 0);
    const blob = [title, row.summary, row.angle, row.section].filter(Boolean).join(" ");
    out.push({
      match_type: "news_item",
      matched_id: String(row.id),
      matched_title: title,
      site_url: `${SITE_URL}/board/${row.id}`,
      blob,
      search_query: buildSearchQuery(title),
      priority: score,
    });
  }

  const { data: uap } = await admin
    .from("uap_sightings")
    .select("id, title, location_name, description, summary_brief")
    .gte("scraped_at", cutoff)
    .order("scraped_at", { ascending: false })
    .limit(60);

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
      search_query: buildSearchQuery(`${title} ${row.location_name ?? ""}`),
      priority: 65,
    });
  }

  const { data: blog } = await admin
    .from("generated_articles")
    .select("id, title, slug, excerpt")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(30);

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
      search_query: buildSearchQuery(title),
      priority: 62,
    });
  }

  const outbreak = await loadOutbreakCandidates();
  out.push(...outbreak);

  return out.sort((a, b) => b.priority - a.priority);
}

function pickSearchCandidates(candidates: SiteMatchCandidate[]): SiteMatchCandidate[] {
  const seen = new Set<string>();
  const out: SiteMatchCandidate[] = [];
  for (const c of candidates) {
    const key = c.search_query.toLowerCase();
    if (!key || key.length < 4 || seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= SEARCH_CANDIDATE_MAX) break;
  }
  return out;
}

function resolveMatch(
  post: RedditPostRow,
  candidates: SiteMatchCandidate[],
): { candidate: SiteMatchCandidate; score: number } | null {
  const redditText = `${post.title} ${post.summary}`;

  // Search results carry a linked candidate — still require real token overlap.
  // Previously this auto-matched ANY search hit to the triggering article (bug).
  if (post.linkedCandidate) {
    const score = overlapScore(post.linkedCandidate.blob, redditText);
    if (score < MIN_SEARCH_MATCH_SCORE) return null;
    return { candidate: post.linkedCandidate, score };
  }

  let best: { candidate: SiteMatchCandidate; score: number } | null = null;
  for (const c of candidates) {
    const score = overlapScore(c.blob, redditText);
    if (score >= MIN_MATCH_SCORE && (!best || score > best.score)) {
      best = { candidate: c, score };
    }
  }
  return best;
}

/** Dismiss legacy insider_post matches — tweets are not linkable Reddit coverage. */
async function purgeInsiderPostMatches(admin: SupabaseClient): Promise<number> {
  const { data: rows } = await admin
    .from("reddit_matches")
    .select("id")
    .eq("match_type", "insider_post")
    .in("status", ["pending", "drafted"])
    .limit(200);

  const ids = (rows ?? []).map((r) => r.id);
  if (ids.length === 0) return 0;

  for (let i = 0; i < ids.length; i += 50) {
    await admin
      .from("reddit_matches")
      .update({ status: "dismissed" })
      .in("id", ids.slice(i, i + 50));
  }
  return ids.length;
}

/** Auto-dismiss existing pending matches that fail current quality gates. */
async function purgeIrrelevantMatches(admin: SupabaseClient): Promise<number> {
  const insiderPurged = await purgeInsiderPostMatches(admin);

  const { data: rows } = await admin
    .from("reddit_matches")
    .select("id, reddit_title, subreddit, match_score, reddit_published_at, match_type")
    .in("status", ["pending", "drafted"])
    .limit(200);

  const toDismiss: string[] = [];
  for (const row of rows ?? []) {
    const sub = String(row.subreddit ?? "");
    const title = String(row.reddit_title ?? "");
    const score = Number(row.match_score ?? 0);
    const pub = row.reddit_published_at ? String(row.reddit_published_at) : "";

    if (isBlockedSubreddit(sub)) {
      toDismiss.push(row.id);
      continue;
    }
    if (score < MIN_MATCH_SCORE) {
      toDismiss.push(row.id);
      continue;
    }
    if (OFF_TOPIC_TITLE.test(title) || STALE_HISTORICAL.test(title)) {
      toDismiss.push(row.id);
      continue;
    }
    if (pub && !isFreshPost(pub)) {
      toDismiss.push(row.id);
      continue;
    }
    if (!isInvestigationTopic(title, "")) {
      toDismiss.push(row.id);
    }
  }

  if (toDismiss.length === 0) return insiderPurged;

  for (let i = 0; i < toDismiss.length; i += 50) {
    const batch = toDismiss.slice(i, i + 50);
    await admin.from("reddit_matches").update({ status: "dismissed" }).in("id", batch);
  }
  return insiderPurged + toDismiss.length;
}

export async function runRedditRadarScan(): Promise<{
  ok: boolean;
  stats: RedditScanStats;
  payload: { matches: RedditMatchRow[] };
}> {
  const admin = adminClient();
  const purged = await purgeIrrelevantMatches(admin);
  const candidates = await loadSiteCandidates(admin);
  const searchCandidates = pickSearchCandidates(candidates);

  const [feedPosts, ...searchBatches] = await Promise.all([
    fetchRedditSubFeeds(),
    ...searchCandidates.map((c) => fetchRedditSearchForCandidate(c)),
  ]);

  const searchPosts = searchBatches.flat();
  const allPosts: RedditPostRow[] = [];
  const seenUrls = new Set<string>();

  for (const p of [...searchPosts, ...feedPosts]) {
    if (seenUrls.has(p.url)) continue;
    seenUrls.add(p.url);
    allPosts.push(p);
  }

  const { data: existingRows } = await admin
    .from("reddit_matches")
    .select("id, reddit_url, status")
    .gte("created_at", new Date(Date.now() - 14 * 24 * 3600_000).toISOString());

  const activeUrls = new Set<string>();
  const dismissedByUrl = new Map<string, string>();
  for (const row of existingRows ?? []) {
    const url = String(row.reddit_url ?? "");
    if (!url) continue;
    if (row.status === "dismissed") dismissedByUrl.set(url, String(row.id));
    else activeUrls.add(url);
  }

  let newMatches = 0;
  let revivedMatches = 0;
  let skippedExisting = 0;
  let belowThreshold = 0;
  let insertErrors = 0;

  for (const post of allPosts) {
    if (activeUrls.has(post.url)) {
      skippedExisting++;
      continue;
    }

    if (!isAllowedForMatch(post)) {
      belowThreshold++;
      continue;
    }

    const hit = resolveMatch(post, candidates);
    if (!hit) {
      belowThreshold++;
      continue;
    }

    const minRequired = post.source === "search" ? MIN_SEARCH_MATCH_SCORE : MIN_MATCH_SCORE;
    if (hit.score < minRequired) {
      belowThreshold++;
      continue;
    }

    const row = {
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
      draft_variants: null,
    };

    const dismissedId = dismissedByUrl.get(post.url);
    if (dismissedId) {
      const { error } = await admin.from("reddit_matches").update(row).eq("id", dismissedId);
      if (error) {
        insertErrors++;
        continue;
      }
      revivedMatches++;
      activeUrls.add(post.url);
      continue;
    }

    const { error } = await admin.from("reddit_matches").insert(row);

    if (error) {
      insertErrors++;
      continue;
    }
    newMatches++;
    activeUrls.add(post.url);
  }

  const { data: recent } = await admin
    .from("reddit_matches")
    .select("*")
    .in("status", ["pending", "drafted"])
    .order("match_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(30);

  const stats: RedditScanStats = {
    candidates_count: candidates.length,
    feed_posts: feedPosts.length,
    search_queries: searchCandidates.length,
    search_posts: searchPosts.length,
    total_reddit_posts: allPosts.length,
    new_matches: newMatches,
    revived_matches: revivedMatches,
    skipped_existing: skippedExisting,
    below_threshold: belowThreshold,
    insert_errors: insertErrors,
    purged,
  };

  return {
    ok: true,
    stats,
    payload: { matches: filterVisibleMatches((recent ?? []) as RedditMatchRow[]) },
  };
}

const REDDIT_LINK_CLOSERS = [
  "full breakdown here if useful:",
  "we mapped it here:",
  "more detail on our board:",
  "thread breakdown:",
  "if anyone wants the docs angle:",
  "pulled the sources together here:",
];

const REDDIT_LINK_CLOSERS_SHORT = [
  "here:",
  "more:",
  "breakdown:",
  "if useful:",
];

function appendRedditLink(text: string, url: string, short = false): string {
  const trimmed = text.trim();
  const closers = short ? REDDIT_LINK_CLOSERS_SHORT : REDDIT_LINK_CLOSERS;
  const closer = closers[Math.floor(Math.random() * closers.length)];
  return `${trimmed} ${closer} ${url}`;
}

const REDDIT_DRAFT_SYSTEM = `You write Reddit comment drafts as a regular person who follows UAP, conspiracy, and outbreak news — not as a brand or PR account.
Someone posted a thread about a topic we already covered. Add one concrete angle from our coverage that the thread is missing or glossing over.

Voice:
- Talk like a real Redditor: direct, casual, first-person when natural ("I", "we" sparingly)
- Short sentences. No essay tone. No corporate polish.
- Lead with ONE specific fact, doc gap, or angle — not a vague thesis
- Do NOT mention "The Theorist" by name unless it fits naturally (usually skip the brand entirely)
- Do NOT include any URL — we append the link separately

Banned phrases (never use):
- "It's interesting to see"
- "Our analysis highlights"
- "raises questions about"
- "transparency and accountability"
- "We dug into this"
- "check out our platform"
- "AI-powered investigation platform"
- any marketing or press-release language

Length:
- "normal" variant: 2–3 sentences — conversational, one concrete angle
- "short" variant: 1 sentence (2 max) — punchy, thread-native, no filler
- Post variant: title under 120 chars; body 3–4 short sentences

Subreddit tone:
- r/UFOs — curious, skeptical, not preachy
- r/conspiracy — doc-first, "here's what the paperwork actually says"
- r/worldnews / r/news — fact first, minimal opinion
- default — plain and helpful

Return ONLY valid JSON:
{
  "comment_variants": [
    { "style": "normal", "text": "comment without URL" },
    { "style": "short", "text": "comment without URL" }
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
  if (match.match_type === "insider_post") {
    throw new Error("insider_post_not_supported — promote the tweet to board first");
  }

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
  } else if (match.match_type === "outbreak") {
    context = `Our Outbreak Tracker covers ${match.matched_title} with live WHO/ProMED signals, conspiracy scoring, and local news feeds.`;
  } else if (match.match_type === "generated_article" && match.matched_id) {
    const { data: art } = await admin
      .from("generated_articles")
      .select("title, excerpt")
      .eq("id", match.matched_id)
      .maybeSingle();
    if (art) context = `Our investigative report:\nTitle: ${art.title}\nExcerpt: ${art.excerpt}`;
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
      full_text: appendRedditLink(v.text, match.site_url, v.style === "short"),
    })),
    post_variant: {
      title: result.post_variant.title,
      body: result.post_variant.body,
      full_text: `${result.post_variant.title}\n\n${appendRedditLink(result.post_variant.body, match.site_url)}`,
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
  await purgeIrrelevantMatches(admin);

  const { count } = await admin
    .from("reddit_matches")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const { data } = await admin
    .from("reddit_matches")
    .select("*")
    .in("status", ["pending", "drafted"])
    .gte("match_score", MIN_MATCH_SCORE)
    .order("match_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  const matches = filterVisibleMatches((data ?? []) as RedditMatchRow[]);

  return {
    pending_count: count ?? 0,
    matches,
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
