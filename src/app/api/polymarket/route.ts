import { NextRequest, NextResponse } from "next/server";
import { callOpenAIJSON } from "@/lib/openai";

const GAMMA = "https://gamma-api.polymarket.com";

interface PM {
  id: string; question: string; description?: string; slug: string;
  conditionId: string; outcomePrices: string; outcomes: string;
  volume: number; volume24hr: number; liquidity: number;
  active: boolean; closed: boolean; endDate: string;
  groupItemTitle?: string; events?: Array<{ slug: string; title: string }>;
}

// ── Cache: 4 pages × 500 markets = up to 2000 markets, refreshed every 15 min ──
let cache: { data: PM[]; ts: number } | null = null;

async function fetchPage(offset: number): Promise<PM[]> {
  try {
    const res = await fetch(
      `${GAMMA}/markets?active=true&closed=false&limit=500&order=volume&ascending=false&offset=${offset}`,
      { headers: { "User-Agent": "TheTheorist/1.0" }, signal: AbortSignal.timeout(10000) }
    );
    if (!res.ok) return [];
    return (await res.json()) as PM[];
  } catch {
    return [];
  }
}

async function fetchAllMarkets(): Promise<PM[]> {
  if (cache && Date.now() - cache.ts < 900_000) return cache.data;
  // Fetch 4 pages in parallel — covers ~2000 markets instead of just 200
  const pages = await Promise.all([0, 500, 1000, 1500].map(fetchPage));
  const data = pages.flat();
  cache = { data, ts: Date.now() };
  return data;
}

// ── Keyword extraction ────────────────────────────────────────────────────────

/** Synonyms / related terms to broaden keyword matching */
const SYNONYMS: Record<string, string[]> = {
  hungary: ["hungarian", "orbán", "orban", "budapest", "fidesz", "lázár", "lazar", "magyar"],
  orbán: ["orban", "hungary", "hungarian", "fidesz", "viktor"],
  orban: ["orbán", "hungary", "hungarian", "fidesz", "viktor"],
  "magyar péter": ["hungarian", "hungary", "orbán", "fidesz"],
  russia: ["russian", "putin", "kremlin", "moscow", "ukraine", "zelenskyy"],
  ukraine: ["ukrainian", "zelenskyy", "zelensky", "russia", "kyiv"],
  china: ["chinese", "xi jinping", "beijing", "ccp"],
  usa: ["united states", "american", "trump", "washington", "congress"],
  "united states": ["american", "trump", "us government", "congress"],
  iran: ["iranian", "tehran", "nuclear"],
  ufo: ["uap", "extraterrestrial", "disclosure", "pentagon", "alien"],
  uap: ["ufo", "extraterrestrial", "disclosure", "pentagon"],
  hantavirus: ["hanta", "virus outbreak", "lab leak", "pandemic"],
  hanta: ["hantavirus", "virus", "outbreak"],
  ai: ["artificial intelligence", "openai", "gpt", "chatgpt", "llm"],
  bitcoin: ["btc", "crypto", "cryptocurrency"],
  pandemic: ["outbreak", "virus", "who", "epidemic"],
  cia: ["intelligence", "fbi", "nsa", "classified"],
  nato: ["alliance", "military", "western defense"],
};

function extractKeywords(query: string): string[] {
  const lower = query.toLowerCase();
  // Tokenise: keep 1-word and 2-word tokens
  const words = lower
    .replace(/[^a-zéáőúüöíó0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }

  const tokens = [...new Set([...words, ...bigrams])];
  const extra: string[] = [];
  for (const t of tokens) {
    const syns = SYNONYMS[t] ?? [];
    extra.push(...syns);
  }
  // Also add the full normalised query for substring matching
  extra.push(lower);

  return [...new Set([...tokens, ...extra])].filter((k) => k.length > 2);
}

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "with", "by", "from", "is", "was", "are", "were", "be", "been", "has", "have",
  "had", "will", "would", "could", "should", "may", "might", "can", "that",
  "this", "it", "its", "he", "she", "they", "we", "you", "as", "up", "do",
  "did", "so", "if", "not", "no", "new", "over", "after", "about", "more",
  "says", "said", "than", "into", "under", "first", "last", "also",
]);

