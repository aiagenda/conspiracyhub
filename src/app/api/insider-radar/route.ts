import { NextResponse } from "next/server";
import { fetchXPostsByHandle, fetchXPostsForHandles, isXApiConfigured } from "@/lib/server/xApi";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

type Tracker = {
  id: string;
  name: string;
  type: "youtube" | "twitter";
  channelId?: string;
  handle?: string;
  avatar: string;
  color: string;
  category: string;
};

const TRACKERS: Tracker[] = [
  {
    id: "whyfiles",
    name: "The Why Files",
    type: "youtube",
    channelId: "UCIFk2uvCNcEmZ77g0ESKLcQ",
    avatar: "🔍",
    color: "#00ff88",
    category: "uap",
  },
  {
    id: "coulthart",
    name: "Ross Coulthart",
    type: "youtube",
    channelId: "UCW-NJDzqcE7eC5lZu3xL7hA",
    avatar: "📡",
    color: "#00bb66",
    category: "uap",
  },
  {
    id: "secureteam",
    name: "SecureTeam10",
    type: "youtube",
    channelId: "UC4F3j3ed_To-M3H2YLLD5vw",
    avatar: "🛸",
    color: "#8aa6ff",
    category: "uap",
  },
  {
    id: "grusch_tw",
    name: "David Grusch",
    type: "twitter",
    handle: "DavidCharlesGrusch",
    avatar: "🎖️",
    color: "#00ff88",
    category: "uap",
  },
  {
    id: "graves_tw",
    name: "Ryan Graves",
    type: "twitter",
    handle: "uncertainvector",
    avatar: "✈️",
    color: "#00bb66",
    category: "uap",
  },
  {
    id: "mellon_tw",
    name: "Chris Mellon",
    type: "twitter",
    handle: "ChristopherMellon",
    avatar: "🏛️",
    color: "#8aa6ff",
    category: "uap",
  },
  {
    id: "coulthart_tw",
    name: "Ross Coulthart",
    type: "twitter",
    handle: "rosscoulthart",
    avatar: "📡",
    color: "#00bb66",
    category: "uap",
  },
  {
    id: "burchett_tw",
    name: "Rep. Tim Burchett",
    type: "twitter",
    handle: "timburchett",
    avatar: "🏛️",
    color: "#c94dff",
    category: "uap",
  },
];

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
      next: { revalidate: 1800 },
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

/** Legacy fallback when X API env is not configured. */
async function fetchTwitterNitterFallback(
  handle: string,
): Promise<Array<{ title: string; url: string; published: string }>> {
  const NITTER_INSTANCES = ["nitter.poast.org", "nitter.privacydev.net"];

  for (const instance of NITTER_INSTANCES) {
    try {
      const res = await fetch(`https://${instance}/${handle}/rss`, {
        headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml, */*" },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 1800 },
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

export const revalidate = 1800;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const debug =
      url.searchParams.get("debug") === "1" &&
      (process.env.NODE_ENV !== "production" ||
        url.searchParams.get("key") === process.env.CRON_SECRET);

    const x_source = isXApiConfigured() ? "x_api" : "nitter_fallback";

    const twitterHandles = TRACKERS.filter((t) => t.type === "twitter").map((t) => t.handle!);
    const xBatch = debug ? await fetchXPostsForHandles(twitterHandles) : null;

    const results = await Promise.allSettled(
      TRACKERS.map(async (tracker) => {
        if (tracker.type === "youtube") {
          const posts = await fetchYouTubeRSS(tracker.channelId!);
          return { ...tracker, posts };
        }
        if (isXApiConfigured()) {
          const cached = xBatch?.results.find((r) => r.handle === tracker.handle);
          const { posts } = cached ?? (await fetchXPostsByHandle(tracker.handle!, 3));
          return { ...tracker, posts };
        }
        const posts = await fetchTwitterNitterFallback(tracker.handle!);
        return { ...tracker, posts };
      }),
    );

    const trackers = results
      .map((r, i) => {
        if (r.status === "rejected")
          return { ...TRACKERS[i], posts: [] as Array<{ title: string; url: string; published: string }> };
        return r.value;
      })
      .filter((t) => t.posts.length > 0);

    const allPosts = trackers
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

    const xTwitterCount = allPosts.filter((p) => p.tracker_type === "twitter").length;
    const payload: Record<string, unknown> = {
      posts: allPosts,
      trackers: trackers.map((t) => ({
        id: t.id,
        name: t.name,
        type: t.type,
        color: t.color,
        avatar: t.avatar,
        category: t.category,
        post_count: t.posts.length,
      })),
      generated_at: new Date().toISOString(),
      x_source,
      x_twitter_posts: xTwitterCount,
    };

    if (debug && xBatch) {
      payload.x_debug = xBatch.results.map((r) => ({
        handle: r.handle,
        count: r.posts.length,
        error: r.error ?? null,
        sample: r.posts[0]?.title?.slice(0, 80) ?? null,
      }));
    } else if (isXApiConfigured() && xTwitterCount === 0) {
      payload.x_hint =
        "X API configured but no tweets returned. Check Vercel env X_BEARER_TOKEN, redeploy, and developer.x.com Usage for 403/429.";
    }

    return NextResponse.json(payload);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
