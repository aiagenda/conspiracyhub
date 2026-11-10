import { createClient } from "@supabase/supabase-js";
import { runScraper } from "@/app/api/scraper/route";
import { runUapScrape } from "@/app/api/uap-sightings/route";
import { runUapFullScrape } from "@/lib/server/uapIngest";
import { DAILY_INGEST_JOBS } from "@/lib/server/dailyIngestJobs";
import { runGenerateArticleCore } from "@/lib/server/generateArticleCore";
import { runSearchConsoleSync } from "@/lib/server/searchConsoleSync";
import { runOutbreakRefresh } from "@/lib/server/runOutbreakRefresh";
import { runInsiderRadarTwitterRefresh } from "@/lib/server/insiderRadarIngest";
import { runRedditRadarScan } from "@/lib/server/redditRadar";
import { runSeismicRefresh } from "@/lib/server/seismicFeeds";
import { sendWeeklyBriefing } from "@/lib/server/weeklyBriefing";
export { checkCronAuth } from "@/lib/server/cronAuth";
import { cronOccurrence, scheduleDueAt } from "@/lib/server/schedulerTiming";
export { matchesCronNow } from "@/lib/server/schedulerTiming";

export type ScraperJob = {
  id: string;
  job_key: string;
  name: string;
  target:
    | "news_scraper"
    | "uap_scraper"
    | "article_writer"
    | "search_console"
    | "outbreak_scraper"
    | "insider_radar_scraper"
    | "reddit_radar_scraper"
    | "seismic_scraper"
    | "weekly_briefing";
  schedule_cron: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  next_run_at?: string | null;
  retry_at?: string | null;
  lease_expires_at?: string | null;
  failure_count?: number;
};

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

async function runNewsScraper(): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const openAiKey = process.env.OPENAI_API_KEY;
  if (!openAiKey) return { ok: false, status: 500, payload: { error: "OPENAI_API_KEY missing" } };
  try {
    const payload = await runScraper(openAiKey);
    return { ok: true, status: 200, payload };
  } catch (e) {
    return { ok: false, status: 500, payload: { error: e instanceof Error ? e.message : String(e) } };
  }
}

async function runUapScraper(config: Record<string, unknown> | null): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const maxNewRaw = config?.max_new;
  const maxNew = Math.min(Math.max(
    typeof maxNewRaw === "number" ? maxNewRaw : parseInt(String(maxNewRaw ?? "70"), 10) || 70,
    1
  ), 120);
  const mode = (config?.mode as string) ?? "full";
  try {
    const payload =
      mode === "nuforc_only"
        ? await runUapScrape(maxNew)
        : await runUapFullScrape(maxNew);
    return { ok: true, status: 200, payload };
  } catch (e) {
    return { ok: false, status: 500, payload: { error: e instanceof Error ? e.message : String(e) } };
  }
}

/** Idempotent — keeps five daily ingest jobs present, enabled, and configured for 09:00 UTC tick. */
export async function ensureDailyIngestJobs() {
  const db = admin();
  for (const job of DAILY_INGEST_JOBS) {
    const { error } = await db.from("scraper_jobs").upsert({ ...job }, { onConflict: "job_key" });
    if (error) console.warn(`[scraper] ensure daily ingest ${job.job_key}:`, error.message);
  }
}

async function runArticleWriter(config: Record<string, unknown> | null): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const mode = (config?.mode as string) ?? "news_jacking";
  const { status, payload } = await runGenerateArticleCore(mode);
  const ok =
    status >= 200 &&
    status < 300 &&
    typeof payload === "object" &&
    payload !== null &&
    (payload as { success?: boolean }).success === true;
  return { ok, status, payload };
}

async function runSearchConsoleScraper(): Promise<{ ok: boolean; status: number; payload: unknown }> {
  try {
    const payload = await runSearchConsoleSync();
    return { ok: true, status: 200, payload };
  } catch (e) {
    return { ok: false, status: 500, payload: { error: e instanceof Error ? e.message : String(e) } };
  }
}

async function runOutbreakScraper(): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const { ok, status, payload } = await runOutbreakRefresh({ skipCache: true });
  return { ok, status, payload };
}

async function runInsiderRadarScraper(): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const { ok, status, payload } = await runInsiderRadarTwitterRefresh();
  return { ok, status, payload };
}

async function runRedditRadarScraper(): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const result = await runRedditRadarScan();
  return { ok: result.ok, status: 200, payload: result };
}

