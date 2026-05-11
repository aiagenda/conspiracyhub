import { createClient } from "@supabase/supabase-js";
import BoardScreen from "@/components/BoardScreen";
import type { NewsItem, OracleAnalysis } from "@/types";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return <div className="min-h-screen bg-[#050c07] text-[#ff3333] p-8">[ERROR] Missing Supabase environment variables.</div>;
  }
  const admin = createClient(url, key);
  const { id } = await params;
  const { data: news } = await admin.from("news_items").select("*").eq("id", id).single();
  const { data: cached } = await admin
    .from("oracle_analyses")
    .select("*")
    .eq("news_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!news) {
    return <div className="min-h-screen bg-[#050c07] text-[#ff3333] p-8">[ERROR] Article not found.</div>;
  }

  return <BoardScreen news={news as NewsItem} initialAnalysis={(cached as OracleAnalysis | null) ?? null} backHref={`/article/${id}`} backLabel="← ARTICLE" />;
}
