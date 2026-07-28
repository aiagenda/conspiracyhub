import { NextRequest, NextResponse } from "next/server";
import {
  createAndRunBragJob,
  listBragJobs,
  rerenderBragJob,
  type CreateBragJobParams,
} from "@/lib/server/bragPipeline";
import { BRAG_TONE_PRESETS, type BragFormat } from "@/lib/server/bragProjectContext";

export const maxDuration = 300;

export async function GET() {
  try {
    const jobs = await listBragJobs(25);
    return NextResponse.json({ jobs, tones: BRAG_TONE_PRESETS });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateBragJobParams & { action?: string; jobId?: string };

    if (body.action === "rerender") {
      const jobId = String(body.jobId ?? "").trim();
      if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
      const job = await rerenderBragJob(jobId);
      return NextResponse.json({ ok: true, job });
    }

    const tone = BRAG_TONE_PRESETS.includes(body.tone as (typeof BRAG_TONE_PRESETS)[number])
      ? body.tone
      : "default";
    const format = (["landscape", "vertical", "square"] as BragFormat[]).includes(body.format as BragFormat)
      ? body.format
      : "landscape";

    const job = await createAndRunBragJob({
      tone,
      format,
      title: body.title,
      creativeDirection: body.creativeDirection,
    });

    return NextResponse.json({ ok: true, job });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
