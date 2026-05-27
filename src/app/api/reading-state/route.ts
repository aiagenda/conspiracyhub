import { NextRequest, NextResponse } from "next/server";
import { createClient, type User } from "@supabase/supabase-js";

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
      .from("user_reading_state")
      .select("news_id, generated_article_id, title, path, score, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ state: null });
    return NextResponse.json({ state: data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const admin = getAdmin();
    const user = await requireUser(req, admin);
    if (user instanceof NextResponse) return user;

    const body = (await req.json()) as {
      newsId?: string;
      generatedArticleId?: string;
      title?: string;
      path?: string;
      score?: number;
    };

    const title = body.title?.trim();
    const path = body.path?.trim();
    if (!title || !path) return NextResponse.json({ error: "title and path required" }, { status: 400 });

    const row = {
      user_id: user.id,
      news_id: body.newsId?.trim() || null,
      generated_article_id: body.generatedArticleId?.trim() || null,
      title,
      path,
      score: typeof body.score === "number" ? Math.round(body.score) : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await admin.from("user_reading_state").upsert(row, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, state: row });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
