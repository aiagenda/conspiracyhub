import { requireAdminRequest } from "@/lib/server/requireAdminSession";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { sanitizeSources } from "@/lib/generatedArticleSourceUrls";
import { pageViewStatsByPaths } from "@/lib/adminPageViewCounts";
import { manualReviewIssues, publishReviewedArticle, type EditorialRow } from "@/lib/server/editorialAdmin";
import { canonicalSourceUrl } from "@/lib/editorialQuality";
import { countArticleWords } from "@/lib/server/articleExpand";
import { runExpandExistingArticleCore } from "@/lib/server/generateArticleCore";

export const maxDuration = 300;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

function invalidateArticle(slug: string) {
  for (const path of ["/", "/blog", "/ai", "/sitemap.xml", `/blog/${slug}`]) revalidatePath(path);
}

/** Paginated published generated articles + page_view counts per /blog/[slug]. */
export async function GET(req: NextRequest) {
  const access = await requireAdminRequest(req);
  if ("response" in access) return access.response;
  try {
    const db = admin();
    const params = new URL(req.url).searchParams;
    const id = params.get("id");
    if (id) {
      const { data: article, error } = await db.from("generated_articles").select("*").eq("id", id).maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!article) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ article, quality_issues: manualReviewIssues(article as EditorialRow) });
    }
    const filter = params.get("status") ?? "published";
    if (!["draft", "published", "all"].includes(filter)) return NextResponse.json({ error: "invalid_status" }, { status: 400 });
    const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
    const limit = 10;
    const from = (page - 1) * limit;

    let query = db.from("generated_articles")
      .select("*", { count: "exact" });
    query = filter === "all" ? query.in("status", ["draft", "published"]) : query.eq("status", filter);
    const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, from + limit - 1);

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
        quality_issues: manualReviewIssues(p as EditorialRow),
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
  const access = await requireAdminRequest(req);
  if ("response" in access) return access.response;
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
  const access = await requireAdminRequest(req);
  if ("response" in access) return access.response;
  try {
    const db = admin();
    const body = (await req.json()) as {
      action?: string; id?: string; limit?: number; max_words?: number;
      title?: string; content?: string; excerpt?: string; meta_description?: string;
      sources?: Array<{ title: string; url: string; description: string }>;
      updated_at?: string; review_note?: string; checks?: Record<string, boolean>;
    };

    if (["save", "review", "publish", "unpublish"].includes(body.action ?? "")) {
      const id = String(body.id ?? "").trim();
      if (!id) return NextResponse.json({ error: "id_required" }, { status: 400 });
      const { data, error: readError } = await db.from("generated_articles").select("*").eq("id", id).maybeSingle();
      if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });
      const article = data as EditorialRow;
      if (!article.updated_at) return NextResponse.json({ error: "Apply 20261015110000_editorial_quality before using the review desk." }, { status: 503 });
      if (!body.updated_at || body.updated_at !== article.updated_at) return NextResponse.json({ error: "This article changed. Reload before editing or publishing." }, { status: 409 });
      if (body.action === "publish") {
        const outcome = await publishReviewedArticle(db, article);
        if (outcome.status === 200) invalidateArticle(article.slug);
        return NextResponse.json(outcome.body, { status: outcome.status });
      }
      let patch: Record<string, unknown>;
      if (body.action === "save") {
        if (typeof body.title !== "string" || typeof body.content !== "string" || !body.title.trim() || !body.content.trim()) {
          return NextResponse.json({ error: "title_and_content_required" }, { status: 400 });
        }
        if (body.content.length > 250_000 || body.title.length > 300) return NextResponse.json({ error: "article_too_large" }, { status: 400 });
        if (!Array.isArray(body.sources) || body.sources.some((source) => !source || typeof source.title !== "string" || !canonicalSourceUrl(source.url ?? ""))) {
          return NextResponse.json({ error: "Sources must contain a title and a valid HTTP(S) source URL." }, { status: 400 });
        }
        patch = { title: body.title.trim(), content: body.content.trim(), sources: body.sources,
          excerpt: String(body.excerpt ?? "").slice(0, 1000), meta_description: String(body.meta_description ?? "").slice(0, 500),
          status: "draft", verified_at: null,
          editorial_checks: { passed: false, issues: ["Content changed; review this version before publishing."], checked_at: new Date().toISOString(), source_count: 0 } };
      } else if (body.action === "review") {
        const required = ["sources_opened", "claims_checked", "dates_checked", "uncertainty_labelled"];
        if (!required.every((key) => body.checks?.[key] === true) || String(body.review_note ?? "").trim().length < 20) {
          return NextResponse.json({ error: "Complete each review check and add a note of at least 20 characters." }, { status: 400 });
        }
        const issues = manualReviewIssues(article);
        if (issues.length) return NextResponse.json({ error: "quality_issues", issues }, { status: 422 });
        const checkedAt = new Date().toISOString();
        const domains = new Set((article.sources ?? []).map((source) => canonicalSourceUrl(source.url ?? "")).filter(Boolean).map((url) => new URL(url).hostname));
        patch = { verified_at: checkedAt, editorial_checks: {
          passed: true, issues: [], checked_at: checkedAt, source_count: domains.size,
          reviewer_id: access.userId, method: "human", review_note: body.review_note!.trim().slice(0, 2000), checks: body.checks,
        } };
      } else patch = { status: "draft" };
      const { data: changed, error } = await db.from("generated_articles").update(patch)
        .eq("id", id).eq("updated_at", article.updated_at).select("id").maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      if (!changed) return NextResponse.json({ error: "This article changed. Reload and review the current version." }, { status: 409 });
      invalidateArticle(article.slug);
      return NextResponse.json({ ok: true });
    }

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
