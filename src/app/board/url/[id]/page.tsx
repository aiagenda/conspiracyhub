import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import BoardScreen from "@/components/BoardScreen";
import type { NewsItem, OracleAnalysis, OracleSource } from "@/types";

export default async function UrlAnalysisBoardPage({ params }: { params: Promise<{ id: string }> }) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return <div className="min-h-screen bg-[#050c07] text-[#ff3333] p-8">[ERROR] Missing Supabase environment variables.</div>;
  }
  const admin = createClient(url, key);
  const { id } = await params;

  const { data: row, error } = await admin.from("url_analyses").select("*").eq("id", id).maybeSingle();
  if (error || !row) {
    return <div className="min-h-screen bg-[#050c07] text-[#ff3333] p-8">[ERROR] URL analysis not found.</div>;
  }

  const news: NewsItem = {
    id: String(row.id),
    title: row.title,
    summary: "",
    url: row.source_url,
    image: null,
    date: row.created_at ?? new Date().toISOString(),
    section: "URL",
    score: 65,
    angle: "User-submitted article",
  };

  const sources = Array.isArray(row.sources) ? (row.sources as OracleSource[]) : [];

  const initialAnalysis: OracleAnalysis = {
    id: row.id,
    nodes: row.nodes ?? [],
    edges: row.edges ?? [],
    theories: row.theories ?? [],
    sources,
    conclusion: row.conclusion ?? "",
    verdict: row.verdict ?? "QUESTIONABLE",
  };

  return (
    <div>
      <div className="fixed top-4 left-4 z-50 flex flex-wrap gap-2">
        <Link href="/" className="px-3 py-2 border border-[#1a3320] text-[#5a8068] bg-[#050c07] text-xs">
          ← BACK TO FEED
        </Link>
        <Link href="/search" className="px-3 py-2 border border-[#1a3320] text-[#5a8068] bg-[#050c07] text-xs">
          ← SEARCH
        </Link>
      </div>
      <BoardScreen news={news} initialAnalysis={initialAnalysis} />
    </div>
  );
}
