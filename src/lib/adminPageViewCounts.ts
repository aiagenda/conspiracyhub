import type { SupabaseClient } from "@supabase/supabase-js";
import { analyticsExcludedFingerprints } from "@/lib/analyticsExclude";

type RpcRow = { path: string; view_count: number | string };

/** Per-path totals from page_views (RPC); respects ANALYTICS_EXCLUDE_* fingerprints. */
export async function pageViewCountsByPaths(
  db: SupabaseClient,
  paths: string[],
): Promise<Record<string, number>> {
  if (paths.length === 0) return {};
  const exclude = analyticsExcludedFingerprints();
  const { data, error } = await db.rpc("admin_page_view_counts", {
    request_paths: paths,
    exclude_fingerprints: exclude.length > 0 ? exclude : null,
  });
  if (error) {
    console.warn("[admin_page_view_counts]", error.message);
    return {};
  }
  const out: Record<string, number> = {};
  for (const row of (data ?? []) as RpcRow[]) {
    out[row.path] = Number(row.view_count);
  }
  return out;
}
