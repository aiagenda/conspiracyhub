import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export const revalidate = 120; // cache 2 min

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
        ts: Date.now(),
      });
    }
    const since4h = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const [recentArticles, guardianRecent, gnewsRecent, redditRecent, rssRecent, lastScraper, oracleCount, uapRecent] = await Promise.all([
      // Recent ingest: any article in last 4h? (column is published_at, not date)
      db.from("news_items").select("id", { count: "exact", head: true }).gte("published_at", since4h),
      db.from("news_items").select("id", { count: "exact", head: true }).eq("source", "guardian").gte("published_at", since4h),
      db.from("news_items").select("id", { count: "exact", head: true }).ilike("source", "gnews%").gte("published_at", since4h),
      db.from("news_items").select("id", { count: "exact", head: true }).ilike("source", "reddit:%").gte("published_at", since4h),
      db.from("news_items").select("id", { count: "exact", head: true }).not("source", "in", "(guardian)").not("source", "ilike", "gnews%").not("source", "ilike", "reddit:%").gte("published_at", since4h),
      // Scraper: last run status
      db.from("scraper_runs")
        .select("status, started_at")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Oracle: any analysis in last 1h?
      db.from("oracle_analyses").select("id", { count: "exact", head: true }).gte("created_at", since1h),
      // UAP ingest: sightings in last 24h
      db.from("uap_sightings").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const ingestOk = (recentArticles.count ?? 0) > 0;
    const scraperStatus = lastScraper.data?.status ?? null;
    const scraperOk = scraperStatus === "success" || scraperStatus === "running";
    const oracleOk = (oracleCount.count ?? 0) > 0;
    const uapOk = (uapRecent.count ?? 0) > 0;
    const stat = (count: number | null) => (count ?? 0) > 0 ? "online" : "degraded";

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
      ts: Date.now(),
    });
  }
}
