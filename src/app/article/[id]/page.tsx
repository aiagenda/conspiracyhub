import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import ArticleReader from "@/components/ArticleReader";
import { omitIfHungarianScript } from "@/lib/locale";
import { newsSourceLabel } from "@/lib/newsSourceLabel";
import { fetchNewsSourceBody } from "@/lib/server/fetchNewsSourceBody";
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
    .select("title, summary, image, published_at, section, seo_description, rewrite_status")
    .eq("id", id)
    .single();

  if (!news) return {};

  const title = (news.title ?? "").slice(0, 60) || "Investigation";
  const seoDesc = omitIfHungarianScript(news.seo_description ?? "");
  const rawDesc = seoDesc || omitIfHungarianScript(news.summary ?? "");
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

  const articleUrl = news.url ?? "";
  const isReddit = /reddit\.com\/r\//.test(articleUrl);

  let redditThumbnail: string | null = null;
  const rewrittenMarkdown =
    news.rewrite_status === "ready" && typeof news.body_html === "string" ? news.body_html.trim() : "";

  let body = "";
  if (!rewrittenMarkdown) {
    const fetched = await fetchNewsSourceBody(news);
    body = fetched;
    if (isReddit && articleUrl) {
      const { fetchRedditArticleBody } = await import("@/lib/server/redditPostBody");
      const r = await fetchRedditArticleBody(articleUrl);
      redditThumbnail = r.thumbnail;
    }
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
    source: news.source ?? undefined,
  };

  const fallbackBody = omitIfHungarianScript(news.summary ?? "");
  const angleBody = omitIfHungarianScript(news.angle ?? "");
  const bodyFromFetch = body.trim();
  const fb = fallbackBody.trim();
  const ang = angleBody.trim();
  const readerBody = bodyFromFetch || fb || ang;
  /** Avoid showing the same line twice (header angle + body) when angle is the only text we have. */
  const itemForReader: NewsItem =
    !rewrittenMarkdown && !bodyFromFetch && !fb && ang && readerBody === ang ? { ...item, angle: "" } : item;

  const sourceLabel = newsSourceLabel(news.source, news.url);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: item.title,
    description: (news.seo_description ?? item.summary)?.slice(0, 200) || undefined,
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
      <ArticleReader
        item={itemForReader}
        body={rewrittenMarkdown ? "" : readerBody}
        bodyMarkdown={rewrittenMarkdown || undefined}
        sourceAttribution={
          articleUrl
            ? { label: sourceLabel, url: articleUrl, isRewritten: Boolean(rewrittenMarkdown) }
            : undefined
        }
        initialChatOpen={initialChatOpen}
        voteTheories={voteTheories}
      />
    </>
  );
}
