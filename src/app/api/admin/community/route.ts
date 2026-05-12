import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

// GET — list threads (paginated, with post count)
export async function GET(req: NextRequest) {
  try {
    const db = admin();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = 40;
    const from = (page - 1) * limit;
    const statusFilter = searchParams.get("status"); // "removed" | "active"

    let q = db
      .from("threads")
      .select("id, title, body, author_name, author_fingerprint, category, status, post_count, credibility_score, oracle_analyzed, created_at, linked_article_id", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + limit - 1);

    if (statusFilter === "removed") q = q.eq("status", "removed");
    else q = q.neq("status", "removed");

    const { data, count, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Summary stats
    const { count: removedCount } = await db
      .from("threads")
      .select("id", { count: "exact", head: true })
      .eq("status", "removed");
    const { count: totalCount } = await db
      .from("threads")
      .select("id", { count: "exact", head: true });
    const { count: oracleCount } = await db
      .from("threads")
      .select("id", { count: "exact", head: true })
      .eq("oracle_analyzed", true);

    return NextResponse.json({
      threads: data ?? [],
      total: count ?? 0,
      page,
      summary: {
        total: totalCount ?? 0,
        removed: removedCount ?? 0,
        oracleAnalyzed: oracleCount ?? 0,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// PATCH — set thread status (remove / restore)
export async function PATCH(req: NextRequest) {
  try {
    const db = admin();
    const { id, status } = (await req.json()) as { id: string; status: string };
    if (!id || !["active", "removed"].includes(status)) {
      return NextResponse.json({ error: "id and status (active|removed) required" }, { status: 400 });
    }
    const { error } = await db.from("threads").update({ status }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// DELETE — permanently delete a thread + its posts
export async function DELETE(req: NextRequest) {
  try {
    const db = admin();
    const { id } = (await req.json()) as { id: string };
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    await db.from("thread_posts").delete().eq("thread_id", id);
    const { error } = await db.from("threads").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
