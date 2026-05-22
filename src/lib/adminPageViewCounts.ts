import type { SupabaseClient } from "@supabase/supabase-js";
import { analyticsExcludedFingerprints } from "@/lib/analyticsExclude";

type RpcRow = { path: string; view_count: number | string; unique_viewers?: number | string };

export type PathPageViewStats = { totalLoads: number; uniqueReaders: number };

export type CountryPageViewStats = {
  country_code: string;
  view_count: number;
  unique_viewers: number;
};

/** Per-country hits + distinct fingerprints since `sinceAt` (RPC). */
export async function pageViewsByCountrySince(
  db: SupabaseClient,
  sinceAt: string,
): Promise<CountryPageViewStats[]> {
  const exclude = analyticsExcludedFingerprints();
  const { data, error } = await db.rpc("admin_page_views_by_country", {
    since_at: sinceAt,
    exclude_fingerprints: exclude.length > 0 ? exclude : null,
  });
  if (error) {
    console.warn("[admin_page_views_by_country]", error.message);
    return [];
  }
  return ((data ?? []) as { country_code: string; view_count: number | string; unique_viewers: number | string }[]).map(
    (row) => ({
      country_code: row.country_code,
      view_count: Number(row.view_count),
      unique_viewers: Number(row.unique_viewers),
    }),
  );
}

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
