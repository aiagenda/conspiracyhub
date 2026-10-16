import { fetchPublicSource } from "@/lib/server/sourceFetch";
import { fetchRedditArticleBody } from "@/lib/server/redditPostBody";
import {
  extractImagesFromHtml,
  extractOgImageFromHtml,
  normalizeImageUrl,
  type SourceImage,
} from "@/lib/server/inlineArticleImages";

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

async function fetchGuardianContent(guardianId: string): Promise<{ text: string; html: string; publishedAt?: string; title?: string }> {
  const key = process.env.GUARDIAN_API_KEY;
  if (!key) return { text: "", html: "" };
  try {
    const url = `https://content.guardianapis.com/${guardianId}?show-fields=body,trailText,byline&api-key=${key}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!res.ok) return { text: "", html: "" };
    const data = await res.json();
    const html: string = data?.response?.content?.fields?.body ?? "";
    return { text: htmlToText(html), html, title: data?.response?.content?.webTitle, publishedAt: data?.response?.content?.webPublicationDate };
  } catch {
    return { text: "", html: "" };
  }
}

async function fetchGenericHtml(url: string): Promise<{ text: string; html: string; ogImage: string | null; title?: string; publishedAt?: string; resolvedUrl?: string }> {
  try {
    const res = await fetchPublicSource(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    if (!res.ok) return { text: "", html: "", ogImage: null };
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/pdf")) {
      const bytes = await res.arrayBuffer();
      if (bytes.byteLength > 12 * 1024 * 1024) return { text: "", html: "", ogImage: null };
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await extractText(pdf, { mergePages: true });
      return { text: text.slice(0, 12000), html: "", ogImage: null, resolvedUrl: res.url || url };
    }
    const fullHtml = await res.text();
    const title = fullHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, " ").trim();
    if (/just a moment|access denied|verify you are human|robot check/i.test(title ?? "")) return { text: "", html: "", ogImage: null };
    const publishedRaw = fullHtml.match(/<meta[^>]+(?:property|name)=["'](?:article:published_time|datePublished|pubdate)["'][^>]+content=["']([^"']+)/i)?.[1]
      ?? fullHtml.match(/"datePublished"\s*:\s*"([^"\n]+)"/i)?.[1];
    const publishedAt = publishedRaw && Number.isFinite(Date.parse(publishedRaw)) ? new Date(publishedRaw).toISOString() : undefined;
    const ogImage = extractOgImageFromHtml(fullHtml);
    const stripped = fullHtml
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "");
    const contentMatch =
      stripped.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ??
      stripped.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const raw = contentMatch ? contentMatch[1] : stripped;
    // Without an article/main container use paragraphs, never navigation/consent chrome.
    const body = contentMatch ? raw : [...stripped.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)].map((m) => m[1]).join("\n\n");
    return { text: htmlToText(body).slice(0, 12000), html: raw, ogImage, title, publishedAt, resolvedUrl: res.url || url };
  } catch {
    return { text: "", html: "", ogImage: null };
  }
}

export type NewsSourceFetchInput = {
  guardian_id?: string | null;
  url?: string | null;
  summary?: string | null;
  image?: string | null;
  published_at?: string | null;
};

export type NewsSourceContent = {
  text: string;
  images: SourceImage[];
  title?: string;
  publishedAt?: string | null;
  resolvedUrl?: string;
  extraction: "body" | "summary" | "unavailable";
};

/** Fetch source text + extractable inline images for rewrite pipeline. */
export async function fetchNewsSourceContent(input: NewsSourceFetchInput): Promise<NewsSourceContent> {
  const articleUrl = (input.url ?? "").trim();
  const guardianId = (input.guardian_id ?? "").trim();
  const isGuardian = guardianId.includes("/");
  const isReddit = /reddit\.com\/r\//.test(articleUrl);

  let text = "";
  let images: SourceImage[] = [];
  let title: string | undefined;
  let publishedAt: string | null | undefined = input.published_at;
  let resolvedUrl = articleUrl;
  let extraction: NewsSourceContent["extraction"] = "body";

  if (isGuardian) {
    const g = await fetchGuardianContent(guardianId);
    text = g.text;
    title = g.title;
    publishedAt = g.publishedAt ?? publishedAt;
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
    title = generic.title;
    publishedAt = generic.publishedAt ?? publishedAt;
    resolvedUrl = generic.resolvedUrl ?? articleUrl;
    images = extractImagesFromHtml(generic.html, articleUrl);
    if (generic.ogImage && !images.some((i) => i.url === generic.ogImage)) {
      images.unshift({ url: generic.ogImage, caption: "Lead image" });
    }

  }

  const hero = normalizeImageUrl(input.image ?? "");
  if (hero && !images.some((i) => i.url === hero)) {
    images.unshift({ url: hero, caption: "Lead image" });
  }

  const summary = (input.summary ?? "").trim();
  if (text.length < 120 && summary.length >= 40) {
    text = summary.length > text.length ? summary : `${summary}\n\n${text}`.trim();
    extraction = "summary";
  }

  return { text: text.slice(0, 12000), images, title, publishedAt, resolvedUrl, extraction: text ? extraction : "unavailable" };
}

/** Text-only fetch (legacy). */
export async function fetchNewsSourceBody(input: NewsSourceFetchInput): Promise<string> {
  const { text } = await fetchNewsSourceContent(input);
  return text;
}
