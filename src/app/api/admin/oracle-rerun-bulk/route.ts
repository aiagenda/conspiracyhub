import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runOraclePipelineInsert } from "@/lib/server/oraclePipeline";
import { requireAdminSession } from "@/lib/server/requireAdminSession";

export const maxDuration = 300;

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

/**
 * POST body: `{ scope: "feed" | "analysis", offset: number, limit?: number }`
 * Runs fresh Oracle for up to `limit` rows (default 2, max 5) starting at `offset`.
 * Client loops with increasing offset until `done`.
 */
export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      return NextResponse.json(
        { error: "oracle_config", message: "OPENAI_API_KEY is not configured." },
        { status: 503 },
      );
    }

    const admin = getAdminClient();
    const gate = await requireAdminSession(admin, req);
    if ("response" in gate) return gate.response;

    const body = (await req.json()) as { scope?: string; offset?: number; limit?: number };
    const scope = body.scope === "analysis" ? "analysis" : body.scope === "feed" ? "feed" : null;
    if (!scope) {
      return NextResponse.json({ error: "scope must be feed or analysis" }, { status: 400 });
    }

    const offset = Math.max(0, Number.isFinite(body.offset) ? Math.floor(body.offset!) : 0);
    const limit = Math.min(5, Math.max(1, Number.isFinite(body.limit) ? Math.floor(body.limit!) : 2));

    if (scope === "feed") {
      const { count: total, error: cErr } = await admin.from("news_items").select("id", { count: "exact", head: true });
      if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

      const { data: rows, error: qErr } = await admin
        .from("news_items")
        .select("id")
        .order("date", { ascending: false })
        .range(offset, offset + limit - 1);
      if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

      const ids = (rows ?? []).map((r) => r.id as string);
      let succeeded = 0;
      const errors: { id: string; error: string }[] = [];

      for (const newsId of ids) {
        const result = await runOraclePipelineInsert(admin, { newsId });
        if (result.ok) succeeded += 1;
        else {
          errors.push({ id: newsId, error: result.error + (result.message ? `: ${result.message}` : "") });
        }
      }

      const nextOffset = offset + ids.length;
      const done = ids.length === 0 || nextOffset >= (total ?? 0);
      return NextResponse.json({
        scope: "feed",
        offset,
        batchSize: ids.length,
        nextOffset,
        total: total ?? 0,
        succeeded,
        failed: ids.length - succeeded,
        errors,
        done,
      });
    }

    const { count: total, error: cErr } = await admin
      .from("generated_articles")
      .select("id", { count: "exact", head: true })
      .eq("status", "published");
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });

    const { data: rows, error: qErr } = await admin
      .from("generated_articles")
      .select("id")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

    const ids = (rows ?? []).map((r) => r.id as string);
    let succeeded = 0;
    const errors: { id: string; error: string }[] = [];

    for (const generatedArticleId of ids) {
      const result = await runOraclePipelineInsert(admin, { generatedArticleId });
      if (result.ok) succeeded += 1;
      else {
        errors.push({ id: generatedArticleId, error: result.error + (result.message ? `: ${result.message}` : "") });
      }
    }

    const nextOffset = offset + ids.length;
    const done = ids.length === 0 || nextOffset >= (total ?? 0);
    return NextResponse.json({
      scope: "analysis",
      offset,
      batchSize: ids.length,
      nextOffset,
      total: total ?? 0,
      succeeded,
      failed: ids.length - succeeded,
      errors,
      done,
    });
  } catch (e) {
    console.error("[admin/oracle-rerun-bulk]", e);
    return NextResponse.json(
      { error: "oracle_bulk_failed", message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
