import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { sanitizeSources } from "@/lib/generatedArticleSourceUrls";
import { pageViewStatsByPaths } from "@/lib/adminPageViewCounts";
import { countArticleWords } from "@/lib/server/articleExpand";
import { runExpandExistingArticleCore } from "@/lib/server/generateArticleCore";

export const maxDuration = 300;

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
    const limit = 10;
    const from = (page - 1) * limit;

    const { data, count, error } = await db
      .from("generated_articles")
      .select("id, title, slug, published_at, category, status, content", { count: "exact" })
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
      const content = (p as { content?: string }).content ?? "";
      return {
        ...p,
        view_count: s.totalLoads,
        unique_viewers: s.uniqueReaders,
        has_oracle: oracleGenIds.has(p.id),
        word_count: countArticleWords(content),
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
 * - `{ "action": "expand_article", "id": "<uuid>" }` — long-form expand in place (same slug).
 * - `{ "action": "expand_top_short", "limit"?: number, "max_words"?: number }` — expand most-viewed short posts.
 */
export async function POST(req: NextRequest) {
  try {
    const db = admin();
    const body = (await req.json()) as { action?: string; id?: string; limit?: number; max_words?: number };

    if (body.action === "expand_article") {
      const id = String(body.id ?? "").trim();
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const { status, payload } = await runExpandExistingArticleCore(id);
      return NextResponse.json(payload, { status });
    }

    if (body.action === "expand_top_short") {
      const limit = Math.min(10, Math.max(1, Number(body.limit) || 3));
      const maxWords = Math.max(400, Number(body.max_words) || 1000);

      const { data: rows, error } = await db
        .from("generated_articles")
        .select("id, slug, title, content")
        .eq("status", "published");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      const paths = (rows ?? []).map((r) => `/blog/${r.slug}`);
      const viewStats = await pageViewStatsByPaths(db, paths);

      const candidates = (rows ?? [])
        .map((r) => ({
          id: r.id,
          title: r.title,
          slug: r.slug,
          word_count: countArticleWords(r.content ?? ""),
          unique_viewers: viewStats[`/blog/${r.slug}`]?.uniqueReaders ?? 0,
        }))
        .filter((r) => r.word_count < maxWords && r.unique_viewers > 0)
        .sort((a, b) => b.unique_viewers - a.unique_viewers)
        .slice(0, limit);

      const results: Array<Record<string, unknown>> = [];
      for (const c of candidates) {
        const { status, payload } = await runExpandExistingArticleCore(c.id);
        results.push({
          id: c.id,
          title: c.title,
          slug: c.slug,
          unique_viewers: c.unique_viewers,
          words_before: c.word_count,
          ok: status >= 200 && status < 300,
          ...(typeof payload === "object" && payload !== null ? payload : { error: String(payload) }),
        });
      }

      return NextResponse.json({ ok: true, expanded: results.length, results });
    }

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
