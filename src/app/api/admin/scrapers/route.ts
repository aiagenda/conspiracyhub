import { NextRequest, NextResponse } from "next/server";
import {
  executeJob,
  getSchedulerSnapshot,
} from "@/lib/server/scraperScheduler";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

/** Open access for now — protect with auth before production hardening. */
export async function GET() {
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
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const action = String(body.action ?? "update");
    const id = String(body.id ?? "");
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
    if ("schedule_cron" in body) patch.schedule_cron = String(body.schedule_cron ?? "").trim();
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
