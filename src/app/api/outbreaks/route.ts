import { NextRequest, NextResponse, after } from "next/server";
import {
  buildOutbreakPreviewPayload,
  OUTBREAK_CACHE_TTL_MS,
  readOutbreakCache,
  runOutbreakRefresh,
} from "@/lib/server/runOutbreakRefresh";

export const maxDuration = 300;

/** Guards against a thundering herd of background refreshes (one per server instance). */
let refreshInFlight: Promise<unknown> | null = null;

function backgroundRefresh() {
  if (!refreshInFlight) {
    refreshInFlight = runOutbreakRefresh({ skipCache: true })
      .catch(() => {})
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function GET(req: NextRequest) {
  const params = new URL(req.url).searchParams;

  if (params.get("preview") === "1") {
    return NextResponse.json(buildOutbreakPreviewPayload());
  }

  const force = params.get("refresh") === "1";

  // Explicit refresh: do the full (blocking) refresh the user asked for.
  if (force) {
    try {
      const { ok, status, payload } = await runOutbreakRefresh({ skipCache: true });
      return ok ? NextResponse.json(payload) : NextResponse.json(payload, { status });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  // Normal load: never block the user on external fetches.
  try {
    const cache = await readOutbreakCache();
    if (cache) {
      if (cache.ageMs < OUTBREAK_CACHE_TTL_MS) {
        return NextResponse.json(cache.payload); // fresh
      }
      // Stale: serve instantly, revalidate in the background (next request gets fresh data).
      after(backgroundRefresh());
      return NextResponse.json({ ...cache.payload, stale: true });
    }

    // No usable cache (first-ever load or version bump) — must build it now.
    const { ok, status, payload } = await runOutbreakRefresh();
    return ok ? NextResponse.json(payload) : NextResponse.json(payload, { status });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
