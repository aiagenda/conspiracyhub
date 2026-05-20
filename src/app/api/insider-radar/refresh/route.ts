import { NextRequest, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/server/scraperScheduler";
import { runInsiderRadarRefresh } from "@/lib/server/insiderRadarIngest";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!checkCronAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runInsiderRadarRefresh();
  return NextResponse.json(
    result.ok ? { ok: true, ...result.payload } : result.payload,
    { status: result.status },
  );
}

export async function POST(req: NextRequest) {
  return GET(req);
}
