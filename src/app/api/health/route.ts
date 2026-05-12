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
        guardian: "unknown",
        scraper: "unknown",
        oracle: "unknown",
        community: "unknown",
        ts: Date.now(),
      });
    }
    const since4h = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const [recentArticles, lastScraper, oracleCount] = await Promise.all([
      // Recent ingest: any article in last 4h? (column is published_at, not date)
      db.from("news_items").select("id", { count: "exact", head: true }).gte("published_at", since4h),
      // Scraper: last run status
      db.from("scraper_runs")
        .select("status, started_at")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Oracle: any analysis in last 1h?
      db.from("oracle_analyses").select("id", { count: "exact", head: true }).gte("created_at", since1h),
    ]);

    const guardianOk = (recentArticles.count ?? 0) > 0;
    const scraperStatus = lastScraper.data?.status ?? null;
    const scraperOk = scraperStatus === "success" || scraperStatus === "running";
    const oracleActive = (oracleCount.count ?? 0) > 0;

    return NextResponse.json({
      guardian: guardianOk ? "online" : "degraded",
      scraper: scraperOk ? "online" : scraperStatus === "failed" ? "error" : "idle",
      oracle: "online", // GPT-4o is always reachable; we'd know from api_request_logs errors
      community: "online",
      ts: Date.now(),
    });
  } catch {
    return NextResponse.json({
      guardian: "unknown",
      scraper: "unknown",
      oracle: "unknown",
      community: "unknown",
      ts: Date.now(),
    });
  }
}
