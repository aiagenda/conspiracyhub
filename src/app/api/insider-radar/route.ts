import { NextResponse } from "next/server";
import {
  readInsiderRadarCache,
  runInsiderRadarQuickWarm,
  type InsiderRadarPayload,
} from "@/lib/server/insiderRadarIngest";
import { INSIDER_TRACKERS } from "@/lib/insiderTrackers";

export const maxDuration = 60;

export const revalidate = 3600;

let warmInFlight: Promise<{
  payload: InsiderRadarPayload | null;
  error?: string;
}> | null = null;

function emptyResponse(extra?: { warm_error?: string }) {
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
    hint: "Could not load feed. Apply Supabase migration insider_radar_cache, then Admin → Automation → Insider Radar → Run now (full X + YouTube).",
    ...extra,
  });
}

async function warmCacheOnce(): Promise<{ payload: InsiderRadarPayload | null; error?: string }> {
  if (!warmInFlight) {
    warmInFlight = (async () => {
      try {
        const result = await runInsiderRadarQuickWarm();
        if (result.ok) {
          return { payload: result.payload as InsiderRadarPayload };
        }
        const err =
          typeof result.payload === "object" && result.payload !== null && "error" in result.payload
            ? String((result.payload as { error: string }).error)
            : "refresh_failed";
        return { payload: null, error: err };
      } catch (e) {
        return { payload: null, error: e instanceof Error ? e.message : String(e) };
      } finally {
        warmInFlight = null;
      }
    })();
  }
  return warmInFlight;
}

export async function GET() {
  try {
    const cached = await readInsiderRadarCache();
    if (cached && cached.posts.length > 0) {
      return NextResponse.json(cached, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
      });
    }

    const { payload, error } = await warmCacheOnce();
    if (payload && payload.posts.length > 0) {
      return NextResponse.json(
        {
          ...payload,
          auto_warmed: true,
          hint:
            payload.x_twitter_posts === 0
              ? "Showing YouTube only until full refresh (Admin or 09:00 UTC daily job)."
              : undefined,
        },
        { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
      );
    }

    return emptyResponse(error ? { warm_error: error } : undefined);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
