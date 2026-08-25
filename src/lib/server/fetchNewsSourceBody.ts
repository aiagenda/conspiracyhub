import { fetchRedditArticleBody } from "@/lib/server/redditPostBody";
import {
  extractImagesFromHtml,
  extractOgImageFromHtml,
  normalizeImageUrl,
  type SourceImage,
} from "@/lib/server/inlineArticleImages";
import { fetchUrlContent } from "@/lib/urlContent";

const UA = "TheTheorist/1.0 (+https://the-theorist.com)";

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function fetchGuardianContent(guardianId: string): Promise<{ text: string; html: string }> {
  const key = process.env.GUARDIAN_API_KEY;
  if (!key) return { text: "", html: "" };
  try {
    const url = `https://content.guardianapis.com/${guardianId}?show-fields=body,trailText,byline&api-key=${key}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!res.ok) return { text: "", html: "" };
    const data = await res.json();
    const html: string = data?.response?.content?.fields?.body ?? "";
    return { text: htmlToText(html), html };
  } catch {
    return { text: "", html: "" };
  }
}

async function fetchGenericHtml(url: string): Promise<{ text: string; html: string; ogImage: string | null }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!res.ok) return { text: "", html: "", ogImage: null };
    const fullHtml = await res.text();
    const ogImage = extractOgImageFromHtml(fullHtml);
    const stripped = fullHtml
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "");
    const contentMatch =
      stripped.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ??
      stripped.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const raw = contentMatch ? contentMatch[1] : stripped;
    return { text: htmlToText(raw).slice(0, 8000), html: raw, ogImage };
  } catch {
    return { text: "", html: "", ogImage: null };
  }
}

export type NewsSourceFetchInput = {
  guardian_id?: string | null;
  url?: string | null;
  summary?: string | null;
  image?: string | null;
};

export type NewsSourceContent = {
  text: string;
  images: SourceImage[];
};

/** Fetch source text + extractable inline images for rewrite pipeline. */
export async function fetchNewsSourceContent(input: NewsSourceFetchInput): Promise<NewsSourceContent> {
  const articleUrl = (input.url ?? "").trim();
  const guardianId = (input.guardian_id ?? "").trim();
  const isGuardian = guardianId.includes("/");
  const isReddit = /reddit\.com\/r\//.test(articleUrl);

  let text = "";
  let images: SourceImage[] = [];

  if (isGuardian) {
    const g = await fetchGuardianContent(guardianId);
    text = g.text;
    images = extractImagesFromHtml(g.html, articleUrl);
  } else if (isReddit && articleUrl) {
    const r = await fetchRedditArticleBody(articleUrl);
    text = r.text;
    if (r.thumbnail) {
      const u = normalizeImageUrl(r.thumbnail);
      if (u) images.push({ url: u, caption: "Reddit post image" });
    }
  } else if (articleUrl.startsWith("http")) {
    const generic = await fetchGenericHtml(articleUrl);
    text = generic.text;
    images = extractImagesFromHtml(generic.html, articleUrl);
    if (generic.ogImage && !images.some((i) => i.url === generic.ogImage)) {
      images.unshift({ url: generic.ogImage, caption: "Lead image" });
    }
    if (!text) {
      try {
        const r = await fetchUrlContent(articleUrl);
        text = r.text;
      } catch {
        text = "";
      }
    }
  }

  const hero = normalizeImageUrl(input.image ?? "");
  if (hero && !images.some((i) => i.url === hero)) {
    images.unshift({ url: hero, caption: "Lead image" });
  }

  const summary = (input.summary ?? "").trim();
  if (text.length < 120 && summary.length >= 40) {
    text = summary.length > text.length ? summary : `${summary}\n\n${text}`.trim();
  }

  return { text: text.slice(0, 8000), images };
}

/** Text-only fetch (legacy). */
export async function fetchNewsSourceBody(input: NewsSourceFetchInput): Promise<string> {
  const { text } = await fetchNewsSourceContent(input);
  return text;
}
