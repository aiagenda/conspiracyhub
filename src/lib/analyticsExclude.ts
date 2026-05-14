import { createHash } from "crypto";
import type { NextRequest } from "next/server";

const FP_LEN = 16;

/** Same fingerprint as legacy /api/track (first x-forwarded-for hop, else "unknown"). */
export function pageViewFingerprintFromRequest(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0].trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, FP_LEN);
}

/** Hash for IPs listed in ANALYTICS_EXCLUDE_IPS (trimmed; must match edge IP string). */
export function viewerFingerprintFromConfiguredIp(ip: string): string {
  const s = ip.trim() || "unknown";
  return createHash("sha256").update(s).digest("hex").slice(0, FP_LEN);
}

function splitEnvList(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Fingerprints excluded from inserts and admin aggregates.
 * - ANALYTICS_EXCLUDE_IPS — comma-separated IPs as seen by the edge (often same as whatismyip).
 * - ANALYTICS_EXCLUDE_FINGERPRINTS — 16-char hex each (copy from admin “viewer id”).
 */
/** localStorage key: value `"1"` skips client /api/track calls on this browser. */
export const ANALYTICS_SUPPRESS_LOCAL_STORAGE_KEY = "theorist_analytics_suppress";

export function analyticsExcludedFingerprints(): string[] {
  const ips = splitEnvList(process.env.ANALYTICS_EXCLUDE_IPS);
  const explicit = splitEnvList(process.env.ANALYTICS_EXCLUDE_FINGERPRINTS).map((s) => s.toLowerCase());
  const fromIps = ips.map((ip) => viewerFingerprintFromConfiguredIp(ip));
  return [...new Set([...fromIps, ...explicit])];
}
