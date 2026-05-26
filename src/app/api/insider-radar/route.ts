import { NextRequest, NextResponse } from "next/server";
import { isXApiConfigured } from "@/lib/server/xApi";
import {
  readInsiderRadarCache,
  runInsiderRadarQuickWarm,
  runInsiderRadarTwitterRefresh,
  type InsiderRadarPayload,
} from "@/lib/server/insiderRadarIngest";
import { INSIDER_TRACKERS } from "@/lib/insiderTrackers";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

let warmInFlight: Promise<{
  payload: InsiderRadarPayload | null;
  error?: string;
}> | null = null;

function emptyResponse(extra?: { warm_error?: string }) {
  return jsonResponse({
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
    refreshed_at: new Date().toISOString(),
    x_source: "cache_empty",
    x_twitter_posts: 0,
    cached: false,
    hint: "Could not load feed. Admin → Automation → Insider Radar → Run now, or use Refresh on this page.",
    ...extra,
  } as InsiderRadarPayload & { hint?: string });
}

async function warmYoutubeOnce(): Promise<{ payload: InsiderRadarPayload | null; error?: string }> {
  if (!warmInFlight) {
    warmInFlight = (async () => {
      try {
        const result = await runInsiderRadarQuickWarm();
        if (result.ok) return { payload: result.payload as InsiderRadarPayload };
        const err =
          typeof result.payload === "object" && result.payload !== null && "error" in result.payload
            ? String((result.payload as { error: string }).error)
            : "youtube_warm_failed";
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

function jsonResponse(payload: InsiderRadarPayload | Record<string, unknown>, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { ...payload, x_configured: isXApiConfigured(), ...extra },
    {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
        "CDN-Cache-Control": "no-store",
        "Vercel-CDN-Cache-Control": "no-store",
      },
    },
  );
}

export async function GET(req: NextRequest) {
  try {
    const forceRefresh = new URL(req.url).searchParams.get("refresh") === "1";

    if (forceRefresh) {
      const result = await runInsiderRadarTwitterRefresh();
      if (result.ok) {
        return jsonResponse(result.payload as InsiderRadarPayload, { live_refresh: true });
      }
      const err =
        typeof result.payload === "object" && result.payload !== null && "error" in result.payload
          ? String((result.payload as { error: string }).error)
          : "refresh_failed";
      const cached = await readInsiderRadarCache();
      if (cached?.posts.length) {
        return jsonResponse(cached, { refresh_error: err, live_refresh: false });
      }
      return jsonResponse(
        {
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
          refreshed_at: new Date().toISOString(),
          x_source: "refresh_failed",
          x_twitter_posts: 0,
          cached: false,
        } satisfies InsiderRadarPayload,
        { refresh_error: err, hint: `Refresh failed: ${err}` },
      );
    }

    let cached = await readInsiderRadarCache();

    if (!cached || cached.posts.length === 0) {
      const yt = await warmYoutubeOnce();
      cached = yt.payload ?? (await readInsiderRadarCache());
      if (!cached?.posts.length && yt.error) {
        return emptyResponse({ warm_error: yt.error });
      }
    }

    if (cached && cached.posts.length > 0) {
      return jsonResponse(cached);
    }

    return emptyResponse();
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
