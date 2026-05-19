import { NextResponse } from "next/server";

const UA = "TheTheorist/1.0 (+https://the-theorist.com)";

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
  { id: "whyfiles", name: "The Why Files", type: "youtube", channelId: "UCcIOjaKHWVOkEBHRmhpKmrA", avatar: "🔍", color: "#00ff88", category: "uap" },
  { id: "coulthart", name: "Ross Coulthart", type: "youtube", channelId: "UCW34TpWDGIRCYMHCTKFJXWA", avatar: "📡", color: "#00bb66", category: "uap" },
  { id: "secureteam", name: "SecureTeam10", type: "youtube", channelId: "UCKdDlCiMDniPBxTKMHnXhcw", avatar: "🛸", color: "#8aa6ff", category: "uap" },
  { id: "grusch_tw", name: "David Grusch", type: "twitter", handle: "DavidCharlesGrusch", avatar: "🎖️", color: "#00ff88", category: "uap" },
  { id: "graves_tw", name: "Ryan Graves", type: "twitter", handle: "uncertainvector", avatar: "✈️", color: "#00bb66", category: "uap" },
  { id: "mellon_tw", name: "Chris Mellon", type: "twitter", handle: "ChristopherMellon", avatar: "🏛️", color: "#8aa6ff", category: "uap" },
  { id: "coulthart_tw", name: "Ross Coulthart", type: "twitter", handle: "rosscoulthart", avatar: "📡", color: "#00bb66", category: "uap" },
  { id: "burchett_tw", name: "Rep. Tim Burchett", type: "twitter", handle: "timburchett", avatar: "🏛️", color: "#c94dff", category: "uap" },
];

async function fetchYouTubeRSS(channelId: string): Promise<Array<{ title: string; url: string; published: string; thumbnail?: string }>> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items: Array<{ title: string; url: string; published: string; thumbnail?: string }> = [];
    for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const x = m[1];
      const title = x.match(/<title>(.*?)<\/title>/)?.[1]?.trim() ?? "";
      const url = x.match(/href="(https:\/\/www\.youtube\.com\/watch[^"]+)"/)?.[1] ?? "";
      const pub = x.match(/<published>(.*?)<\/published>/)?.[1] ?? "";
      const thumb = x.match(/url="(https:\/\/i\.ytimg\.com[^"]+)"/)?.[1];
      if (title && url) items.push({ title, url, published: pub, thumbnail: thumb });
    }
    return items.slice(0, 3);
  } catch {
    return [];
  }
}

async function fetchTwitterRSS(handle: string): Promise<Array<{ title: string; url: string; published: string }>> {
  const NITTER_INSTANCES = ["nitter.net", "nitter.privacydev.net", "nitter.poast.org"];

  for (const instance of NITTER_INSTANCES) {
    try {
      const res = await fetch(`https://${instance}/${handle}/rss`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(5000),
        next: { revalidate: 1800 },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const items: Array<{ title: string; url: string; published: string }> = [];
      for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
        const x = m[1];
        const title = x.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? "";
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

export const revalidate = 1800;

export async function GET() {
  try {
    const results = await Promise.allSettled(
      TRACKERS.map(async (tracker) => {
        const posts =
          tracker.type === "youtube"
            ? await fetchYouTubeRSS(tracker.channelId!)
            : await fetchTwitterRSS(tracker.handle!);
        return { ...tracker, posts };
      }),
    );

    const trackers = results
      .map((r, i) => {
        if (r.status === "rejected") return { ...TRACKERS[i], posts: [] as Array<{ title: string; url: string; published: string }> };
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

    return NextResponse.json({
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
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
