import { NextResponse } from "next/server";
import { readInsiderRadarCache } from "@/lib/server/insiderRadarIngest";
import { INSIDER_TRACKERS } from "@/lib/insiderTrackers";

/** Public read — DB cache only; no X API on page load. */
export const revalidate = 86400;

export async function GET() {
  try {
    const cached = await readInsiderRadarCache();
    if (cached) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      });
    }

    return NextResponse.json({
      posts: [],
      trackers: INSIDER_TRACKERS.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        color: t.color,
        avatar: t.avatar,
        category: t.category,
        post_count: 0,
      })),
      generated_at: new Date().toISOString(),
      refreshed_at: null,
      x_source: "cache_empty",
      x_twitter_posts: 0,
      cached: false,
      hint: "Feed not warmed yet. Run Insider Radar refresh from Admin → Automation → Ingest & intel, or wait for the daily job (09:00 UTC).",
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
