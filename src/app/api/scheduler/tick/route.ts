import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkCronAuth,
  executeJob,
  matchesCronNow,
} from "@/lib/server/scraperScheduler";

export const maxDuration = 300;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

async function runTick() {
  const db = admin();
  const { data: jobs, error } = await db
    .from("scraper_jobs")
    .select("id,job_key,name,target,schedule_cron,enabled,config")
    .eq("enabled", true);

  if (error) throw new Error(error.message);
  const now = new Date();
  const due = (jobs ?? []).filter((j) => matchesCronNow(j.schedule_cron, now));

  const results: Array<Record<string, unknown>> = [];
  for (const job of due) {
    const res = await executeJob(job, "cron");
    results.push({
      job_id: job.id,
      job_key: job.job_key,
      name: job.name,
      ...res,
    });
  }
  return {
    tick_at: now.toISOString(),
    due_count: due.length,
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
