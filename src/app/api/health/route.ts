import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export const revalidate = 120; // cache 2 min

const emptyLastAt = {
  ingest: null as string | null,
  guardian_api: null as string | null,
  gnews: null as string | null,
  reddit: null as string | null,
  rss: null as string | null,
  scraper: null as string | null,
  oracle: null as string | null,
  community: null as string | null,
  uap: null as string | null,
};

export async function GET() {
  try {
    const db = admin();
    if (!db) {
      return NextResponse.json({
        ingest: "unknown",
        guardian_api: "unknown",
        gnews: "unknown",
        reddit: "unknown",
        rss: "unknown",
        scraper: "unknown",
        oracle: "unknown",
        community: "unknown",
        uap: "unknown",
        last_at: emptyLastAt,
        ts: Date.now(),
      });
    }
    const since4h = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const [
      recentArticles,
      guardianRecent,
      gnewsRecent,
      redditRecent,
      rssRecent,
      lastScraper,
      oracleCount,
      uapRecent,
      lastIngestRow,
      lastGuardianRow,
      lastGnewsRow,
      lastRedditRow,
      lastRssRow,
      lastOracleRow,
      lastUapRow,
      lastThreadRow,
    ] = await Promise.all([
      // Recent ingest: any article in last 4h? (column is published_at, not date)
      db.from("news_items").select("id", { count: "exact", head: true }).gte("published_at", since4h),
      db.from("news_items").select("id", { count: "exact", head: true }).eq("source", "guardian").gte("published_at", since4h),
      db.from("news_items").select("id", { count: "exact", head: true }).ilike("source", "gnews%").gte("published_at", since4h),
      db.from("news_items").select("id", { count: "exact", head: true }).ilike("source", "reddit:%").gte("published_at", since4h),
      db.from("news_items").select("id", { count: "exact", head: true }).not("source", "in", "(guardian)").not("source", "ilike", "gnews%").not("source", "ilike", "reddit:%").gte("published_at", since4h),
      // Scraper: last run status + timestamps for freshness
      db.from("scraper_runs")
        .select("status, started_at, finished_at")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Oracle: any analysis in last 1h?
      db.from("oracle_analyses").select("id", { count: "exact", head: true }).gte("created_at", since1h),
      // UAP ingest: sightings in last 24h
      db.from("uap_sightings").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
      db.from("news_items").select("published_at").order("published_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("news_items").select("published_at").eq("source", "guardian").order("published_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("news_items").select("published_at").ilike("source", "gnews%").order("published_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("news_items").select("published_at").ilike("source", "reddit:%").order("published_at", { ascending: false }).limit(1).maybeSingle(),
      db
        .from("news_items")
        .select("published_at")
        .not("source", "in", "(guardian)")
        .not("source", "ilike", "gnews%")
        .not("source", "ilike", "reddit:%")
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db.from("oracle_analyses").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("uap_sightings").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("threads").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const ingestOk = (recentArticles.count ?? 0) > 0;
    const scraperStatus = lastScraper.data?.status ?? null;
    const scraperOk = scraperStatus === "success" || scraperStatus === "running";
    const oracleOk = (oracleCount.count ?? 0) > 0;
    const uapOk = (uapRecent.count ?? 0) > 0;
    const stat = (count: number | null) => (count ?? 0) > 0 ? "online" : "degraded";

    const scraperAt =
      lastScraper.data?.finished_at ?? lastScraper.data?.started_at ?? null;

    const last_at = {
      ingest: lastIngestRow.data?.published_at ?? null,
      guardian_api: lastGuardianRow.data?.published_at ?? null,
      gnews: lastGnewsRow.data?.published_at ?? null,
      reddit: lastRedditRow.data?.published_at ?? null,
      rss: lastRssRow.data?.published_at ?? null,
      scraper: scraperAt,
      oracle: lastOracleRow.data?.created_at ?? null,
      uap: lastUapRow.data?.created_at ?? null,
      community: lastThreadRow.data?.created_at ?? null,
    };

    return NextResponse.json({
      ingest: ingestOk ? "online" : "degraded",
      guardian_api: stat(guardianRecent.count),
      gnews: stat(gnewsRecent.count),
      reddit: stat(redditRecent.count),
      rss: stat(rssRecent.count),
      scraper: scraperOk ? "online" : scraperStatus === "failed" ? "error" : "idle",
      oracle: oracleOk ? "online" : "idle",
      community: "online",
      uap: uapOk ? "online" : "idle",
      last_at,
      ts: Date.now(),
    });
  } catch {
    return NextResponse.json({
      ingest: "unknown",
      guardian_api: "unknown",
      gnews: "unknown",
      reddit: "unknown",
      rss: "unknown",
      scraper: "unknown",
      oracle: "unknown",
      community: "unknown",
      uap: "unknown",
      last_at: emptyLastAt,
      ts: Date.now(),
    });
  }
}
