import type { SupabaseClient } from "@supabase/supabase-js";
import { analyticsExcludedFingerprints } from "@/lib/analyticsExclude";

type RpcRow = { path: string; view_count: number | string; unique_viewers?: number | string };

export type PathPageViewStats = { totalLoads: number; uniqueReaders: number };

/** Per-path hits + distinct fingerprints from page_views (RPC); respects ANALYTICS_EXCLUDE_* fingerprints. */
export async function pageViewStatsByPaths(
  db: SupabaseClient,
  paths: string[],
): Promise<Record<string, PathPageViewStats>> {
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
  const out: Record<string, PathPageViewStats> = {};
  for (const row of (data ?? []) as RpcRow[]) {
    const totalLoads = Number(row.view_count);
    const uniqueReaders = Number(
      row.unique_viewers !== undefined && row.unique_viewers !== null ? row.unique_viewers : row.view_count,
    );
    out[row.path] = { totalLoads, uniqueReaders };
  }
  return out;
}
