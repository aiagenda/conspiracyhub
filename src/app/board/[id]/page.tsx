import { createClient } from "@supabase/supabase-js";
import BoardScreen from "@/components/BoardScreen";
import type { NewsItem, OracleAnalysis } from "@/types";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://conspiracyhub.vercel.app";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return <div className="min-h-screen bg-[#050c07] text-[#ff3333] p-8">[ERROR] Missing Supabase environment variables.</div>;
  }
  const admin = createClient(url, key);
  const { id } = await params;

  const { data: news } = await admin.from("news_items").select("*").eq("id", id).maybeSingle();
  if (news) {
    const { data: cached } = await admin
      .from("oracle_analyses")
      .select("*")
      .eq("news_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (
      <BoardScreen
        news={news as NewsItem}
        initialAnalysis={(cached as OracleAnalysis | null) ?? null}
        backHref={`/article/${id}?return=board`}
        backLabel="← ARTICLE"
        oracleMode="news"
      />
    );
  }

  const { data: gen } = await admin
    .from("generated_articles")
    .select("*")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();

  if (!gen) {
    return <div className="min-h-screen bg-[#050c07] text-[#ff3333] p-8">[ERROR] Article not found.</div>;
  }

  const slug = String(gen.slug ?? "");
  const canonical = `${SITE_URL.replace(/\/$/, "")}/blog/${slug}`;
  const mapped: NewsItem = {
    id: String(gen.id),
    title: String(gen.title ?? ""),
    summary:
      (typeof gen.excerpt === "string" && gen.excerpt.trim()) ||
      (typeof gen.meta_description === "string" && gen.meta_description.trim()) ||
      "",
    url: canonical,
    image: null,
    date: String(gen.published_at ?? new Date().toISOString()),
    section: String(gen.category ?? "analysis"),
    score: 55,
    angle: (typeof gen.meta_description === "string" && gen.meta_description.trim()) || "",
    source: "generated",
  };

  const { data: cachedGen } = await admin
    .from("oracle_analyses")
    .select("*")
    .eq("generated_article_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <BoardScreen
      news={mapped}
      initialAnalysis={(cachedGen as OracleAnalysis | null) ?? null}
      backHref={`/blog/${slug}?return=board`}
      backLabel="← REPORT"
      oracleMode="generated"
    />
  );
}