// ── Pre-filter markets by keyword ─────────────────────────────────────────────

function preFilter(markets: PM[], keywords: string[]): PM[] {
  if (!keywords.length) return markets.slice(0, 60);
  return markets.filter((m) => {
    const haystack = (m.question + " " + (m.description ?? "")).toLowerCase();
    return keywords.some((k) => haystack.includes(k));
  });
}

// ── URL builder ───────────────────────────────────────────────────────────────

function buildUrl(m: PM): string {
  const eventSlug = m.events?.[0]?.slug;
  if (eventSlug) return `https://polymarket.com/event/${eventSlug}`;
  if (m.slug) return `https://polymarket.com/event/${m.slug}`;
  return `https://polymarket.com/markets?q=${encodeURIComponent(m.question.slice(0, 50))}`;
}

function parsePrices(s: string): number[] {
  try { return JSON.parse(s).map(Number); } catch { return [0.5, 0.5]; }
}
function parseOutcomes(s: string): string[] {
  try { return JSON.parse(s); } catch { return ["Yes", "No"]; }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    if (!q.trim()) return NextResponse.json({ markets: [] });

    const all = await fetchAllMarkets();

    // Step 1: keyword pre-filter across all 2000 markets
    const keywords = extractKeywords(q);
    const candidates = preFilter(all, keywords);

    // If no keyword hits, fall back to top-60 by volume so GPT has something to work with
    const pool = candidates.length > 0 ? candidates : all.slice(0, 60);

    if (!pool.length) return NextResponse.json({ markets: [] });

    // Step 2: GPT relevance ranking on the filtered pool (max 60 items to keep prompt small)
    const poolSlice = pool.slice(0, 60);
    const marketList = poolSlice.map((m, i) => `${i}: ${m.question}`).join("\n");

    const result = await callOpenAIJSON<{ relevant: Array<{ index: number; reason: string }> }>({
      apiKey: process.env.OPENAI_API_KEY!,
      system: `You are a relevance matcher for a news intelligence platform. Given an article topic and a list of prediction markets, find markets that are genuinely related to the article.

RULES:
- Prefer markets about the same country, person, organisation, or event as the article
- A market about "Will Hungary's PM change?" is relevant for any article about Hungarian politics
- A market about "Hantavirus lab leak confirmed?" is relevant for any article about hantavirus
- Be moderately inclusive — if there is a thematic connection, include it
- Return 1–4 markets. If nothing is related at all, return empty array.

Return ONLY valid JSON: {"relevant": [{"index": 0, "reason": "one-line reason"}]}`,
      user: `Article topic: "${q}"\n\nMarkets:\n${marketList}`,
      maxTokens: 400,
      model: "gpt-4o-mini",
    });

    const relevant = (result.relevant ?? []).slice(0, 4);
    if (!relevant.length) return NextResponse.json({ markets: [] });

    const markets = relevant.map(({ index }) => {
      const m = poolSlice[index];
      if (!m) return null;
      const prices = parsePrices(m.outcomePrices);
      const outcomes = parseOutcomes(m.outcomes);
      const yi = outcomes.findIndex((o) => o.toLowerCase() === "yes");
      const yp = yi >= 0 ? prices[yi] : prices[0] ?? 0.5;
      const np = yi >= 0 ? prices[yi === 0 ? 1 : 0] : prices[1] ?? 0.5;
      return {
        id: m.id,
        question: m.question,
        slug: m.slug,
        outcomes,
        yesPrice: Math.round(yp * 100),
        noPrice: Math.round(np * 100),
        volume: Math.round(m.volume ?? 0),
        volume24h: Math.round(m.volume24hr ?? 0),
        liquidity: Math.round(m.liquidity ?? 0),
        endDate: m.endDate,
        url: buildUrl(m),
      };
    }).filter(Boolean);

    return NextResponse.json({ markets, debug: { total: all.length, candidates: candidates.length, keywords } });
  } catch (e) {
    console.error("[polymarket]", e);
    return NextResponse.json({ markets: [], error: String(e) });
  }
}
