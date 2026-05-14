import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { sanitizeSources } from "@/lib/generatedArticleSourceUrls";
import { pageViewStatsByPaths } from "@/lib/adminPageViewCounts";

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
    const viewStats = await pageViewStatsByPaths(db, paths);

    const ids = rows.map((p) => p.id);
    const { data: oracleRows } = ids.length
      ? await db.from("oracle_analyses").select("generated_article_id").in("generated_article_id", ids)
      : { data: [] as { generated_article_id: string | null }[] };
    const oracleGenIds = new Set(
      (oracleRows ?? []).map((r) => r.generated_article_id).filter((id): id is string => Boolean(id)),
    );

    const posts = rows.map((p) => {
      const s = viewStats[`/blog/${p.slug}`] ?? { totalLoads: 0, uniqueReaders: 0 };
      return {
        ...p,
        view_count: s.totalLoads,
        unique_viewers: s.uniqueReaders,
        has_oracle: oracleGenIds.has(p.id),
      };
    });

    return NextResponse.json({
      posts,
      total: count ?? 0,
      page,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/** DELETE body: `{ id: string }` — one investigation report. */
export async function DELETE(req: NextRequest) {
  try {
    const db = admin();
    const body = (await req.json()) as { id?: string };
    const id = String(body.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { error } = await db.from("generated_articles").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    try {
      revalidatePath("/blog");
    } catch {
      /* */
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/**
 * POST body:
 * - `{ "action": "delete_all_published" }` — remove every published report (destructive).
 * - `{ "action": "sanitize_all_sources" }` — strip non-whitelisted source URLs in-place (all statuses).
 */
export async function POST(req: NextRequest) {
  try {
    const db = admin();
    const body = (await req.json()) as { action?: string };

    if (body.action === "delete_all_published") {
      const { error, count } = await db.from("generated_articles").delete({ count: "exact" }).eq("status", "published");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      try {
        revalidatePath("/blog");
      } catch {
        /* */
      }
      return NextResponse.json({ ok: true, deleted: count ?? 0 });
    }

    if (body.action === "sanitize_all_sources") {
      const pageSize = 100;
      let lastId: string | null = null;
      let updated = 0;
      for (;;) {
        let q = db
          .from("generated_articles")
          .select("id, sources")
          .order("id", { ascending: true })
          .limit(pageSize);
        if (lastId) q = q.gt("id", lastId);
        const { data: rows, error } = await q;
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        if (!rows?.length) break;
        for (const row of rows) {
          const next = sanitizeSources(row.sources);
          const { error: upErr } = await db.from("generated_articles").update({ sources: next }).eq("id", row.id);
          if (!upErr) updated += 1;
        }
        lastId = rows[rows.length - 1]?.id ?? null;
        if (rows.length < pageSize) break;
      }
      try {
        revalidatePath("/blog");
      } catch {
        /* */
      }
      return NextResponse.json({ ok: true, rowsTouched: updated });
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
