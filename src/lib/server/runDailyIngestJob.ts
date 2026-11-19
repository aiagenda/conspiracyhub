import { createClient } from "@supabase/supabase-js";
import { ensureDailyIngestJobs, executeJob } from "@/lib/server/scraperScheduler";
import {
  DAILY_INGEST_JOB_KEYS,
  isDailyIngestJobKey,
  type DailyIngestJobKey,
} from "@/lib/server/dailyIngestJobs";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

export function dailyIngestJobKeyError(jobKey: string) {
  return {
    status: 400 as const,
    body: {
      error: "job_key required",
      allowed: [...DAILY_INGEST_JOB_KEYS],
      received: jobKey || undefined,
    },
  };
}

/** Run one of the five daily ingest jobs immediately (manual scheduler claim). */
export async function runDailyIngestJobByKey(jobKey: DailyIngestJobKey) {
  await ensureDailyIngestJobs();
  const db = admin();
  const { data: job, error } = await db
    .from("scraper_jobs")
    .select("id,job_key,name,target,schedule_cron,enabled,config")
    .eq("job_key", jobKey)
    .maybeSingle();
  if (error || !job) {
    return {
      status: 404 as const,
      body: { error: error?.message ?? "job not found", job_key: jobKey },
    };
  }
  const result = await executeJob(job, "manual");
  return {
    status: 200 as const,
    body: { ok: true, job_key: jobKey, name: job.name, result },
  };
}

export function parseDailyIngestJobKey(raw: string): DailyIngestJobKey | null {
  const jobKey = String(raw ?? "").trim();
  return isDailyIngestJobKey(jobKey) ? jobKey : null;
}