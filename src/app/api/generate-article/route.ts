import { checkCronAuth } from "@/lib/server/cronAuth";
import { NextRequest, NextResponse } from "next/server";
import { runGenerateArticleCore } from "@/lib/server/generateArticleCore";

// Source retrieval, writing and independent evidence review share this budget.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  if (!checkCronAuth(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const mode = String(body.mode ?? "news_jacking");
  const { status, payload } = await runGenerateArticleCore(mode);
  return NextResponse.json(payload, { status });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
