import { NextRequest, NextResponse } from "next/server";
import {
  pageViewFingerprintFromRequest,
  pageViewClientIpFromRequest,
} from "@/lib/analyticsExclude";

/** Public helper: fingerprint + client IP for Vercel env (ANALYTICS_EXCLUDE_*). */
export async function GET(req: NextRequest) {
  const fingerprint = pageViewFingerprintFromRequest(req);
  const client_ip = pageViewClientIpFromRequest(req);
  return NextResponse.json({ fingerprint, client_ip });
}
