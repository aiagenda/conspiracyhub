import { NextRequest, NextResponse } from "next/server";
import { runSearchConsoleSync } from "@/lib/server/searchConsoleSync";

/**
 * Google Search Console sync (cron or manual).
 *
 * Env: GSC_SERVICE_ACCOUNT_EMAIL, GSC_PRIVATE_KEY, GSC_SITE_URL
 * Auth: Bearer CRON_SECRET (production)
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (auth !== process.env.CRON_SECRET && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { opportunities, raw_count } = await runSearchConsoleSync();
    return NextResponse.json({ opportunities, raw_count });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
