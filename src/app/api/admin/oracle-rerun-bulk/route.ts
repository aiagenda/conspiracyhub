import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminSession } from "@/lib/server/requireAdminSession";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

/**
 * POST body: `{ scope: "feed" | "analysis" }`
 *
 * RESET (delete) oracle_analyses rows for the given scope so boards become empty
 * and fresh analyses can be started manually from the board UI.
 *
 * feed     → deletes all oracle_analyses where news_id IS NOT NULL
 * analysis → deletes all oracle_analyses where generated_article_id IS NOT NULL
 *
 * Does NOT run any Oracle pipeline — this is a clear/reset, not a re-run.
 */
export async function POST(req: NextRequest) {
  try {
    const admin = getAdminClient();
    const gate = await requireAdminSession(admin, req);
    if ("response" in gate) return gate.response;

    const body = (await req.json()) as { scope?: string };
    const scope = body.scope === "analysis" ? "analysis" : body.scope === "feed" ? "feed" : null;
    if (!scope) {
      return NextResponse.json({ error: "scope must be feed or analysis" }, { status: 400 });
    }

    if (scope === "feed") {
      const { error, count } = await admin
        .from("oracle_analyses")
        .delete({ count: "exact" })
        .not("news_id", "is", null);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ scope: "feed", deleted: count ?? 0 });
    }

    // analysis
    const { error, count } = await admin
      .from("oracle_analyses")
      .delete({ count: "exact" })
      .not("generated_article_id", "is", null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ scope: "analysis", deleted: count ?? 0 });
  } catch (e) {
    console.error("[admin/oracle-rerun-bulk]", e);
    return NextResponse.json(
      { error: "oracle_bulk_failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
