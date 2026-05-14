import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import GeneratedArticleReader from "@/components/GeneratedArticleReader";
import type { NewsItem } from "@/types";

export const revalidate = 86400;

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-theorist.com";

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
    },
    twitter: {
      card: "summary",
      title: data.title,
      description: data.meta_description,
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

  const canonical = `${SITE_URL.replace(/\/$/, "")}/blog/${slug}`;
  const summary =
    (typeof article.excerpt === "string" && article.excerpt.trim()) ||
    (typeof article.meta_description === "string" && article.meta_description.trim()) ||
    "";

  const item: NewsItem = {
    id: article.id,
    title: article.title,
    summary,
    url: canonical,
    image: null,
    date: article.published_at,
    section: article.category,
    score: 55,
    angle:
      (typeof article.meta_description === "string" && article.meta_description.trim()) ||
      (typeof article.excerpt === "string" && article.excerpt.trim()) ||
      "",
    source: "generated",
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.meta_description,
    keywords: [article.focus_keyword, ...(article.secondary_keywords ?? [])].join(", "),
    datePublished: article.published_at,
    dateModified: article.published_at,
    url: canonical,
    publisher: { "@type": "Organization", name: "The Theorist", url: SITE_URL },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
  };

  const sources = Array.isArray(article.sources) ? article.sources : [];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <GeneratedArticleReader
        item={item}
        slug={slug}
        markdown={article.content}
        sources={sources}
        initialChatOpen={initialChatOpen}
      />
    </>
  );
}
