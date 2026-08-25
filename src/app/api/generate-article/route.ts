import { NextRequest, NextResponse } from "next/server";
import { runGenerateArticleCore } from "@/lib/server/generateArticleCore";

// 2500-3500 word articles plus the pre-writing web research push generation well past the
// old 120s budget. 300s is the Vercel Pro ceiling (same as the scraper route).
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const secret = authHeader?.replace(/^Bearer\s+/i, "") ?? "";
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV === "production") {
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