async function runSeismicScraper(): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const { ok, status, payload } = await runSeismicRefresh();
  return { ok, status, payload };
}

async function runWeeklyBriefingJob(): Promise<{ ok: boolean; status: number; payload: unknown }> {
  try {
    const payload = await sendWeeklyBriefing(admin());
    return { ok: true, status: 200, payload };
  } catch (e) {
    return { ok: false, status: 500, payload: { error: e instanceof Error ? e.message : String(e) } };
  }
}

export async function executeJob(job: ScraperJob, trigger: "cron" | "manual", scheduledFor?: Date) {
  const db = admin();
  const now = new Date();
  const nextAt = cronOccurrence(job.schedule_cron, now, "next").toISOString();
  const { data, error } = await db.rpc("claim_scraper_job", {
    p_job_id: job.id,
    p_trigger: trigger,
    p_scheduled_for: (scheduledFor ?? scheduleDueAt(job, now)).toISOString(),
    p_next_run_at: nextAt,
    p_expected_cron: job.schedule_cron,
  });
  if (error) throw new Error(`Scheduler claim unavailable. Apply migration 20261015130000_durable_scheduler: ${error.message}`);
  const run = data as { id: string; started_at: string; attempt: number } | null;
  if (!run) return { skipped: true, reason: "leased_or_not_due" };

  let result: { ok: boolean; status: number; payload: unknown };
  try {
    const resp =
      job.target === "news_scraper"
        ? await runNewsScraper()
        : job.target === "article_writer"
          ? await runArticleWriter(job.config ?? {})
          : job.target === "search_console"
            ? await runSearchConsoleScraper()
            : job.target === "outbreak_scraper"
              ? await runOutbreakScraper()
              : job.target === "insider_radar_scraper"
                ? await runInsiderRadarScraper()
                : job.target === "reddit_radar_scraper"
                  ? await runRedditRadarScraper()
                  : job.target === "seismic_scraper"
                    ? await runSeismicScraper()
                    : job.target === "weekly_briefing"
                      ? await runWeeklyBriefingJob()
                      : await runUapScraper(job.config ?? {});

    result = resp;
  } catch (e) {
    result = { ok: false, status: 500, payload: { error: e instanceof Error ? e.message : String(e) } };
  }
  const message = result.ok ? null : (
    typeof result.payload === "object" && result.payload !== null && "error" in result.payload
      ? String(result.payload.error) : `HTTP ${result.status} — check run details`
  );
  const { data: finished, error: finishError } = await db.rpc("finish_scraper_job", {
    p_job_id: job.id, p_run_id: run.id, p_success: result.ok,
    p_next_run_at: cronOccurrence(job.schedule_cron, new Date(), "next").toISOString(),
    p_http_status: result.status, p_result: result.payload, p_error: message,
  });
  if (finishError || !finished) {
    throw new Error(`Scheduler could not record completion: ${finishError?.message ?? "lease lost"}`);
  }
  return { skipped: false, ...result, run_id: run.id, attempt: run.attempt };
}

/** Read-only: viewing the console must never reset an operator's enabled/schedule choices. */
export async function getSchedulerSnapshot() {
  const db = admin();
  const { data: jobs, error: jobsErr } = await db
    .from("scraper_jobs")
    .select("id,job_key,name,target,schedule_cron,enabled,config,next_run_at,retry_at,lease_expires_at,failure_count")
    .order("name", { ascending: true });
  if (jobsErr) throw new Error(`Scheduler unavailable; apply 20261015130000_durable_scheduler if pending. ${jobsErr.message}`);
  const jobList = (jobs ?? []) as ScraperJob[];
  const jobIds = jobList.map((j) => j.id);
  const { data: runs, error: runsError } = jobIds.length
    ? await db.from("scraper_runs")
        .select("id,job_id,trigger,status,started_at,finished_at,duration_ms,http_status,error_text,result,scheduled_for,attempt")
        .in("job_id", jobIds).order("started_at", { ascending: false }).limit(200)
    : { data: [], error: null };
  if (runsError) throw new Error(runsError.message);
  const grouped = new Map<string, Array<Record<string, unknown>>>();
  for (const run of runs ?? []) {
    const list = grouped.get(String(run.job_id)) ?? [];
    list.push(run as Record<string, unknown>);
    grouped.set(String(run.job_id), list);
  }
  return { jobs: jobList.map((job) => ({ ...job,
    runs: (grouped.get(job.id) ?? []).slice(0, 10),
    last_run: (grouped.get(job.id) ?? [])[0] ?? null,
  })) };
}
