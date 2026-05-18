import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GeneratedArticleReader from "@/components/GeneratedArticleReader";
import { voteTheoriesFromOracleJson } from "@/lib/oracleVoteTheories";
import {
  blogArticleOgImageUrl,
  buildArticleJsonLd,
  buildFaqJsonLd,
  defaultOgImageUrl,
  getSiteUrl,
  injectInternalLinks,
  normalizeFaqs,
  rankRelatedArticles,
} from "@/lib/blogSeo";
import type { NewsItem } from "@/types";

export const revalidate = 86400;

const SITE_URL = getSiteUrl();

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  focus_keyword: string;
  meta_description: string;
  secondary_keywords: string[];
  sources: Array<{ title: string; url: string; description: string }>;
  published_at: string;
  mode: string;
  faqs?: unknown;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return {};

  const admin = createClient(url, key);
  const { data } = await admin
    .from("generated_articles")
    .select("title, meta_description, focus_keyword, secondary_keywords, tags, published_at, category")
    .eq("slug", slug)
    .eq("status", "published")
    .single();
  if (!data) return {};

  const canonicalUrl = `${SITE_URL}/blog/${slug}`;
  const ogImage = blogArticleOgImageUrl(data.title);
  return {
    title: `${data.title} | The Theorist`,
    description: data.meta_description,
    keywords: [data.focus_keyword, ...(data.secondary_keywords ?? []), ...(data.tags ?? [])].join(", "),
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title: data.title,
      description: data.meta_description,
      publishedTime: data.published_at,
      section: data.category,
      siteName: "The Theorist",
      images: [
        { url: ogImage, width: 1200, height: 630, alt: data.title },
        { url: defaultOgImageUrl(), width: 1200, height: 630, alt: "The Theorist" },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: data.title,
      description: data.meta_description,
      images: [ogImage],
    },
  };
}

export default async function BlogArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const rawChat = sp.chat;
  const chatVal = Array.isArray(rawChat) ? rawChat[0] : rawChat;
  const initialChatOpen =
    chatVal === "1" || chatVal === "open" || chatVal === "true" || chatVal === "yes";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return notFound();

  const admin = createClient(url, key);
  const { data } = await admin.from("generated_articles").select("*").eq("slug", slug).eq("status", "published").single();
  if (!data) return notFound();
  const article = data as Article;

  const { data: peers } = await admin
    .from("generated_articles")
    .select("slug, title, focus_keyword, category, tags")
    .eq("status", "published")
    .neq("slug", slug)
    .order("published_at", { ascending: false })
    .limit(40);

  const related = rankRelatedArticles(
    {
      slug,
      focus_keyword: article.focus_keyword,
      category: article.category,
      tags: article.tags,
    },
    peers ?? [],
  );

  const markdown = injectInternalLinks(article.content, {
    siteUrl: SITE_URL,
    currentSlug: slug,
    related,
  });

  const faqs = normalizeFaqs(article.faqs, markdown);

  const canonical = `${SITE_URL}/blog/${slug}`;
  const summary =
    (typeof article.excerpt === "string" && article.excerpt.trim()) ||
    (typeof article.meta_description === "string" && article.meta_description.trim()) ||
    "";

  const item: NewsItem = {
    id: article.id,
    title: article.title,
    summary,
    url: canonical,
    image: blogArticleOgImageUrl(article.title),
    date: article.published_at,
    section: article.category,
    score: 55,
    angle:
      (typeof article.meta_description === "string" && article.meta_description.trim()) ||
      (typeof article.excerpt === "string" && article.excerpt.trim()) ||
      "",
    source: "generated",
  };

  const articleLd = buildArticleJsonLd(article, canonical);
  const faqLd = buildFaqJsonLd(faqs, canonical);

  const { data: oracleAnalysis } = await admin
    .from("oracle_analyses")
    .select("theories")
    .eq("generated_article_id", article.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const voteTheories = voteTheoriesFromOracleJson(oracleAnalysis?.theories);

  const sources = Array.isArray(article.sources) ? article.sources : [];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      {faqLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      ) : null}
      <GeneratedArticleReader
        item={item}
        slug={slug}
        markdown={markdown}
        sources={sources}
        initialChatOpen={initialChatOpen}
        voteTheories={voteTheories}
        mode={article.mode}
      />
    </>
  );
}
