import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";
import { SYSTEM_SCORE } from "@/lib/prompts";

export const maxDuration = 300; // 5 min – Vercel Pro max for cron routes

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

function parsePublishedAt(raw: string): string {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

interface Article {
  guardian_id: string;
  title: string;
  summary: string;
  url: string;
  image: string | null;
  date: string;
  section: string;
  source: string;
}

// ── GENERIC RSS FETCHER ───────────────────────────────────────────────────────

async function fetchRSS(feedUrl: string, sourceId: string, section: string): Promise<Article[]> {
  try {
    const res = await fetch(feedUrl, {
      headers: { "User-Agent": "TheTheorist/1.0 (+https://conspiracyhub.vercel.app)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const results: Article[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const x = m[1];
      const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
      const link =
        x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ??
        x.match(/<link[^>]+href="([^"]+)"/)?.[1]?.trim() ??
        "";
      const desc =
        x
          .match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]
          ?.replace(/<[^>]+>/g, "")
          .trim()
          .slice(0, 200) ?? "";
      const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
      if (title && link && link.startsWith("http")) {
        const idBase = Buffer.from(link).toString("base64").slice(0, 32);
        results.push({
          guardian_id: `${sourceId}-${idBase}`,
          title,
          summary: desc,
          url: link,
          image: null,
          date: pub || new Date().toISOString(),
          section,
          source: sourceId,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ── SOURCES ───────────────────────────────────────────────────────────────────

async function fetchGuardian(): Promise<Article[]> {
  const sections = [
    "technology", "science", "world", "politics", "environment",
    "society", "uk", "us-news", "global-development",
  ];
  const results: Article[] = [];
  const key = process.env.GUARDIAN_API_KEY;
  if (!key) return results;
  for (const section of sections) {
    try {
      const url = `https://content.guardianapis.com/search?section=${section}&show-fields=headline,trailText,thumbnail,webUrl,webPublicationDate&page-size=10&api-key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      for (const a of data?.response?.results ?? []) {
        const row = a as {
          id?: string;
          webTitle?: string;
          webUrl?: string;
          webPublicationDate?: string;
          fields?: { trailText?: string; thumbnail?: string };
        };
        const fields = row.fields;
        results.push({
          guardian_id: String(row.id ?? ""),
          title: String(row.webTitle ?? ""),
          summary: fields?.trailText ?? "",
          url: String(row.webUrl ?? ""),
          image: fields?.thumbnail ?? null,
          date: String(row.webPublicationDate ?? new Date().toISOString()),
          section: String(section),
          source: "guardian",
        });
      }
    } catch {
      /* skip section */
    }
  }
  return results;
}

async function fetchGoogleNews(): Promise<Article[]> {
  const queries = [
    "government secret program declassified",
    "whistleblower leaked document classified",
    "surveillance mass data collection",
    "UFO UAP Pentagon disclosure",
    "bioweapon lab origin outbreak",
    "CIA NSA DARPA project classified",
    "corporate conspiracy fraud cover-up",
    "AI artificial intelligence control regulation",
    "vaccine patent pharmaceutical secret",
    "military industrial complex contract",
    "Pentagon classified program exposed",
    "government surveillance program NSA",
    "secret military technology DARPA",
    "shadow government deep state",
    "big pharma clinical trial hidden data",
    "oligarch corruption money laundering investigation",
    "disinformation propaganda operation exposed",
    "nuclear program secret facility",
    "spy satellite surveillance program revealed",
    "dark money political influence operation",
  ];
  const results: Article[] = [];
  for (const q of queries) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en&num=5`;
      const res = await fetch(url, {
        headers: { "User-Agent": "TheTheorist/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const x = m[1];
        const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
        const link = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
        const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
        const src = x.match(/<source[^>]*>(.*?)<\/source>/)?.[1]?.trim() ?? "";
        if (title && link && link.startsWith("http")) {
          const idBase = Buffer.from(link).toString("base64").slice(0, 32);
          results.push({
            guardian_id: `gnews-${idBase}`,
            title,
            summary: "",
            url: link,
            image: null,
            date: pub || new Date().toISOString(),
            section: q.split(" ")[0] ?? "news",
            source: src ? `gnews:${src}` : "gnews",
          });
        }
      }
    } catch {
      /* skip query */
    }
  }
  return results;
}

async function fetchReddit(): Promise<Article[]> {
  const subs = ["UFOs", "conspiracy", "worldnews", "technology", "politics", "Intelligence", "cia", "NSALeaks"];
  const results: Article[] = [];
  for (const sub of subs) {
    try {
      const res = await fetch(`https://www.reddit.com/r/${sub}/hot.rss?limit=10`, {
        headers: { "User-Agent": "TheTheorist/1.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
        const x = m[1];
        const title = x.match(/<title[^>]*>(.*?)<\/title>/)?.[1]?.trim() ?? "";
        const link = x.match(/href="(https:\/\/www\.reddit\.com\/r\/[^"]+)"/)?.[1] ?? "";
        const pub = x.match(/<updated>(.*?)<\/updated>/)?.[1] ?? "";
        const summary =
          x.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]
            ?.replace(/<[^>]+>/g, "")
            .trim()
            .slice(0, 200) ?? "";
        if (title && link) {
          const idBase = Buffer.from(link).toString("base64").slice(0, 32);
          results.push({
            guardian_id: `reddit-${idBase}`,
            title,
            summary,
            url: link,
            image: null,
            date: pub || new Date().toISOString(),
            section: sub,
            source: `reddit:r/${sub}`,
          });
        }
      }
    } catch {
      /* skip sub */
    }
  }
  return results;
}

// ── RSS SOURCES ───────────────────────────────────────────────────────────────

const RSS_SOURCES: Array<{ url: string; id: string; section: string }> = [
  // Existing
  { url: "https://www.muckrock.com/news/rss/", id: "muckrock", section: "foia" },
  { url: "https://theintercept.com/feed/?lang=en", id: "the-intercept", section: "investigative" },
  // Investigative journalism
  { url: "https://feeds.propublica.org/propublica/main", id: "propublica", section: "investigative" },
  { url: "https://www.bellingcat.com/feed/", id: "bellingcat", section: "investigative" },
  { url: "https://themarkup.org/feed/rss", id: "the-markup", section: "technology" },
  // Privacy / surveillance
  { url: "https://www.eff.org/rss/updates.xml", id: "eff", section: "surveillance" },
  // Organised crime / corruption
  { url: "https://www.occrp.org/en/component/obrss/occrp-investigative-stories?format=feed&type=rss", id: "occrp", section: "corruption" },
  // Whistleblowing / gov accountability
  { url: "https://whistleblower.org/feed/", id: "gapwhistleblower", section: "whistleblower" },
  // Science / health
  { url: "https://www.commondreams.org/rss.xml", id: "commondreams", section: "society" },
];

// ── SCRAPER CORE ──────────────────────────────────────────────────────────────

export async function runScraper(openAiKey: string) {
  if (!process.env.GUARDIAN_API_KEY) {
    console.warn("[scraper] GUARDIAN_API_KEY missing — Guardian section skipped");
  }

  const admin = getAdmin();

  // ── 1. Cleanup: remove articles older than 7 days ─────────────────────────
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { count } = await admin.from("news_items").delete({ count: "exact" }).lt("published_at", cutoff);
    console.log(`[scraper] Cleaned up ${count ?? 0} articles older than 7 days`);
  } catch {
    console.warn("[scraper] Cleanup failed (non-fatal)");
  }

  // ── 2. Fetch all sources in parallel ─────────────────────────────────────
  const rssResults = await Promise.all(RSS_SOURCES.map((s) => fetchRSS(s.url, s.id, s.section)));
  const [guardian, gnews, reddit] = await Promise.all([
    fetchGuardian(),
    fetchGoogleNews(),
    fetchReddit(),
  ]);

  const all = [
    ...guardian,
    ...gnews,
    ...reddit,
    ...rssResults.flat(),
  ];
  console.log(`[scraper] Fetched ${all.length} total articles from ${3 + RSS_SOURCES.length} sources`);

  // ── 3. Dedup against existing DB ─────────────────────────────────────────
  const existing = new Set<string>();
  try {
    const { data } = await admin.from("news_items").select("guardian_id").limit(5000);
    (data ?? []).forEach((r: { guardian_id: string }) => existing.add(r.guardian_id));
  } catch {
    /* table missing handled below */
  }

  // Cap at 60 new articles per run to stay within function timeout
  const fresh = all.filter((a) => a.guardian_id && !existing.has(a.guardian_id)).slice(0, 60);
  console.log(`[scraper] ${fresh.length} new articles to score`);

  if (!fresh.length) {
    return { inserted: 0, skipped: all.length, total_fetched: all.length, timestamp: new Date().toISOString() };
  }

  // ── 4. Score in batches of 20 ─────────────────────────────────────────────
  const BATCH = 20;
  let inserted = 0;
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  for (let i = 0; i < fresh.length; i += BATCH) {
    const batch = fresh.slice(i, i + BATCH);
    const headlines = batch.map((a, j) => `${j}: ${a.title}`).join("\n");
    try {
      const scored = await callOpenAIJSON<{ scores: Array<{ index: number; score: number; angle: string }> }>({
        apiKey: openAiKey,
        system: SYSTEM_SCORE,
        user: `Score these headlines:\n${headlines}`,
        maxTokens: 800,
        model: "gpt-4o-mini",
      });
      const scoreMap: Record<number, { score: number; angle: string }> = {};
      (scored.scores ?? []).forEach((s) => {
        scoreMap[s.index] = { score: s.score, angle: s.angle };
      });

      const toInsert = batch
        .map((a, j) => ({ ...a, score: scoreMap[j]?.score ?? 0, angle: scoreMap[j]?.angle ?? "" }))
        .filter((a) => a.score >= 55);

      if (toInsert.length) {
        const rows = toInsert.map((a) => ({
          guardian_id: a.guardian_id,
          title: a.title,
          summary: a.summary,
          url: a.url,
          image: a.image,
          published_at: parsePublishedAt(a.date),
          section: a.section,
          score: a.score,
          angle: a.angle,
          source: a.source,
        }));
        const { error } = await admin.from("news_items").upsert(rows, { onConflict: "guardian_id" });
        if (!error) {
          inserted += rows.length;
          // Fire alerts for high-threat articles (score ≥ 75)
          for (const row of rows) {
            if (row.score >= 75) {
              try {
                await fetch(`${baseUrl}/api/alerts`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    news: { title: row.title, score: row.score, angle: row.angle },
                  }),
                });
              } catch {
                /* optional */
              }
            }
          }
        } else {
          console.error("[scraper] upsert error:", error.message);
        }
      }
    } catch (e) {
      console.error(`[scraper] batch ${i} scoring error:`, e);
    }
  }

  return {
    inserted,
    skipped: all.length - fresh.length,
    total_fetched: all.length,
    sources: { guardian: guardian.length, gnews: gnews.length, reddit: reddit.length, rss: rssResults.flat().length },
    timestamp: new Date().toISOString(),
  };
}

// ── ROUTE HANDLERS ────────────────────────────────────────────────────────────

function checkAuth(req: NextRequest): boolean {
  const secret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return secret === process.env.CRON_SECRET || process.env.NODE_ENV !== "production";
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  try {
    return NextResponse.json(await runScraper(openAiKey));
  } catch (error) {
    console.error("[scraper]", error);
    const e = error as { code?: string; message?: string };
    if (e?.code === "PGRST205") {
      return NextResponse.json({ error: "schema_missing", message: "Run: supabase db push" }, { status: 500 });
    }
    return NextResponse.json({ error: "scraper_failed", message: e?.message ?? "unknown" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!checkAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return NextResponse.json({ error: "OPENAI_API_KEY missing" }, { status: 500 });
  try {
    return NextResponse.json(await runScraper(openAiKey));
  } catch (error) {
    console.error("[scraper]", error);
    const e = error as { code?: string; message?: string };
    if (e?.code === "PGRST205") {
      return NextResponse.json({ error: "schema_missing", message: "Run: supabase db push" }, { status: 500 });
    }
    return NextResponse.json({ error: "scraper_failed", message: e?.message ?? "unknown" }, { status: 500 });
  }
}
