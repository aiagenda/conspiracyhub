import { NextRequest, NextResponse } from "next/server";
import { callOpenAIJSON } from "@/lib/openai";

const GAMMA = "https://gamma-api.polymarket.com";
let cache: { data: PM[]; ts: number } | null = null;

interface PM {
  id: string; question: string; description?: string; slug: string;
  conditionId: string; outcomePrices: string; outcomes: string;
  volume: number; volume24hr: number; liquidity: number;
  active: boolean; closed: boolean; endDate: string;
  groupItemTitle?: string; events?: Array<{ slug: string; title: string }>;
}

async function fetchMarkets(): Promise<PM[]> {
  if (cache && Date.now() - cache.ts < 900_000) return cache.data;
  const res = await fetch(
    `${GAMMA}/markets?active=true&closed=false&limit=200&order=volume&ascending=false`,
    { headers: { "User-Agent": "TheTheorist/1.0" }, signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`PM HTTP ${res.status}`);
  const data: PM[] = await res.json();
  cache = { data, ts: Date.now() };
  return data;
}

function parsePrices(s: string): number[] {
  try { return JSON.parse(s).map(Number); } catch { return [0.5, 0.5]; }
}
function parseOutcomes(s: string): string[] {
  try { return JSON.parse(s); } catch { return ["Yes", "No"]; }
}

// Build Polymarket URL - try multiple formats
function buildUrl(m: PM): string {
  const eventSlug = m.events?.[0]?.slug;
  if (eventSlug) return `https://polymarket.com/event/${eventSlug}`;
  if (m.slug) return `https://polymarket.com/event/${m.slug}`;
  // fallback: search on polymarket
  const q = encodeURIComponent(m.question.slice(0, 50));
  return `https://polymarket.com/markets?q=${q}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q") ?? "";
    if (!q.trim()) return NextResponse.json({ markets: [] });

    const all = await fetchMarkets();

    // Use GPT to find truly relevant markets — not keyword matching
    const marketList = all.slice(0, 100).map((m, i) => `${i}: ${m.question}`).join("\n");

    const result = await callOpenAIJSON<{ relevant: Array<{ index: number; reason: string }> }>({
      apiKey: process.env.OPENAI_API_KEY!,
      system: `You are a relevance matcher. Given an article topic and a list of prediction markets, find markets that are GENUINELY relevant to the article topic. 
      
      STRICT RULES:
      - Only return markets directly related to the article's specific topic
      - If the article is about AI self-replication, only return AI-related markets
      - If about a specific country/person/event, only return markets about that exact topic
      - Maximum 3 markets, minimum 0 (return empty array if nothing is truly relevant)
      - Do NOT return loosely related markets
      
      Return ONLY valid JSON: {"relevant": [{"index": 0, "reason": "why this is relevant"}]}`,
      user: `Article topic: "${q}"\n\nMarkets:\n${marketList}`,
      maxTokens: 400,
      model: "gpt-4o-mini",
    });

    const relevant = (result.relevant ?? []).slice(0, 3);
    if (!relevant.length) return NextResponse.json({ markets: [] });

    const markets = relevant.map(({ index }) => {
      const m = all[index];
      if (!m) return null;
      const prices = parsePrices(m.outcomePrices);
      const outcomes = parseOutcomes(m.outcomes);
      const yi = outcomes.findIndex(o => o.toLowerCase() === "yes");
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

    return NextResponse.json({ markets });
  } catch (e) {
    console.error("[polymarket]", e);
    return NextResponse.json({ markets: [], error: String(e) });
  }
}
