import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/server/scraperScheduler";
import {
  dailyIngestJobKeyError,
  parseDailyIngestJobKey,
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
    const jobKey = parseDailyIngestJobKey(String(body.job_key ?? ""));
    if (!jobKey) {
      const err = dailyIngestJobKeyError(String(body.job_key ?? ""));
      return NextResponse.json(err.body, { status: err.status });
    }
    const out = await runDailyIngestJobByKey(jobKey);
    return NextResponse.json(out.body, { status: out.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}