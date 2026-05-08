import { createClient } from "@supabase/supabase-js";
import ArticleReader from "@/components/ArticleReader";
import type { NewsItem } from "@/types";

async function fetchGuardianBody(guardianId: string): Promise<string> {
  const key = process.env.GUARDIAN_API_KEY;
  if (!key) return "";
  try {
    const url = `https://content.guardianapis.com/${guardianId}?show-fields=body,trailText,byline&api-key=${key}`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return "";
    const data = await res.json();
    const body: string = data?.response?.content?.fields?.body ?? "";
    return body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  } catch {
    return "";
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return <div className="min-h-screen bg-[#050c07] text-[#ff3333] p-8">[ERROR] Missing env.</div>;

  const admin = createClient(url, key);
  const { data: news } = await admin.from("news_items").select("*").eq("id", id).single();
  if (!news) return <div className="min-h-screen bg-[#050c07] text-[#ff3333] p-8">[ERROR] Article not found.</div>;

  const body = await fetchGuardianBody(news.guardian_id ?? "");

  const item: NewsItem = {
    id: news.id,
    guardian_id: news.guardian_id,
    title: news.title,
    summary: news.summary ?? "",
    url: news.url,
    image: news.image ?? null,
    date: news.published_at,
    section: news.section,
    score: news.score ?? 0,
    angle: news.angle ?? "",
  };

  return <ArticleReader item={item} body={body || news.summary || ""} />;
}
