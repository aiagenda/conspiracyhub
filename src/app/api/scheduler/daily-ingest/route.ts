import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkCronAuth,
  executeJob,
  ensureDailyIngestJobs,
} from "@/lib/server/scraperScheduler";
import {
  DAILY_INGEST_JOB_KEYS,
  isDailyIngestJobKey,
} from "@/lib/server/dailyIngestJobs";

export const maxDuration = 300;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

/** Run one daily ingest job by job_key (Bearer CRON_SECRET). Used by 07:00 UTC Cursor automation. */
export async function POST(req: NextRequest) {
  if (!checkCronAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { job_key?: string };
    const jobKey = String(body.job_key ?? "").trim();
    if (!isDailyIngestJobKey(jobKey)) {
      return NextResponse.json(
        { error: "job_key required", allowed: [...DAILY_INGEST_JOB_KEYS] },
        { status: 400 },
      );
    }

    await ensureDailyIngestJobs();
    const db = admin();
    const { data: job, error } = await db
      .from("scraper_jobs")
      .select("id,job_key,name,target,schedule_cron,enabled,config")
      .eq("job_key", jobKey)
      .maybeSingle();
    if (error || !job) {
      return NextResponse.json(
        { error: error?.message ?? "job not found", job_key: jobKey },
        { status: 404 },
      );
    }

    const result = await executeJob(job, "manual");
    return NextResponse.json({
      ok: true,
      job_key: jobKey,
      name: job.name,
      result,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
