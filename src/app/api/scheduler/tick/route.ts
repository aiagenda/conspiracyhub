import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkCronAuth,
  ensureDailyIngestJobs,
  executeJob,
} from "@/lib/server/scraperScheduler";
import { scheduleDueAt } from "@/lib/server/schedulerTiming";
import { expireExpiredProTrials } from "@/lib/server/proTrial";

export const maxDuration = 300;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

async function runTick() {
  const db = admin();
  await ensureDailyIngestJobs();
  let trialExpired = 0;
  try {
    const r = await expireExpiredProTrials(db);
    trialExpired = r.expired;
  } catch (e) {
    console.error("[scheduler] expire trials", e);
  }

  const { data: jobs, error } = await db
    .from("scraper_jobs")
    .select("id,job_key,name,target,schedule_cron,enabled,config,next_run_at,retry_at,lease_expires_at")
    .eq("enabled", true);

  if (error) throw new Error(`Apply 20261015130000_durable_scheduler before running the scheduler: ${error.message}`);
  const now = new Date();
  const candidates = await Promise.all((jobs ?? []).map(async (job) => {
    let latest: string | null = null;
    if (!job.next_run_at && !job.retry_at) {
      // A first tick after migration should not repeat a successfully completed occurrence.
      const { data, error: lastError } = await db.from("scraper_runs").select("started_at")
        .eq("job_id", job.id).eq("status", "success").order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (lastError) throw new Error(lastError.message);
      latest = data?.started_at ?? null;
    }
    return { job, dueAt: scheduleDueAt(job, now, latest) };
  }));
  const due = candidates.filter(({ job, dueAt }) => dueAt <= now &&
    (!job.lease_expires_at || Date.parse(job.lease_expires_at) <= now.getTime()))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  // At most two concurrent workers share the tick’s 300-second request budget.
  // Remaining overdue jobs stay durable and are picked up on a later tick.
  const results = await Promise.all(due.slice(0, 2).map(async ({ job, dueAt }) => ({
    job_id: job.id, job_key: job.job_key, name: job.name,
    ...await executeJob(job, "cron", dueAt),
  })));

  return {
    tick_at: now.toISOString(),
    due_count: due.length,
    deferred_count: Math.max(0, due.length - 2),
    pro_trials_expired: trialExpired,
    results,
  };
}

export async function GET(req: NextRequest) {
  if (!checkCronAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await runTick());
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
