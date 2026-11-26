import { NextRequest, NextResponse } from "next/server";
import {
  checkCronAuth,
  runDailyIngestJobByKey,
} from "@/lib/server/scraperScheduler";
import {
  DAILY_INGEST_JOB_KEYS,
  isDailyIngestJobKey,
} from "@/lib/server/dailyIngestJobs";

export const maxDuration = 300;

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

    const payload = await runDailyIngestJobByKey(jobKey);
    return NextResponse.json({ ok: true, ...payload });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message.includes("job not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
