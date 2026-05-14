import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

function fingerprint(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for") ?? req.headers.get("x-real-ip") ?? "unknown";
  const ua = req.headers.get("user-agent") ?? "";
  return createHash("sha256").update(ip + ua).digest("hex").slice(0, 16);
}

export async function POST(req: NextRequest) {
  try {
    const admin = getAdmin();
    const body = await req.json();
    const { article_id, generated_article_id, thread_id, vote_type, value = 1 } = body;
    if (!vote_type) return NextResponse.json({ error: "vote_type required" }, { status: 400 });
    const fp = fingerprint(req);

    const hasArticle = Boolean(article_id);
    const hasGenerated = Boolean(generated_article_id);
    const hasThread = Boolean(thread_id);
    const targets = [hasArticle, hasGenerated, hasThread].filter(Boolean).length;
    if (targets !== 1) {
      return NextResponse.json(
        { error: "Provide exactly one of article_id, generated_article_id, or thread_id" },
        { status: 400 },
      );
    }

    const row = {
      article_id: hasArticle ? article_id : null,
      generated_article_id: hasGenerated ? generated_article_id : null,
      thread_id: hasThread ? thread_id : null,
      fingerprint: fp,
      vote_type: String(vote_type),
      value: typeof value === "number" ? value : 1,
    };

    const onConflict = hasArticle
      ? "article_id,fingerprint,vote_type"
      : hasGenerated
        ? "generated_article_id,fingerprint,vote_type"
        : "thread_id,fingerprint,vote_type";

    const { data, error } = await admin.from("votes").upsert(row, { onConflict }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    let aggregates: unknown[] = [];
    if (hasArticle) {
      const { data: agg } = await admin.from("article_votes").select("*").eq("article_id", article_id);
      aggregates = agg ?? [];
    } else if (hasGenerated) {
      const { data: agg } = await admin
        .from("generated_article_votes")
        .select("*")
        .eq("generated_article_id", generated_article_id);
      aggregates = agg ?? [];
    }

    return NextResponse.json({ voted: true, fingerprint: fp, aggregates, row: data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const admin = getAdmin();
    const { searchParams } = new URL(req.url);
    const article_id = searchParams.get("article_id");
    const generated_article_id = searchParams.get("generated_article_id");
    if (!article_id && !generated_article_id) {
      return NextResponse.json({ error: "article_id or generated_article_id required" }, { status: 400 });
    }
    if (article_id && generated_article_id) {
      return NextResponse.json({ error: "provide only one id" }, { status: 400 });
    }

    const fp = fingerprint(req);

    if (article_id) {
      const { data: agg } = await admin.from("article_votes").select("*").eq("article_id", article_id);
      const { data: myVotes } = await admin
        .from("votes")
        .select("vote_type,value")
        .eq("article_id", article_id)
        .eq("fingerprint", fp);
      return NextResponse.json({ aggregates: agg ?? [], my_votes: myVotes ?? [], fingerprint: fp });
    }

    const { data: agg } = await admin
      .from("generated_article_votes")
      .select("*")
      .eq("generated_article_id", generated_article_id!);
    const { data: myVotes } = await admin
      .from("votes")
      .select("vote_type,value")
      .eq("generated_article_id", generated_article_id!)
      .eq("fingerprint", fp);
    return NextResponse.json({ aggregates: agg ?? [], my_votes: myVotes ?? [], fingerprint: fp });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
