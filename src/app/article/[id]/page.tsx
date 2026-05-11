import { createClient } from "@supabase/supabase-js";
import ArticleReader from "@/components/ArticleReader";
import { omitIfHungarianScript } from "@/lib/locale";
import type { NewsItem } from "@/types";

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

/** Fetch + extract readable text from any article URL (for non-Guardian sources). */
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
    // Discard if extraction returned garbage (too short or no spaces)
    if (text.length < 80 || text.split(" ").length < 15) return "";
    return text;
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

  // Guardian articles have IDs like "world/2026/may/11/title" (contain "/").
  // All other sources (reddit, gnews, rss) have IDs like "reddit-abc123".
  const isGuardian = (news.guardian_id ?? "").includes("/");
  const body = isGuardian
    ? await fetchGuardianBody(news.guardian_id ?? "")
    : await fetchGenericBody(news.url ?? "");

  const item: NewsItem = {
    id: news.id,
    guardian_id: news.guardian_id,
    title: news.title,
    summary: omitIfHungarianScript(news.summary ?? ""),
    url: news.url,
    image: news.image ?? null,
    date: news.published_at,
    section: news.section,
    score: news.score ?? 0,
    angle: omitIfHungarianScript(news.angle ?? ""),
  };

  const fallbackBody = omitIfHungarianScript(news.summary ?? "");
  return <ArticleReader item={item} body={body || fallbackBody} />;
}
