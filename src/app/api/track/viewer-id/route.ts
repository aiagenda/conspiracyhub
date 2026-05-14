import { NextRequest, NextResponse } from "next/server";
import { pageViewFingerprintFromRequest } from "@/lib/analyticsExclude";

/** Public helper: 16-char viewer id used in page_views (for ANALYTICS_EXCLUDE_FINGERPRINTS). */
export async function GET(req: NextRequest) {
  return NextResponse.json({ fingerprint: pageViewFingerprintFromRequest(req) });
}
