import {
  DAILY_INGEST_JOB_KEYS,
  isDailyIngestJobKey,
} from "@/lib/server/dailyIngestJobs";
import {
  ensureDailyIngestJobs,
  executeJob,
  type ScraperJob,
} from "@/lib/server/scraperScheduler";
import { createClient } from "@supabase/supabase-js";

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

export { DAILY_INGEST_JOB_KEYS, isDailyIngestJobKey };

export type DailyIngestRunResult = {
  job_key: string;
  name: string;
  result: Awaited<ReturnType<typeof executeJob>>;
};

/** Run one of the five daily ingest jobs by scraper_jobs.job_key. */
export async function runDailyIngestJobByKey(
  jobKey: string,
): Promise<DailyIngestRunResult> {
  if (!isDailyIngestJobKey(jobKey)) {
    const err = new Error("job_key required");
    (err as Error & { allowed: string[] }).allowed = [...DAILY_INGEST_JOB_KEYS];
    throw err;
  }

  await ensureDailyIngestJobs();
  const db = admin();
  const { data: job, error } = await db
    .from("scraper_jobs")
    .select("id,job_key,name,target,schedule_cron,enabled,config")
    .eq("job_key", jobKey)
    .maybeSingle();
  if (error || !job) {
    throw new Error(error?.message ?? `job not found: ${jobKey}`);
  }

  const result = await executeJob(job as ScraperJob, "manual");
  return { job_key: jobKey, name: job.name, result };
}