import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { analyticsExcludedFingerprints } from "@/lib/analyticsExclude";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

/** Page views: apply fingerprint exclusion after .select() (Supabase builder typing). */
function withExcludedFingerprints<T extends { not: (c: string, op: string, v: string) => T }>(
  q: T,
  excludedFp: string[],
): T {
  if (excludedFp.length === 0) return q;
  return q.not("fingerprint", "in", `(${excludedFp.join(",")})`);
}

/** Open access for now — re-enable ADMIN_SECRET check before production hardening. */
export async function GET() {
  const db = admin();
  const excludedFp = analyticsExcludedFingerprints();
  const now = Date.now();
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  const since7d  = new Date(now - 7  * 24 * 60 * 60 * 1000).toISOString();
  const since30d = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    views24h, views7d, views30d,
    apiLogs24h,
    unreadMsgs,
    totalArticles,
    topPaths,
    topRoutes,
    hourlyViews,
    recentMessages,
    totalProUsers,
    totalFreeUsers,
    newUsersLast7d,
    totalOracleAnalyses,
    totalThreads,
  ] = await Promise.all([
    // Page views (excluding configured fingerprints)
    withExcludedFingerprints(
      db.from("page_views").select("*", { count: "exact", head: true }),
      excludedFp,
    ).gte("created_at", since24h),
    withExcludedFingerprints(
      db.from("page_views").select("*", { count: "exact", head: true }),
      excludedFp,
    ).gte("created_at", since7d),
    withExcludedFingerprints(
      db.from("page_views").select("*", { count: "exact", head: true }),
      excludedFp,
    ).gte("created_at", since30d),
    // API logs (24h)
    db.from("api_request_logs").select("status_code, duration_ms").gte("created_at", since24h),
    // Unread contact messages
    db.from("contact_messages").select("*", { count: "exact", head: true }).eq("read", false),
    // Total articles
    db.from("news_items").select("*", { count: "exact", head: true }),
    // Top 10 paths (7d)
    withExcludedFingerprints(db.from("page_views").select("path"), excludedFp)
      .gte("created_at", since7d)
      .limit(2000),
    // Top 10 API routes (24h)
    db.from("api_request_logs").select("route, status_code").gte("created_at", since24h).limit(2000),
    // Hourly view counts (last 24h, raw rows)
    withExcludedFingerprints(db.from("page_views").select("created_at"), excludedFp)
      .gte("created_at", since24h)
      .limit(5000),
    // Recent contact messages (last 20)
    db.from("contact_messages")
      .select("id, name, email, category, subject, created_at, read")
      .order("created_at", { ascending: false })
      .limit(20),
    // PRO subscriber count
    db.from("user_profiles").select("*", { count: "exact", head: true }).eq("plan", "pro"),
    // Free user count
    db.from("user_profiles").select("*", { count: "exact", head: true }).eq("plan", "free"),
    // New users last 7 days
    db.from("user_profiles").select("*", { count: "exact", head: true }).gte("created_at", since7d),
    // Oracle analyses generated
    db.from("oracle_analyses").select("*", { count: "exact", head: true }),
    // Community threads
    db.from("threads").select("*", { count: "exact", head: true }).neq("status", "removed"),
  ]);

  // aggregate top paths
  const pathCounts: Record<string, number> = {};
  (topPaths.data ?? []).forEach((r) => {
    pathCounts[r.path] = (pathCounts[r.path] ?? 0) + 1;
  });
  const topPathsSorted = Object.entries(pathCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // aggregate top routes
  const routeCounts: Record<string, { total: number; errors: number }> = {};
  (topRoutes.data ?? []).forEach((r) => {
    if (!routeCounts[r.route]) routeCounts[r.route] = { total: 0, errors: 0 };
    routeCounts[r.route].total += 1;
    if (r.status_code >= 400) routeCounts[r.route].errors += 1;
  });
  const topRoutesSorted = Object.entries(routeCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 10)
    .map(([route, v]) => ({ route, ...v }));

  // API stats
  const logs24 = apiLogs24h.data ?? [];
  const apiCalls24h = logs24.length;
  const apiErrors24h = logs24.filter((r) => r.status_code >= 400).length;
  const apiAvgMs = logs24.length
    ? Math.round(logs24.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / logs24.length)
    : 0;

  // hourly buckets
  const hourBuckets: Record<string, number> = {};
  for (let h = 23; h >= 0; h--) {
    const key = new Date(now - h * 60 * 60 * 1000).toISOString().slice(0, 13);
    hourBuckets[key] = 0;
  }
  (hourlyViews.data ?? []).forEach((r) => {
    const key = r.created_at.slice(0, 13);
    if (key in hourBuckets) hourBuckets[key] = (hourBuckets[key] ?? 0) + 1;
  });
  const viewsHourly = Object.entries(hourBuckets).map(([hour, count]) => ({ hour, count }));

  return NextResponse.json({
    pageViews: {
      last24h: views24h.count ?? 0,
      last7d:  views7d.count ?? 0,
      last30d: views30d.count ?? 0,
    },
    api: {
      calls24h:   apiCalls24h,
      errors24h:  apiErrors24h,
      avgMs:      apiAvgMs,
    },
    content: {
      totalArticles: totalArticles.count ?? 0,
      oracleAnalyses: totalOracleAnalyses.count ?? 0,
      threads: totalThreads.count ?? 0,
    },
    contact: {
      unread: unreadMsgs.count ?? 0,
      recent: recentMessages.data ?? [],
    },
    subscribers: {
      pro: totalProUsers.count ?? 0,
      free: totalFreeUsers.count ?? 0,
      newLast7d: newUsersLast7d.count ?? 0,
      mrr: (totalProUsers.count ?? 0) * 7,
    },
    charts: {
      viewsHourly,
      topPaths: topPathsSorted,
      topRoutes: topRoutesSorted,
    },
  });
}
