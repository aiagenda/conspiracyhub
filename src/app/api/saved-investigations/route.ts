import { NextRequest, NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";
import { userHasEffectivePro } from "@/lib/server/requireEffectivePro";

const FREE_SAVE_LIMIT = 5;

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

async function requireUser(req: NextRequest, admin: ReturnType<typeof getAdmin>): Promise<User | NextResponse> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "missing_token" }, { status: 401 });
  }
  const {
    data: { user },
    error,
  } = await admin.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  if (error || !user) return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const admin = getAdmin();
    const user = await requireUser(req, admin);
    if (user instanceof NextResponse) return user;

    const { data, error } = await admin
      .from("saved_investigations")
      .select("id, news_id, generated_article_id, title, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const items = (data ?? []).map((row) => ({
      id: row.id,
      newsId: row.news_id,
      generatedArticleId: row.generated_article_id,
      title: row.title,
      createdAt: row.created_at,
      boardPath: row.news_id
        ? `/board/${row.news_id}`
        : row.generated_article_id
          ? `/board/${row.generated_article_id}`
          : "/",
      articlePath: row.news_id ? `/article/${row.news_id}` : null,
    }));

    const isPro = await userHasEffectivePro(admin, user.id);
    return NextResponse.json({
      items,
      limit: isPro ? null : FREE_SAVE_LIMIT,
      count: items.length,
      isPro,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = getAdmin();
    const user = await requireUser(req, admin);
    if (user instanceof NextResponse) return user;

    const body = (await req.json()) as {
      newsId?: string;
      generatedArticleId?: string;
      title?: string;
    };
    const newsId = body.newsId?.trim() || undefined;
    const generatedArticleId = body.generatedArticleId?.trim() || undefined;
    const title = body.title?.trim();

    if ((!newsId && !generatedArticleId) || (newsId && generatedArticleId)) {
      return NextResponse.json({ error: "provide exactly one of newsId or generatedArticleId" }, { status: 400 });
    }
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

    const isPro = await userHasEffectivePro(admin, user.id);
    if (!isPro) {
      const { count } = await admin
        .from("saved_investigations")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      if ((count ?? 0) >= FREE_SAVE_LIMIT) {
        return NextResponse.json({ error: "save_limit", limit: FREE_SAVE_LIMIT }, { status: 403 });
      }
    }

    const row = {
      user_id: user.id,
      news_id: newsId ?? null,
      generated_article_id: generatedArticleId ?? null,
      title,
    };

    let existingQ = admin.from("saved_investigations").select("id, news_id, generated_article_id, title, created_at").eq("user_id", user.id);
    if (newsId) existingQ = existingQ.eq("news_id", newsId);
    else existingQ = existingQ.eq("generated_article_id", generatedArticleId!);
    const { data: existing } = await existingQ.maybeSingle();
    if (existing) return NextResponse.json({ ok: true, item: existing, alreadySaved: true });

    const { data: inserted, error: insErr } = await admin
      .from("saved_investigations")
      .insert(row)
      .select("id, news_id, generated_article_id, title, created_at")
      .single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
    return NextResponse.json({ ok: true, item: inserted });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = getAdmin();
    const user = await requireUser(req, admin);
    if (user instanceof NextResponse) return user;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { error } = await admin.from("saved_investigations").delete().eq("id", id).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
