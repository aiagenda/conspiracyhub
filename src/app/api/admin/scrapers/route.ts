import { requireAdminRequest } from "@/lib/server/requireAdminSession";
import { NextRequest, NextResponse } from "next/server";
import { runEnrichUapBriefs } from "@/app/api/uap-sightings/route";
import { runPursueDocumentIngest } from "@/lib/server/uapIngest";
import {
  executeJob,
  getSchedulerSnapshot,
} from "@/lib/server/scraperScheduler";
import { isValidCron } from "@/lib/server/schedulerTiming";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

/** Scheduler state is restricted to verified administrators. */
export async function GET(req: NextRequest) {
  const access = await requireAdminRequest(req);
  if ("response" in access) return access.response;
  try {
    return NextResponse.json(await getSchedulerSnapshot());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

/** Update schedule/enabled/config, or run a job now via { action:"run", id }. */
export async function PATCH(req: NextRequest) {
  const access = await requireAdminRequest(req);
  if ("response" in access) return access.response;
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "update");
    const id = String(body.id ?? "");

    if (action === "enrich_uap_briefs") {
      const limit = Math.min(
        Math.max(parseInt(String(body.limit ?? "12"), 10) || 12, 1),
        25,
      );
      try {
        const payload = await runEnrichUapBriefs(limit);
        return NextResponse.json({ ok: true, result: { ok: true, payload } });
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : String(e) },
          { status: 500 },
        );
      }
    }

    if (action === "fetch_pursue") {
      try {
        const payload = await runPursueDocumentIngest();
        return NextResponse.json({ ok: true, result: { ok: true, payload } });
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : String(e) },
          { status: 500 },
        );
      }
    }

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const db = admin();
    if (action === "run") {
      const { data: job, error } = await db
        .from("scraper_jobs")
        .select("id,job_key,name,target,schedule_cron,enabled,config")
        .eq("id", id)
        .maybeSingle();
      if (error || !job) {
        return NextResponse.json({ error: error?.message ?? "job not found" }, { status: 404 });
      }
      const result = await executeJob(job, "manual");
      return NextResponse.json({ ok: true, result });
    }

    const patch: Record<string, unknown> = {};
    if ("enabled" in body) patch.enabled = !!body.enabled;
    if ("schedule_cron" in body) {
      const schedule = String(body.schedule_cron ?? "").trim();
      if (!isValidCron(schedule)) return NextResponse.json({ error: "Use a valid five-field UTC cron schedule." }, { status: 400 });
      patch.schedule_cron = schedule;
    }
    if ("config" in body && body.config && typeof body.config === "object") {
      patch.config = body.config;
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No changes supplied" }, { status: 400 });
    }

    const { error } = await db.from("scraper_jobs").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
