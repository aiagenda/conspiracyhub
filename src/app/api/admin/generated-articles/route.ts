import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pageViewCountsByPaths } from "@/lib/adminPageViewCounts";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

/** Paginated published generated articles + page_view counts per /blog/[slug]. */
export async function GET(req: NextRequest) {
  try {
    const db = admin();
    const page = Math.max(1, parseInt(new URL(req.url).searchParams.get("page") ?? "1", 10));
    const limit = 30;
    const from = (page - 1) * limit;

    const { data, count, error } = await db
      .from("generated_articles")
      .select("id, title, slug, published_at, category, status", { count: "exact" })
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .range(from, from + limit - 1);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = data ?? [];
    const paths = rows.map((p) => `/blog/${p.slug}`);
    const viewCounts = await pageViewCountsByPaths(db, paths);

    const posts = rows.map((p) => ({
      ...p,
      view_count: viewCounts[`/blog/${p.slug}`] ?? 0,
    }));

    return NextResponse.json({
      posts,
      total: count ?? 0,
      page,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
