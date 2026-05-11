/**
 * Fetches readable title + text for URL analysis (Oracle / analyze-url).
 * Uses platform-specific APIs where plain HTML scraping fails (social).
 */

const UA = "TheTheorist/1.0 (+https://conspiracyhub.vercel.app)";
const MAX_TEXT = 8000;

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

async function expandRedirects(url: string): Promise<string> {
  if (!/^https?:\/\/(t\.co|redd\.it)\//i.test(url)) return url;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(10000),
    });
    return res.url || url;
  } catch {
    return url;
  }
}

async function fetchTwitterOembed(url: string): Promise<{ title: string; text: string } | null> {
  try {
    const api = `https://publish.twitter.com/oembed?omit_script=true&dnt=true&url=${encodeURIComponent(url)}`;
    const res = await fetch(api, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { author_name?: string; html?: string };
    const html = data.html ?? "";
    const text = stripHtml(html);
    if (!text || text.length < 8) return null;
    const title = data.author_name ? `X · @${data.author_name}` : "X post";
    return { title, text: text.slice(0, MAX_TEXT) };
  } catch {
    return null;
  }
}

type RedditPost = {
  title?: string;
  selftext?: string;
  selftext_html?: string;
  is_self?: boolean;
  url?: string;
  subreddit?: string;
  author?: string;
  permalink?: string;
};

async function fetchRedditContent(url: string): Promise<{ title: string; text: string } | null> {
  try {
    let u = url;
    if (/redd\.it\//i.test(u)) u = await expandRedirects(u);

    const match = u.match(/\/comments\/([a-z0-9]+)/i);
    if (!match) return null;
    const id = match[1];
    const jsonUrl = `https://www.reddit.com/comments/${id}.json?limit=8`;
    const res = await fetch(jsonUrl, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ data?: { children?: Array<{ kind?: string; data?: RedditPost & { body?: string; author?: string } }> } }>;
    const post = data?.[0]?.data?.children?.[0]?.data as RedditPost | undefined;
    if (!post?.title) return null;

    let body = (post.selftext ?? "").trim();
    if (body === "[deleted]" || body === "[removed]") body = "";

    if (!post.is_self && !body) {
      const link = post.url ?? "";
      body = link ? `Link post — shared URL: ${link}` : "(No text body on this link post.)";
    }

    const parts: string[] = [
      `Title: ${post.title}`,
      post.subreddit ? `Subreddit: r/${post.subreddit}` : "",
      post.author && post.author !== "[deleted]" ? `Author: u/${post.author}` : "",
      body ? `\nBody:\n${body}` : "",
    ];

    const replies = data?.[1]?.data?.children;
    if (Array.isArray(replies) && replies.length > 0) {
      const lines: string[] = [];
      for (const c of replies.slice(0, 6)) {
        if (c.kind !== "t1") continue;
        const d = c.data;
        const b = (d?.body ?? "").trim();
        if (!b || b === "[deleted]" || b === "[removed]") continue;
        const au = d?.author && d.author !== "[deleted]" ? d.author : "?";
        lines.push(`— u/${au}: ${b.slice(0, 400)}${b.length > 400 ? "…" : ""}`);
        if (lines.length >= 4) break;
      }
      if (lines.length) parts.push(`\nTop comments:\n${lines.join("\n")}`);
    }

    const text = parts.filter(Boolean).join("\n").trim().slice(0, MAX_TEXT);
    return { title: `Reddit · ${post.title.slice(0, 140)}`, text };
  } catch {
    return null;
  }
}

async function fetchBlueskyContent(url: string): Promise<{ title: string; text: string } | null> {
  try {
    const m = url.match(/\/profile\/([^/]+)\/post\/([^/?#]+)/);
    if (!m) return null;
    const handle = decodeURIComponent(m[1]);
    const rkey = m[2];
    const atUri = `at://${handle}/app.bsky.feed.post/${rkey}`;
    const api = `https://public.api.bsky.app/x/app.bsky.feed.getPosts?uris=${encodeURIComponent(atUri)}`;
    const res = await fetch(api, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      posts?: Array<{ record?: { text?: string }; author?: { handle?: string; displayName?: string } }>;
    };
    const post = data?.posts?.[0];
    const text = (post?.record?.text ?? "").trim();
    if (!text) return null;
    const h = post?.author?.handle ?? handle;
    const dn = post?.author?.displayName;
    const title = dn ? `Bluesky · ${dn}` : `Bluesky · @${h}`;
    const block = [dn && `Display name: ${dn}`, `Handle: @${h}`, "", text].filter(Boolean).join("\n");
    return { title, text: block.slice(0, MAX_TEXT) };
  } catch {
    return null;
  }
}

async function fetchThreadsOembed(url: string): Promise<{ title: string; text: string } | null> {
  try {
    const api = `https://www.threads.net/api/oembed/?url=${encodeURIComponent(url)}`;
    const res = await fetch(api, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { author_name?: string; title?: string; html?: string };
    const text = stripHtml(data.html ?? data.title ?? "");
    if (!text || text.length < 4) return null;
    const title = data.author_name ? `Threads · @${data.author_name}` : "Threads post";
    return { title, text: text.slice(0, MAX_TEXT) };
  } catch {
    return null;
  }
}

async function fetchYoutubeOembed(url: string): Promise<{ title: string; text: string } | null> {
  if (!/\/\/(www\.|m\.)?youtube\.com\/watch\?|youtu\.be\//i.test(url)) return null;
  try {
    const api = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(api, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; author_name?: string; provider_name?: string };
    const title = data.title ?? "YouTube video";
    const author = data.author_name ?? "";
    const text = [`YouTube video (oEmbed — description not available in API).`, author && `Channel: ${author}`, `Title: ${title}`, `URL: ${url}`]
      .filter(Boolean)
      .join("\n");
    return { title: `YouTube · ${title.slice(0, 100)}`, text };
  } catch {
    return null;
  }
}

async function scrapeGenericHtml(url: string): Promise<{ title: string; text: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Cannot fetch URL: HTTP ${res.status}`);
  const html = await res.text();

  const title =
    html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)?.[1] ||
    html.match(/<meta[^>]+property='og:title'[^>]+content='([^']+)'/i)?.[1] ||
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
    "Unknown Article";

  const desc =
    html.match(/<meta[^>]+(?:name="description"|property="og:description")[^>]+content="([^"]+)"/i)?.[1] ??
    html.match(/<meta[^>]+(?:name='description'|property='og:description')[^>]+content='([^']+)'/i)?.[1] ??
    "";

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);

  return { title: title.trim(), text: ((desc ? `${desc} ` : "") + bodyText).slice(0, MAX_TEXT) };
}

export type UrlContentSource = "twitter" | "reddit" | "bluesky" | "threads" | "youtube" | "html";

export async function fetchUrlContent(urlStr: string): Promise<{ title: string; text: string; source: UrlContentSource }> {
  const expanded = await expandRedirects(urlStr.trim());
  let u: URL;
  try {
    u = new URL(expanded);
  } catch {
    throw new Error("Invalid URL");
  }

  const host = u.hostname.replace(/^www\./, "").toLowerCase();

  if (host === "twitter.com" || host === "x.com" || host === "mobile.twitter.com") {
    const r = await fetchTwitterOembed(expanded);
    if (r) return { ...r, source: "twitter" };
  }

  if (host.includes("reddit.com") || host === "redd.it" || host === "old.reddit.com" || host === "np.reddit.com" || host === "new.reddit.com") {
    const r = await fetchRedditContent(expanded);
    if (r) return { ...r, source: "reddit" };
  }

  if (host === "bsky.app") {
    const r = await fetchBlueskyContent(expanded);
    if (r) return { ...r, source: "bluesky" };
  }

  if (host === "threads.net") {
    const r = await fetchThreadsOembed(expanded);
    if (r) return { ...r, source: "threads" };
  }

  const yt = await fetchYoutubeOembed(expanded);
  if (yt) return { ...yt, source: "youtube" };

  const html = await scrapeGenericHtml(expanded);
  return { ...html, source: "html" };
}
