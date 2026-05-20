import { NextResponse } from "next/server";
import { isXApiConfigured } from "@/lib/server/xApi";
import {
  readInsiderRadarCache,
  runInsiderRadarQuickWarm,
  runInsiderRadarTwitterRefresh,
  type InsiderRadarPayload,
} from "@/lib/server/insiderRadarIngest";
import { INSIDER_TRACKERS } from "@/lib/insiderTrackers";

export const maxDuration = 300;

export const revalidate = 3600;

let warmInFlight: Promise<{
  payload: InsiderRadarPayload | null;
  error?: string;
}> | null = null;

let twitterInFlight: Promise<{
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
    x_configured: isXApiConfigured(),
    hint: "Could not load feed. Admin → Automation → Insider Radar → Run now, or wait for daily 09:00 UTC job.",
    ...extra,
  });
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

async function refreshTwitterOnce(): Promise<{ payload: InsiderRadarPayload | null; error?: string }> {
  if (!twitterInFlight) {
    twitterInFlight = (async () => {
      try {
        const result = await runInsiderRadarTwitterRefresh();
        if (result.ok) return { payload: result.payload as InsiderRadarPayload };
        const err =
          typeof result.payload === "object" && result.payload !== null && "error" in result.payload
            ? String((result.payload as { error: string }).error)
            : "twitter_refresh_failed";
        return { payload: null, error: err };
      } catch (e) {
        return { payload: null, error: e instanceof Error ? e.message : String(e) };
      } finally {
        twitterInFlight = null;
      }
    })();
  }
  return twitterInFlight;
}

function jsonResponse(payload: InsiderRadarPayload, extra?: Record<string, unknown>) {
  return NextResponse.json(
    { ...payload, x_configured: isXApiConfigured(), ...extra },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}

export async function GET() {
  try {
    let cached = await readInsiderRadarCache();

    if (cached && cached.x_twitter_posts > 0) {
      return jsonResponse(cached);
    }

    if (!cached || cached.posts.length === 0) {
      const yt = await warmYoutubeOnce();
      cached = yt.payload ?? (await readInsiderRadarCache());
    }

    if (cached && cached.x_twitter_posts === 0) {
      const tw = await refreshTwitterOnce();
      if (tw.payload && tw.payload.x_twitter_posts > 0) {
        return jsonResponse(tw.payload, { twitter_refreshed: true });
      }
      return jsonResponse(cached, {
        hint: isXApiConfigured()
          ? `X API active but no tweets cached yet.${tw.error ? ` (${tw.error})` : ""} Try Admin → Run now on Insider Radar job.`
          : `X API not configured on server — set X_BEARER_TOKEN on Vercel.${tw.error ? ` ${tw.error}` : ""}`,
        warm_error: tw.error,
      });
    }

    if (cached && cached.posts.length > 0) {
      return jsonResponse(cached);
    }

    return emptyResponse();
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
