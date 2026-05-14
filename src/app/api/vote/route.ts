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

function normId(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
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

/** reader_reaction: avoid PostgREST upsert quirks on partial unique indexes — update or insert. */
async function putReaderReaction(
  admin: ReturnType<typeof getAdmin>,
  opts: {
    fingerprint: string;
    article_id: string | null;
    generated_article_id: string | null;
    value: -1 | 1;
  },
): Promise<{ error: { message: string } | null }> {
  const { fingerprint: fp, article_id, generated_article_id, value } = opts;
  const hasArticle = Boolean(article_id);

  let sel = admin
    .from("votes")
    .select("id")
    .eq("vote_type", READER_REACTION_VOTE_TYPE)
    .eq("fingerprint", fp)
    .limit(1);
  if (hasArticle) {
    sel = sel.eq("article_id", article_id!).is("generated_article_id", null).is("thread_id", null);
  } else {
    sel = sel.eq("generated_article_id", generated_article_id!).is("article_id", null).is("thread_id", null);
  }

  const { data: rows, error: selErr } = await sel;
  if (selErr) return { error: selErr };

  const existingId = rows?.[0]?.id as string | undefined;

  if (existingId) {
    const { error: updErr } = await admin.from("votes").update({ value }).eq("id", existingId);
    return { error: updErr };
  }

  const { error: insErr } = await admin.from("votes").insert({
    article_id: hasArticle ? article_id : null,
    generated_article_id: hasArticle ? null : generated_article_id,
    thread_id: null,
    fingerprint: fp,
    vote_type: READER_REACTION_VOTE_TYPE,
    value,
  });
  return { error: insErr };
}

export async function POST(req: NextRequest) {
  try {
    const admin = getAdmin();
    const body = await req.json();
    const vote_type = body.vote_type;
    const valueRaw = body.value;

    const article_id = normId(body.article_id);
    const generated_article_id = normId(body.generated_article_id);
    const thread_id = normId(body.thread_id);

    if (!vote_type) return NextResponse.json({ error: "vote_type required" }, { status: 400 });
    const fp = fingerprint(req);
    const vt = String(vote_type);

    const hasArticle = article_id.length > 0;
    const hasGenerated = generated_article_id.length > 0;
    const hasThread = thread_id.length > 0;
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

    const reactionNum = typeof valueRaw === "number" && Number.isFinite(valueRaw) ? valueRaw : Number(valueRaw);

    if (vt === READER_REACTION_VOTE_TYPE) {
      if (!Number.isFinite(reactionNum) || (reactionNum !== -1 && reactionNum !== 0 && reactionNum !== 1)) {
        return NextResponse.json({ error: "reader_reaction requires value -1, 0, or 1" }, { status: 400 });
      }
    }

    let aggregates: unknown[] = [];
    let reader_reaction = { score: 0, up: 0, down: 0 };
    let my_reader_reaction: -1 | 0 | 1 = 0;

    if (vt === READER_REACTION_VOTE_TYPE && reactionNum === 0) {
      let del = admin.from("votes").delete().eq("fingerprint", fp).eq("vote_type", READER_REACTION_VOTE_TYPE);
      if (hasArticle) del = del.eq("article_id", article_id);
      else del = del.eq("generated_article_id", generated_article_id);
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
          .eq("generated_article_id", generated_article_id);
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

    if (vt === READER_REACTION_VOTE_TYPE) {
      const v = reactionNum as -1 | 1;
      const { error: putErr } = await putReaderReaction(admin, {
        fingerprint: fp,
        article_id: hasArticle ? article_id : null,
        generated_article_id: hasGenerated ? generated_article_id : null,
        value: v,
      });
      if (putErr) return NextResponse.json({ error: putErr.message }, { status: 400 });

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
      } else {
        const { data: agg } = await admin
          .from("generated_article_votes")
          .select("*")
          .eq("generated_article_id", generated_article_id);
        aggregates = agg ?? [];
        reader_reaction = await readerReactionStats(admin, { generated_article_id });
        const { data: myVotesAfter } = await admin
          .from("votes")
          .select("vote_type,value")
          .eq("generated_article_id", generated_article_id)
          .eq("fingerprint", fp);
        my_reader_reaction = parseMyReaderReaction(myVotesAfter ?? []);
      }

      return NextResponse.json({
        voted: true,
        fingerprint: fp,
        aggregates,
        reader_reaction,
        my_reader_reaction,
      });
    }

    const numericValue =
      typeof valueRaw === "number" && Number.isFinite(valueRaw) ? valueRaw : Number(valueRaw);
    const rowValue = Number.isFinite(numericValue) ? numericValue : 1;

    const rowPayload = {
      article_id: hasArticle ? article_id : null,
      generated_article_id: hasGenerated ? generated_article_id : null,
      thread_id: hasThread ? thread_id : null,
      fingerprint: fp,
      vote_type: vt,
      value: rowValue,
    };

    const onConflict = hasArticle
      ? "article_id,fingerprint,vote_type"
      : hasGenerated
        ? "generated_article_id,fingerprint,vote_type"
        : "thread_id,fingerprint,vote_type";

    const { data: upsertRows, error } = await admin.from("votes").upsert(rowPayload, { onConflict }).select("id");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const upserted = upsertRows?.[0];

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
        .eq("generated_article_id", generated_article_id);
      aggregates = agg ?? [];
      reader_reaction = await readerReactionStats(admin, { generated_article_id });
      const { data: myVotesAfter } = await admin
        .from("votes")
        .select("vote_type,value")
        .eq("generated_article_id", generated_article_id)
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
    const article_id = normId(searchParams.get("article_id"));
    const generated_article_id = normId(searchParams.get("generated_article_id"));
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
      .eq("generated_article_id", generated_article_id);
    const { data: myVotes } = await admin
      .from("votes")
      .select("vote_type,value")
      .eq("generated_article_id", generated_article_id)
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
