import { NextRequest, NextResponse } from "next/server";

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
  const res = await fetch(`${GAMMA}/markets?active=true&closed=false&limit=200&order=volume&ascending=false`, {
    headers: { "User-Agent": "TheTheorist/1.0" }, signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`PM HTTP ${res.status}`);
  const data: PM[] = await res.json();
  cache = { data, ts: Date.now() };
  return data;
}

function parsePrices(s: string): number[] { try { return JSON.parse(s).map(Number); } catch { return []; } }
function parseOutcomes(s: string): string[] { try { return JSON.parse(s); } catch { return ["Yes","No"]; } }

function score(m: PM, kws: string[]): number {
  const t = `${m.question} ${m.description??""} ${m.groupItemTitle??""}`.toLowerCase();
  return kws.reduce((acc, kw) => acc + (t.includes(kw) ? (kw.length > 4 ? 3 : 1) : 0), 0);
}

export async function GET(req: NextRequest) {
  try {
    const q = new URL(req.url).searchParams.get("q") ?? "";
    if (!q.trim()) return NextResponse.json({ markets: [] });
    const kws = q.toLowerCase().split(/[\s,\-\.]+/).filter(w => w.length > 2 && !["the","and","for","are","was","with","this","that","from"].includes(w));
    const all = await fetchMarkets();
    const results = all.map(m => ({ ...m, _s: score(m, kws) })).filter(m => m._s > 0).sort((a,b) => b._s - a._s || b.volume - a.volume).slice(0,5).map(m => {
      const prices = parsePrices(m.outcomePrices);
      const outcomes = parseOutcomes(m.outcomes);
      const yi = outcomes.findIndex(o => o.toLowerCase() === "yes");
      const yp = yi >= 0 ? prices[yi] : prices[0];
      const np = yi >= 0 ? prices[yi===0?1:0] : prices[1];
      return { id:m.id, question:m.question, slug:m.slug, outcomes, prices, yesPrice:Math.round((yp??0)*100), noPrice:Math.round((np??0)*100), volume:Math.round(m.volume??0), volume24h:Math.round(m.volume24hr??0), liquidity:Math.round(m.liquidity??0), endDate:m.endDate, url:`https://polymarket.com/event/${m.events?.[0]?.slug??m.slug}` };
    });
    return NextResponse.json({ markets: results });
  } catch(e) {
    return NextResponse.json({ markets:[], error:String(e) });
  }
}
