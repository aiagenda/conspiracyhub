import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import {
  READER_REACTION_VOTE_TYPE,
  aggregateReactionValues,
} from "@/lib/readerReactionVote";

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

async function readerReactionStats(
  admin: ReturnType<typeof getAdmin>,
  opts: { article_id?: string | null; generated_article_id?: string | null },
) {
  let q = admin.from("votes").select("value").eq("vote_type", READER_REACTION_VOTE_TYPE);
  if (opts.article_id) q = q.eq("article_id", opts.article_id);
  else if (opts.generated_article_id) q = q.eq("generated_article_id", opts.generated_article_id);
  else return { score: 0, up: 0, down: 0 };
  const { data } = await q;
  return aggregateReactionValues((data ?? []).map((r: { value: number }) => r.value));
}

function parseMyReaderReaction(myVotes: { vote_type: string; value: number }[] | null | undefined): -1 | 0 | 1 {
  const row = (myVotes ?? []).find((v) => v.vote_type === READER_REACTION_VOTE_TYPE);
  if (row?.value === 1) return 1;
  if (row?.value === -1) return -1;
  return 0;
}

export async function POST(req: NextRequest) {
  try {
    const admin = getAdmin();
    const body = await req.json();
    const { article_id, generated_article_id, thread_id, vote_type, value = 1 } = body;
    if (!vote_type) return NextResponse.json({ error: "vote_type required" }, { status: 400 });
    const fp = fingerprint(req);
    const vt = String(vote_type);

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

    if (vt === READER_REACTION_VOTE_TYPE && hasThread) {
      return NextResponse.json(
        { error: "reader_reaction is only for feed articles or investigation reports" },
        { status: 400 },
      );
    }

    if (vt === READER_REACTION_VOTE_TYPE) {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n) || (n !== -1 && n !== 0 && n !== 1)) {
        return NextResponse.json({ error: "reader_reaction requires value -1, 0, or 1" }, { status: 400 });
      }
    }

    let aggregates: unknown[] = [];
    let reader_reaction = { score: 0, up: 0, down: 0 };
    let my_reader_reaction: -1 | 0 | 1 = 0;

    if (vt === READER_REACTION_VOTE_TYPE && Number(value) === 0) {
      let del = admin.from("votes").delete().eq("fingerprint", fp).eq("vote_type", READER_REACTION_VOTE_TYPE);
      if (hasArticle) del = del.eq("article_id", article_id);
      else del = del.eq("generated_article_id", generated_article_id!);
      const { error: delErr } = await del;
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

      if (hasArticle) {
        const { data: agg } = await admin.from("article_votes").select("*").eq("article_id", article_id);
        aggregates = agg ?? [];
        reader_reaction = await readerReactionStats(admin, { article_id });
      } else {
        const { data: agg } = await admin
          .from("generated_article_votes")
          .select("*")
          .eq("generated_article_id", generated_article_id!);
        aggregates = agg ?? [];
        reader_reaction = await readerReactionStats(admin, { generated_article_id });
      }
      my_reader_reaction = 0;
      return NextResponse.json({
        voted: false,
        cleared: true,
        fingerprint: fp,
        aggregates,
        reader_reaction,
        my_reader_reaction,
      });
    }

    const rowPayload = {
      article_id: hasArticle ? article_id : null,
      generated_article_id: hasGenerated ? generated_article_id : null,
      thread_id: hasThread ? thread_id : null,
      fingerprint: fp,
      vote_type: vt,
      value: typeof value === "number" ? value : 1,
    };

    const onConflict = hasArticle
      ? "article_id,fingerprint,vote_type"
      : hasGenerated
        ? "generated_article_id,fingerprint,vote_type"
        : "thread_id,fingerprint,vote_type";

    const { data: upserted, error } = await admin.from("votes").upsert(rowPayload, { onConflict }).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    if (hasArticle) {
      const { data: agg } = await admin.from("article_votes").select("*").eq("article_id", article_id);
      aggregates = agg ?? [];
      reader_reaction = await readerReactionStats(admin, { article_id });
      const { data: myVotesAfter } = await admin
        .from("votes")
        .select("vote_type,value")
        .eq("article_id", article_id)
        .eq("fingerprint", fp);
      my_reader_reaction = parseMyReaderReaction(myVotesAfter ?? []);
    } else if (hasGenerated) {
      const { data: agg } = await admin
        .from("generated_article_votes")
        .select("*")
        .eq("generated_article_id", generated_article_id!);
      aggregates = agg ?? [];
      reader_reaction = await readerReactionStats(admin, { generated_article_id });
      const { data: myVotesAfter } = await admin
        .from("votes")
        .select("vote_type,value")
        .eq("generated_article_id", generated_article_id!)
        .eq("fingerprint", fp);
      my_reader_reaction = parseMyReaderReaction(myVotesAfter ?? []);
    }

    return NextResponse.json({
      voted: true,
      fingerprint: fp,
      aggregates,
      reader_reaction,
      my_reader_reaction,
      row: upserted,
    });
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
      const reader_reaction = await readerReactionStats(admin, { article_id });
      const my_reader_reaction = parseMyReaderReaction(myVotes ?? []);
      return NextResponse.json({
        aggregates: agg ?? [],
        my_votes: myVotes ?? [],
        fingerprint: fp,
        reader_reaction,
        my_reader_reaction,
      });
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
    const reader_reaction = await readerReactionStats(admin, { generated_article_id });
    const my_reader_reaction = parseMyReaderReaction(myVotes ?? []);
    return NextResponse.json({
      aggregates: agg ?? [],
      my_votes: myVotes ?? [],
      fingerprint: fp,
      reader_reaction,
      my_reader_reaction,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
