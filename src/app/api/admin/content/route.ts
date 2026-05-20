import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pageViewStatsByPaths } from "@/lib/adminPageViewCounts";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// GET — list articles (paginated, with oracle analysis indicator)
export async function GET(req: NextRequest) {
  try {
    const db = admin();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = 10;
    const from = (page - 1) * limit;
    const minScore = parseInt(searchParams.get("min_score") ?? "0", 10);

    let q = db
      .from("news_items")
      .select("id, title, url, score, angle, section, published_at, source", { count: "exact" })
      .order("published_at", { ascending: false })
      .range(from, from + limit - 1);

    if (minScore > 0) q = q.gte("score", minScore);

    const { data, count, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Which of these have oracle analyses
    const ids = (data ?? []).map((a) => a.id);
    const { data: analysed } = ids.length
      ? await db.from("oracle_analyses").select("news_id").in("news_id", ids)
      : { data: [] };
    const analysedSet = new Set((analysed ?? []).map((a) => a.news_id));

    const paths = ids.map((id) => `/article/${id}`);
    const viewStats = await pageViewStatsByPaths(db, paths);

    const articles = (data ?? []).map((a) => {
      const s = viewStats[`/article/${a.id}`] ?? { totalLoads: 0, uniqueReaders: 0 };
      return {
        ...a,
        date: a.published_at,  // alias for frontend compatibility
        has_oracle: analysedSet.has(a.id),
        view_count: s.totalLoads,
        unique_viewers: s.uniqueReaders,
      };
    });

    // Summary
    const { count: highThreat } = await db
      .from("news_items")
      .select("id", { count: "exact", head: true })
      .gte("score", 75);
    const { count: oracleTotal } = await db
      .from("oracle_analyses")
      .select("id", { count: "exact", head: true });

    return NextResponse.json({
      articles,
      total: count ?? 0,
      page,
      summary: {
        totalArticles: count ?? 0,
        highThreat: highThreat ?? 0,
        oracleAnalyses: oracleTotal ?? 0,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// DELETE — remove an article + its oracle analysis
export async function DELETE(req: NextRequest) {
  try {
    const db = admin();
    const { id } = (await req.json()) as { id: string };
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    // Clean up related data
    await db.from("oracle_analyses").delete().eq("news_id", id);
    await db.from("threads").update({ linked_article_id: null }).eq("linked_article_id", id);
    const { error } = await db.from("news_items").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
