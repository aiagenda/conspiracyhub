import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Per-visitor limits for the tools that cost money to run.
 *
 * These used to be guarded by requiring an account, which asked every reader to
 * register so that a handful of them would not run up an OpenAI bill. The limit is
 * the thing that was actually wanted, so it is applied directly.
 *
 * The address is never stored — only a truncated hash of it, which is enough to
 * count repeats and not enough to identify anyone.
 */
export function ipHash(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0].trim() || req.headers.get("x-real-ip")?.trim() || "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export type RateLimit = { bucket: string; limit: number; windowMinutes: number };

/**
 * Counts this visitor's recent actions in `bucket`. Call `record` only once the
 * action has actually been performed, so a cached answer or a failed run does not
 * eat someone's quota.
 */
export async function checkRateLimit(
  admin: SupabaseClient,
  req: NextRequest,
  { bucket, limit, windowMinutes }: RateLimit,
): Promise<{ allowed: boolean; record: () => Promise<void> }> {
  const hash = ipHash(req);
  const since = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  const { count, error } = await admin
    .from("rate_limit_events")
    .select("*", { count: "exact", head: true })
    .eq("bucket", bucket)
    .eq("ip_hash", hash)
    .gte("created_at", since);

  // A limiter that cannot read its own table must not become a wall across the
  // whole site, so an outage here lets the request through.
  if (error) {
    console.warn("[rateLimit]", bucket, error.message);
    return { allowed: true, record: async () => {} };
  }

  return {
    allowed: (count ?? 0) < limit,
    record: async () => {
      await admin.from("rate_limit_events").insert({ bucket, ip_hash: hash });
      // Keep the table from growing without bound; cheap because of the lookup index.
      if (Math.random() < 0.02) {
        const cutoff = new Date(Date.now() - 48 * 60 * 60_000).toISOString();
        await admin.from("rate_limit_events").delete().lt("created_at", cutoff);
      }
    },
  };
}
