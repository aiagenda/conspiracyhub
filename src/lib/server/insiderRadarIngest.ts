import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { INSIDER_TRACKERS, type InsiderTracker } from "@/lib/insiderTrackers";
import { fetchXPostsByHandle, isXApiConfigured } from "@/lib/server/xApi";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export const INSIDER_CACHE_ID = "latest";

export type InsiderPostRow = {
  title: string;
  url: string;
  published: string;
  thumbnail?: string;
  tracker_id: string;
  tracker_name: string;
  tracker_type: string;
  avatar: string;
  color: string;
  category: string;
};

export type InsiderRadarPayload = {
  posts: InsiderPostRow[];
  trackers: Array<{
    id: string;
    name: string;
    type: string;
    color: string;
    avatar: string;
    category: string;
    post_count: number;
  }>;
  generated_at: string;
  refreshed_at: string;
  x_source: string;
  x_twitter_posts: number;
  cached: boolean;
};

function decodeXml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

async function fetchYouTubeRSS(
  channelId: string,
): Promise<Array<{ title: string; url: string; published: string; thumbnail?: string }>> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
      headers: { "User-Agent": UA, Accept: "application/atom+xml, application/xml, text/xml, */*" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: Array<{ title: string; url: string; published: string; thumbnail?: string }> = [];
    for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const x = m[1];
      const title = decodeXml(x.match(/<title>(.*?)<\/title>/)?.[1]?.trim() ?? "");
      const url =
        x.match(/rel="alternate"\s+href="(https:\/\/www\.youtube\.com\/watch[^"]+)"/)?.[1] ??
        x.match(/href="(https:\/\/www\.youtube\.com\/watch[^"]+)"/)?.[1] ??
        "";
      const pub = x.match(/<published>(.*?)<\/published>/)?.[1] ?? "";
      const thumb = x.match(/url="(https:\/\/i\.ytimg\.com[^"]+)"/)?.[1];
      if (title && url) items.push({ title, url, published: pub, thumbnail: thumb });
    }
    return items.slice(0, 3);
  } catch {
    return [];
  }
}

async function fetchTwitterNitterFallback(
  handle: string,
): Promise<Array<{ title: string; url: string; published: string }>> {
  const NITTER_INSTANCES = ["nitter.poast.org", "nitter.privacydev.net"];

  for (const instance of NITTER_INSTANCES) {
    try {
      const res = await fetch(`https://${instance}/${handle}/rss`, {
        headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      if (xml.includes("not whitelisted") || xml.includes("bot check")) continue;
      const items: Array<{ title: string; url: string; published: string }> = [];
      for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const x = m[1];
        const title = decodeXml(
          x.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "",
        );
        const link = x.match(/<link>(.*?)<\/link>/)?.[1]?.trim() ?? "";
        const pub = x.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() ?? "";
        if (title && link && !title.startsWith("RT @")) {
          items.push({ title, url: link, published: pub });
        }
      }
      if (items.length) return items.slice(0, 3);
    } catch {
      continue;
    }
  }
  return [];
}

async function fetchTwitterPosts(
  handle: string,
): Promise<Array<{ title: string; url: string; published: string }>> {
  if (isXApiConfigured()) {
    const { posts } = await fetchXPostsByHandle(handle, 3);
    return posts;
  }
  return fetchTwitterNitterFallback(handle);
}

async function fetchTrackerPosts(tracker: InsiderTracker) {
  if (tracker.type === "youtube") {
    const posts = await fetchYouTubeRSS(tracker.channelId!);
    return { ...tracker, posts };
  }
  const posts = await fetchTwitterPosts(tracker.handle!);
  return { ...tracker, posts };
}

export function buildInsiderPayload(
  trackersWithPosts: Array<InsiderTracker & { posts: Array<{ title: string; url: string; published: string; thumbnail?: string }> }>,
  refreshedAt: string,
): InsiderRadarPayload {
  const x_source = isXApiConfigured() ? "x_api" : "nitter_fallback";

  const allPosts = trackersWithPosts
    .filter((t) => t.posts.length > 0)
    .flatMap((t) =>
      t.posts.map((p) => ({
        ...p,
        tracker_id: t.id,
        tracker_name: t.name,
        tracker_type: t.type,
        avatar: t.avatar,
        color: t.color,
        category: t.category,
      })),
    )
    .sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

  const now = new Date().toISOString();
  return {
    posts: allPosts,
    trackers: trackersWithPosts.map((t) => ({
      id: t.id,
      name: t.name,
      type: t.type,
      color: t.color,
      avatar: t.avatar,
      category: t.category,
      post_count: t.posts.length,
    })),
    generated_at: now,
    refreshed_at: refreshedAt,
    x_source,
    x_twitter_posts: allPosts.filter((p) => p.tracker_type === "twitter").length,
    cached: true,
  };
}

/** Fetches all trackers (X + YouTube) — only call from cron / admin refresh. */
export async function fetchAllInsiderFeeds(): Promise<InsiderRadarPayload> {
  const results = await Promise.allSettled(INSIDER_TRACKERS.map((t) => fetchTrackerPosts(t)));
  const trackersWithPosts = results.map((r, i) => {
    if (r.status === "rejected") {
      return { ...INSIDER_TRACKERS[i], posts: [] as Array<{ title: string; url: string; published: string }> };
    }
    return r.value;
  });
  return buildInsiderPayload(trackersWithPosts, new Date().toISOString());
}

function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

export async function readInsiderRadarCache(): Promise<InsiderRadarPayload | null> {
  try {
    const { data, error } = await adminClient()
      .from("insider_radar_cache")
      .select("data, refreshed_at")
      .eq("id", INSIDER_CACHE_ID)
      .maybeSingle();
    if (error || !data?.data) return null;
    const payload = data.data as InsiderRadarPayload;
    return {
      ...payload,
      refreshed_at: data.refreshed_at ?? payload.refreshed_at,
      cached: true,
    };
  } catch {
    return null;
  }
}

/** Cron / admin: refresh cache (all X API calls happen here). */
export async function runInsiderRadarRefresh(): Promise<{
  ok: boolean;
  status: number;
  payload: InsiderRadarPayload | { error: string };
}> {
  try {
    const fresh = await fetchAllInsiderFeeds();
    const admin = adminClient();
    const { error } = await admin.from("insider_radar_cache").upsert(
      {
        id: INSIDER_CACHE_ID,
        data: fresh,
        refreshed_at: fresh.refreshed_at,
      },
      { onConflict: "id" },
    );
    if (error) {
      return { ok: false, status: 500, payload: { error: error.message } };
    }
    return { ok: true, status: 200, payload: { ...fresh, cached: true } };
  } catch (e) {
    return {
      ok: false,
      status: 500,
      payload: { error: e instanceof Error ? e.message : String(e) },
    };
  }
}
