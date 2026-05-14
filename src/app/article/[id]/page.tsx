import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import ArticleReader from "@/components/ArticleReader";
import { omitIfHungarianScript } from "@/lib/locale";
import { fetchRedditArticleBody } from "@/lib/server/redditPostBody";
import { voteTheoriesFromOracleJson } from "@/lib/oracleVoteTheories";
import type { NewsItem } from "@/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://conspiracyhub.vercel.app";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return {};

  const admin = createClient(url, key);
  const { data: news } = await admin
    .from("news_items")
    .select("title, summary, image, published_at, section")
    .eq("id", id)
    .single();

  if (!news) return {};

  const title = (news.title ?? "").slice(0, 60) || "Investigation";
  const rawDesc = omitIfHungarianScript(news.summary ?? "");
  const description = rawDesc.slice(0, 155) || "Read the full investigation on The Theorist.";
  const canonicalUrl = `${SITE_URL}/article/${id}`;
  const images = news.image
    ? [{ url: news.image, width: 1200, height: 630, alt: title }]
    : [];

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title,
      description,
      publishedTime: news.published_at ?? undefined,
      section: news.section ?? undefined,
      images,
    },
    twitter: {
      card: news.image ? "summary_large_image" : "summary",
      title,
      description,
      ...(news.image ? { images: [news.image] } : {}),
    },
  };
}

function htmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<p[^>]*>/gi, "")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function fetchGuardianBody(guardianId: string): Promise<string> {
  const key = process.env.GUARDIAN_API_KEY;
  if (!key) return "";
  try {
    const url = `https://content.guardianapis.com/${guardianId}?show-fields=body,trailText,byline&api-key=${key}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return "";
    const data = await res.json();
    const body: string = data?.response?.content?.fields?.body ?? "";
    return htmlToText(body);
  } catch {
    return "";
  }
}

/** Fetch + extract readable text from any article URL (for non-Guardian, non-Reddit sources). */
async function fetchGenericBody(articleUrl: string): Promise<string> {
  if (!articleUrl?.startsWith("http")) return "";

  try {
    const res = await fetch(articleUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TheTheorist/1.0; +https://conspiracyhub.vercel.app)" },
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
    if (!res.ok) return "";
    const html = await res.text();
    // Strip non-content sections
    const stripped = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[\s>][\s\S]*?<\/nav>/gi, "")
      .replace(/<header[\s>][\s\S]*?<\/header>/gi, "")
      .replace(/<footer[\s>][\s\S]*?<\/footer>/gi, "")
      .replace(/<aside[\s>][\s\S]*?<\/aside>/gi, "");
    // Prefer <article> or <main> if present
    const contentMatch =
      stripped.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ??
      stripped.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
    const raw = contentMatch ? contentMatch[1] : stripped;
    const text = htmlToText(raw).slice(0, 8000);
    if (text.length < 60 || text.split(/\s+/).length < 12) return "";
    return text;
  } catch {
    return "";
  }
}

export default async function ArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const rawChat = sp.chat;
  const chatVal = Array.isArray(rawChat) ? rawChat[0] : rawChat;
  const initialChatOpen =
    chatVal === "1" || chatVal === "open" || chatVal === "true" || chatVal === "yes";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return <div className="min-h-screen bg-[#050c07] text-[#ff3333] p-8">[ERROR] Missing env.</div>;

  const admin = createClient(url, key);
  const { data: news } = await admin.from("news_items").select("*").eq("id", id).single();
  if (!news) return <div className="min-h-screen bg-[#050c07] text-[#ff3333] p-8">[ERROR] Article not found.</div>;

  // Guardian articles have IDs like "world/2026/may/11/title" (contain "/").
  // All other sources (reddit, gnews, rss) have IDs like "reddit-abc123".
  const isGuardian = (news.guardian_id ?? "").includes("/");
  const articleUrl = news.url ?? "";
  const isReddit = /reddit\.com\/r\//.test(articleUrl);

  let redditThumbnail: string | null = null;
  let body: string;
  if (isGuardian) {
    body = await fetchGuardianBody(news.guardian_id ?? "");
  } else if (isReddit) {
    const r = await fetchRedditArticleBody(articleUrl);
    redditThumbnail = r.thumbnail;
    body = r.text;
  } else {
    body = await fetchGenericBody(articleUrl);
  }

  const { data: oracleAnalysis } = await admin
    .from("oracle_analyses")
    .select("theories")
    .eq("news_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const voteTheories = voteTheoriesFromOracleJson(oracleAnalysis?.theories);

  const item: NewsItem = {
    id: news.id,
    guardian_id: news.guardian_id,
    title: news.title,
    summary: omitIfHungarianScript(news.summary ?? ""),
    url: news.url,
    image: news.image ?? redditThumbnail ?? null,
    date: news.published_at,
    section: news.section,
    score: news.score ?? 0,
    angle: omitIfHungarianScript(news.angle ?? ""),
  };

  const fallbackBody = omitIfHungarianScript(news.summary ?? "");
  const angleBody = omitIfHungarianScript(news.angle ?? "");
  const bodyFromFetch = body.trim();
  const fb = fallbackBody.trim();
  const ang = angleBody.trim();
  const readerBody = bodyFromFetch || fb || ang;
  /** Avoid showing the same line twice (header angle + body) when angle is the only text we have. */
  const itemForReader: NewsItem =
    !bodyFromFetch && !fb && ang && readerBody === ang ? { ...item, angle: "" } : item;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: item.title,
    description: item.summary?.slice(0, 200) || undefined,
    datePublished: item.date,
    dateModified: item.date,
    url: `${SITE_URL}/article/${item.id}`,
    ...(item.image ? { image: [item.image] } : {}),
    publisher: {
      "@type": "Organization",
      name: "The Theorist",
      url: SITE_URL,
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/article/${item.id}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <ArticleReader item={itemForReader} body={readerBody} initialChatOpen={initialChatOpen} voteTheories={voteTheories} />
    </>
  );
}
