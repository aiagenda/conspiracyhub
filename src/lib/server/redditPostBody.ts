/**
 * Build readable article text from a Reddit thread URL (server-side).
 * Uses the public .json API: selftext when present; otherwise title + link + top comments.
 */

const UA = "TheTheorist/1.0 (+https://conspiracyhub.vercel.app)";

export type RedditArticleFetch = { text: string; thumbnail: string | null };

function redditCommentsId(articleUrl: string): string | null {
  const m = articleUrl.match(/\/comments\/([a-z0-9]+)/i);
  return m?.[1] ?? null;
}

function stripMd(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/^>\s?/gm, "")
    .trim();
}

function pickThumbnail(post: Record<string, unknown>): string | null {
  const t = post.thumbnail;
  if (
    typeof t === "string" &&
    /^https?:\/\//i.test(t) &&
    t !== "self" &&
    t !== "default" &&
    t !== "nsfw" &&
    !t.includes("redditstatic.com/emoji")
  ) {
    return t.replace(/&amp;/g, "&");
  }
  const prev = post.preview as { images?: Array<{ source?: { url?: string } }> } | undefined;
  const u = prev?.images?.[0]?.source?.url;
  if (typeof u === "string" && /^https?:\/\//i.test(u)) {
    return u.replace(/&amp;/g, "&");
  }
  return null;
}

type RedditListing = { data?: { children?: Array<{ kind?: string; data?: Record<string, unknown> }> } };

export async function fetchRedditArticleBody(articleUrl: string): Promise<RedditArticleFetch> {
  const id = redditCommentsId(articleUrl);
  if (!id) return { text: "", thumbnail: null };

  try {
    const jsonUrl = `https://www.reddit.com/comments/${id}.json?depth=2&limit=40`;
    const res = await fetch(jsonUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
    });
    if (!res.ok) return { text: "", thumbnail: null };
    const data = (await res.json()) as RedditListing[];

    const rawPost = data?.[0]?.data?.children?.[0]?.data;
    if (!rawPost || typeof rawPost !== "object") return { text: "", thumbnail: null };
    const post = rawPost as Record<string, unknown>;
    const thumbnail = pickThumbnail(post);

    const title = String(post.title ?? "").trim();
    const sub = String(post.subreddit ?? "").trim();
    const linkUrl = String(post.url ?? "").trim();
    const permalink = String(post.permalink ?? "").trim();
    const threadUrl = permalink.startsWith("http")
      ? permalink
      : permalink
        ? `https://www.reddit.com${permalink}`
        : articleUrl;

    const self = String(post.selftext ?? "").trim();
    if (self && self !== "[deleted]" && self !== "[removed]" && self.length >= 40) {
      return { text: self.slice(0, 8000), thumbnail };
    }

    const parts: string[] = [];
    parts.push(
      "This Reddit thread has little or no self-text in the API (often a link post). Below: headline, context, and excerpts from top-level comments.",
    );
    if (title) parts.push(`\nTitle: ${title}`);
    if (sub) parts.push(`\nSubreddit: r/${sub}`);
    if (linkUrl && linkUrl !== articleUrl && /^https?:\/\//i.test(linkUrl)) {
      parts.push(`\nLinked URL: ${linkUrl}`);
    }
    parts.push(`\nFull discussion: ${threadUrl}`);

    const comments = data?.[1]?.data?.children ?? [];
    const blocks: string[] = [];
    for (const c of comments) {
      if (c.kind !== "t1") continue;
      const d = c.data as { body?: string; author?: string; stickied?: boolean };
      if (d.stickied) continue;
      const author = String(d.author ?? "").toLowerCase();
      if (author === "automoderator") continue;
      let cbody = String(d.body ?? "").trim();
      if (!cbody || cbody === "[deleted]" || cbody === "[removed]") continue;
      cbody = stripMd(cbody);
      if (cbody.length < 25) continue;
      blocks.push(`— (${d.author ?? "?"})\n${cbody.slice(0, 900)}`);
      if (blocks.join("\n\n").length > 6500) break;
    }

    if (blocks.length) {
      parts.push("\n\n--- Top comments ---\n\n");
      parts.push(blocks.join("\n\n"));
    } else if (self && self.length > 0 && self !== "[removed]" && self !== "[deleted]") {
      parts.push(`\n\nPost text:\n${stripMd(self)}`);
    }

    return { text: parts.join("").slice(0, 8000), thumbnail };
  } catch {
    return { text: "", thumbnail: null };
  }
}
