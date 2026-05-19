import { NextRequest, NextResponse } from "next/server";
import { buildOutbreakPreviewPayload, runOutbreakRefresh } from "@/lib/server/runOutbreakRefresh";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const preview = new URL(req.url).searchParams.get("preview") === "1";
  if (preview) {
    return NextResponse.json(buildOutbreakPreviewPayload());
  }

  const force = new URL(req.url).searchParams.get("refresh") === "1";

  try {
    const { ok, status, payload } = await runOutbreakRefresh({ skipCache: force });
    if (!ok) {
      return NextResponse.json(payload, { status });
    }
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
