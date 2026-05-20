import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 3600; // rebuild sitemap every hour

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://conspiracyhub.vercel.app";

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: SITE_URL, lastModified: new Date(), changeFrequency: "hourly", priority: 1.0 },
  { url: `${SITE_URL}/uap`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  { url: `${SITE_URL}/community`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.85 },
  { url: `${SITE_URL}/outbreaks`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
  { url: `${SITE_URL}/insider-radar`, lastModified: new Date(), changeFrequency: "daily", priority: 0.85 },
  { url: `${SITE_URL}/search`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
  { url: `${SITE_URL}/guide`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  { url: `${SITE_URL}/faq`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.3 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) return STATIC_ROUTES;

  const supabase = createClient(url, key);
  const { data: articles } = await supabase
    .from("news_items")
    .select("id, published_at, image")
    .order("published_at", { ascending: false })
    .limit(5000);

  const articleRoutes: MetadataRoute.Sitemap = (articles ?? []).map((row) => ({
    url: `${SITE_URL}/article/${row.id}`,
    lastModified: row.published_at ? new Date(row.published_at) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
    ...(row.image ? { images: [row.image] } : {}),
  }));

  // Blog/generated articles
  const { data: blogPosts } = await supabase
    .from("generated_articles")
    .select("slug, published_at")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(500);

  const blogRoutes: MetadataRoute.Sitemap = (blogPosts ?? []).map(row => ({
    url: `${SITE_URL}/blog/${row.slug}`,
    lastModified: row.published_at ? new Date(row.published_at) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,  // Higher priority than source articles — this is original content
  }));

  // Blog index
  const blogIndex: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/blog`, lastModified: new Date(), changeFrequency: "daily" as const, priority: 0.85 },
  ];

  return [...STATIC_ROUTES, ...blogIndex, ...blogRoutes, ...articleRoutes];
}
