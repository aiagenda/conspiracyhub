import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/server/scraperScheduler";
import {
  DAILY_INGEST_JOB_KEYS,
  isDailyIngestJobKey,
  runDailyIngestJobByKey,
} from "@/lib/server/runDailyIngestJob";

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

    const { name, result } = await runDailyIngestJobByKey(jobKey);
    return NextResponse.json({
      ok: true,
      job_key: jobKey,
      name,
      result,
    });
  } catch (e) {
    const allowed = (e as Error & { allowed?: string[] }).allowed;
    if (allowed) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : String(e), allowed },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
