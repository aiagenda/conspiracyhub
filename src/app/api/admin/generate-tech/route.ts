import { requireAdminRequest } from "@/lib/server/requireAdminSession";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { runTechArticleCore, TECH_CATEGORY } from "@/lib/server/generateTechArticle";
import { publishReviewedArticle, type EditorialRow } from "@/lib/server/editorialAdmin";
import { countArticleWords } from "@/lib/server/articleExpand";

export const maxDuration = 300;

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

/**
 * GET /api/admin/generate-tech
 * - no params: AI & Tech desk articles (drafts first) for the admin review queue
 * - `?id=<uuid>`: full markdown + sources of one article, so drafts can be reviewed in the
 *   admin panel — the public /blog/[slug] route only serves `status = 'published'`.
 */
export async function GET(req: NextRequest) {
  const access = await requireAdminRequest(req);
  if ("response" in access) return access.response;
  try {
    const db = admin();

    const id = new URL(req.url).searchParams.get("id");
    if (id) {
      const { data, error } = await db
        .from("generated_articles")
        .select("id, title, slug, status, category, content, sources, meta_description, focus_keyword, tags")
        .eq("id", id)
        .single();
      if (error || !data) return NextResponse.json({ error: error?.message ?? "not_found" }, { status: 404 });
      if (data.category !== TECH_CATEGORY) {
        return NextResponse.json({ error: "not_a_tech_article" }, { status: 400 });
      }
      return NextResponse.json({ article: data });
    }

    const { data, error } = await db
      .from("generated_articles")
      .select("id, title, slug, excerpt, status, published_at, content, sources")
      .eq("category", TECH_CATEGORY)
      .in("status", ["draft", "published"])
      .order("published_at", { ascending: false })
      .limit(40);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data ?? []).map((r) => {
      const sources = Array.isArray(r.sources) ? (r.sources as Array<{ url?: string }>) : [];
      return {
        id: r.id,
        title: r.title,
        slug: r.slug,
        excerpt: r.excerpt,
        status: r.status,
        published_at: r.published_at,
        word_count: countArticleWords((r.content as string) ?? ""),
        source_count: sources.length,
        sources_with_links: sources.filter((s) => s?.url).length,
      };
    });

    // Drafts first so the review queue is what you see on open.
    rows.sort((a, b) => (a.status === b.status ? 0 : a.status === "draft" ? -1 : 1));

    return NextResponse.json({ articles: rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/**
 * POST /api/admin/generate-tech
 * - `{ sourceUrl?, sourceText?, angle?, publish? }` — write a new original article (draft by default)
 * - `{ action: "publish", id }`   — publish a draft
 * - `{ action: "unpublish", id }` — return a published article to draft
 * - `{ action: "delete", id }`    — delete outright
 */
export async function POST(req: NextRequest) {
  const access = await requireAdminRequest(req);
  if ("response" in access) return access.response;
  let body: {
    action?: string;
    id?: string;
    sourceUrl?: string;
    sourceText?: string;
    angle?: string;
    publish?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const action = body.action ? String(body.action) : "";

  if (action === "publish" || action === "unpublish" || action === "delete") {
    const id = String(body.id ?? "").trim();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    try {
      const db = admin();
      const { data: row, error: findErr } = await db
        .from("generated_articles")
        .select("*")
        .eq("id", id)
        .single();
      if (findErr || !row) return NextResponse.json({ error: findErr?.message ?? "not_found" }, { status: 404 });
      // Guard: this endpoint only manages the AI & Tech desk, never the conspiracy content.
      if (row.category !== TECH_CATEGORY) {
        return NextResponse.json({ error: "not_a_tech_article" }, { status: 400 });
      }

      if (action === "delete") {
        const { error } = await db.from("generated_articles").delete().eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      } else if (action === "publish") {
        const outcome = await publishReviewedArticle(db, row as EditorialRow);
        if (outcome.status !== 200) return NextResponse.json(outcome.body, { status: outcome.status });
      } else {
        const { error } = await db.from("generated_articles").update({ status: "draft" }).eq("id", id);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      }

      try {
        revalidatePath("/ai");
        revalidatePath(`/blog/${row.slug}`);
      } catch {
        /* */
      }
      return NextResponse.json({ ok: true, action, id });
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
    }
  }

  const sourceUrl = body.sourceUrl ? String(body.sourceUrl).trim() : undefined;
  const sourceText = body.sourceText ? String(body.sourceText) : undefined;

  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
    return NextResponse.json({ error: "sourceUrl must be http(s)" }, { status: 400 });
  }

  const { status, payload } = await runTechArticleCore({
    sourceUrl,
    sourceText,
    angle: body.angle ? String(body.angle).trim() : undefined,
    publish: false, // Publication always uses the shared evidence-review action.
  });

  return NextResponse.json(payload, { status });
}
