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

function latestIso(...candidates: (string | null | undefined)[]): string | null {
  let best: string | null = null;
  let bestMs = -Infinity;
  for (const c of candidates) {
    if (!c) continue;
    const ms = Date.parse(c);
    if (!Number.isNaN(ms) && ms > bestMs) {
      bestMs = ms;
      best = c;
    }
  }
  return best;
}

function withinHours(iso: string | null | undefined, hours: number): boolean {
  if (!iso) return false;
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms <= hours * 60 * 60 * 1000;
}

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
    // Source freshness is reported separately from whether a worker completed successfully.
    const { data: newsJob } = await db.from("scraper_jobs").select("id")
      .eq("target", "news_scraper").limit(1).maybeSingle();
    const since12h = new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString();
    const since1h = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const [
      recentArticles,
      guardianRecent,
      gnewsRecent,
      redditRecent,
      rssRecent,
      lastScraper,
      oracleCount,
      uapIntelMeta,
      lastUapNewsRow,
      uapJobRow,
      communityRecent,
      lastIngestRow,
      lastGuardianRow,
      lastGnewsRow,
      lastRedditRow,
      lastRssRow,
      lastOracleRow,
      lastPostRow,
      lastSuccessfulScraper,
      lastStoredArticle,
    ] = await Promise.all([
      // Recent ingest: any article in last 12h? (column is published_at, not date)
      db.from("news_items").select("id", { count: "exact", head: true }).gte("published_at", since12h),
      db.from("news_items").select("id", { count: "exact", head: true }).eq("source", "guardian").gte("published_at", since12h),
      db.from("news_items").select("id", { count: "exact", head: true }).ilike("source", "gnews%").gte("published_at", since12h),
      db.from("news_items").select("id", { count: "exact", head: true }).ilike("source", "reddit:%").gte("published_at", since12h),
      db.from("news_items").select("id", { count: "exact", head: true }).not("source", "in", "(guardian)").not("source", "ilike", "gnews%").not("source", "ilike", "reddit:%").gte("published_at", since12h),
      // Scraper: last run status + timestamps for freshness
      db.from("scraper_runs")
        .select("status, started_at, finished_at")
        .eq("job_id", newsJob?.id ?? "00000000-0000-0000-0000-000000000000")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      // Oracle: any analysis in last 1h?
      db.from("oracle_analyses").select("id", { count: "exact", head: true }).gte("created_at", since1h),
      // UAP: last full refresh meta + news scrape timestamp
      db.from("uap_intel_meta").select("updated_at, value").eq("key", "last_full_refresh").maybeSingle(),
      db.from("uap_news").select("scraped_at").order("scraped_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("scraper_jobs").select("id").eq("job_key", "uap_full_refresh").maybeSingle(),
      // Community: any post in last 48h?
      db.from("thread_posts").select("id", { count: "exact", head: true }).gte("created_at", since48h),
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
      db.from("thread_posts").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("scraper_runs").select("finished_at")
        .eq("job_id", newsJob?.id ?? "00000000-0000-0000-0000-000000000000")
        .eq("status", "success").order("finished_at", { ascending: false }).limit(1).maybeSingle(),
      db.from("news_items").select("created_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const uapScraperRun = uapJobRow.data?.id
      ? await db
          .from("scraper_runs")
          .select("status, started_at, finished_at")
          .eq("job_id", uapJobRow.data.id)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };

    const uapMetaAt =
      typeof uapIntelMeta.data?.value === "object" &&
      uapIntelMeta.data.value !== null &&
      "at" in (uapIntelMeta.data.value as Record<string, unknown>)
        ? String((uapIntelMeta.data.value as Record<string, unknown>).at)
        : null;
    const uapScraperAt = uapScraperRun.data?.finished_at ?? uapScraperRun.data?.started_at ?? null;
    const uapLastAt = latestIso(uapMetaAt, uapIntelMeta.data?.updated_at, uapScraperAt, lastUapNewsRow.data?.scraped_at);

    const uapScraperRecentOk =
      uapScraperRun.data?.status === "success" || uapScraperRun.data?.status === "running";
    const uapOk =
      (uapScraperRecentOk && withinHours(uapScraperAt, 26)) ||
      withinHours(uapMetaAt, 26) ||
      withinHours(uapIntelMeta.data?.updated_at, 26);

    const communityOk = (communityRecent.count ?? 0) > 0;

    const ingestOk = (recentArticles.count ?? 0) > 0;
    const scraperStatus = lastScraper.data?.status ?? null;
    const successfulAt = lastSuccessfulScraper.data?.finished_at ?? null;
    const runningFresh = scraperStatus === "running" && withinHours(lastScraper.data?.started_at, 1 / 6);
    const scraperOk = runningFresh || (scraperStatus === "success" && withinHours(successfulAt, 26));
    const oracleOk = (oracleCount.count ?? 0) > 0;
    const stat = (count: number | null) => ((count ?? 0) > 0 ? "fresh" : "stale");

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
      uap: uapLastAt,
      community: lastPostRow.data?.created_at ?? null,
    };

    return NextResponse.json({
      ingest: ingestOk ? "online" : "degraded",
      guardian_api: stat(guardianRecent.count),
      gnews: stat(gnewsRecent.count),
      reddit: stat(redditRecent.count),
      rss: stat(rssRecent.count),
      scraper: scraperOk ? "online" : scraperStatus === "failed" ? "error" : scraperStatus === "running" ? "stalled" : "stale",
      feed_updated_at: lastStoredArticle.data?.created_at ?? null,
      last_successful_refresh: successfulAt,
      source_status_meaning: "Content freshness only; a quiet source is not necessarily unavailable.",
      oracle: oracleOk ? "online" : "idle",
      community: communityOk ? "online" : "idle",
      uap: uapOk ? "online" : uapScraperRun.data?.status === "failed" ? "error" : "idle",
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
