/** PostHog Query API (EU) — requires POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID. */

export type PostHogAdminStats = {
  configured: boolean;
  setupHint?: string;
  error?: string;
  pageViews24h: number;
  pageViews7d: number;
  unique24h: number;
  unique7d: number;
  topPages: { path: string; count: number }[];
  topEvents: { event: string; count: number }[];
  topReferrers: { referrer: string; count: number }[];
  dashboardUrl: string;
};

type HogQLResponse = {
  results?: unknown[][];
  columns?: string[];
  error?: string;
};

function posthogApiBase(): string {
  const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com").trim();
  if (host.includes("eu")) return "https://eu.posthog.com";
  if (host.includes("us")) return "https://us.posthog.com";
  return "https://app.posthog.com";
}

function projectId(): string | null {
  const id = process.env.POSTHOG_PROJECT_ID?.trim();
  return id || null;
}

function personalApiKey(): string | null {
  const key = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
  return key || null;
}

async function hogqlQuery(sql: string): Promise<HogQLResponse> {
  const pid = projectId();
  const key = personalApiKey();
  if (!pid || !key) {
    return { error: "posthog_not_configured" };
  }

  const res = await fetch(`${posthogApiBase()}/api/projects/${pid}/query/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query: { kind: "HogQLQuery", query: sql },
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `posthog_http_${res.status}: ${text.slice(0, 200)}` };
  }

  return (await res.json()) as HogQLResponse;
}

function scalarCount(data: HogQLResponse): number {
  const cell = data.results?.[0]?.[0];
  const n = Number(cell);
  return Number.isFinite(n) ? n : 0;
}

function rowsPathCount(data: HogQLResponse): { path: string; count: number }[] {
  if (!data.results?.length) return [];
  return data.results
    .map((row) => ({
      path: String(row[0] ?? "").trim() || "/",
      count: Number(row[1] ?? 0),
    }))
    .filter((r) => r.count > 0);
}

function rowsEventCount(data: HogQLResponse): { event: string; count: number }[] {
  if (!data.results?.length) return [];
  return data.results
    .map((row) => ({
      event: String(row[0] ?? "").trim(),
      count: Number(row[1] ?? 0),
    }))
    .filter((r) => r.event && r.count > 0);
}

function rowsReferrerCount(data: HogQLResponse): { referrer: string; count: number }[] {
  if (!data.results?.length) return [];
  return data.results
    .map((row) => ({
      referrer: String(row[0] ?? "").trim() || "(direct)",
      count: Number(row[1] ?? 0),
    }))
    .filter((r) => r.count > 0);
}

export async function fetchPostHogAdminStats(): Promise<PostHogAdminStats> {
  const pid = projectId();
  const dashboardUrl = pid
    ? `${posthogApiBase()}/project/${pid}`
    : "https://eu.posthog.com";

  if (!personalApiKey() || !pid) {
    return {
      configured: false,
      setupHint:
        "Add POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID to Vercel env (Settings → Personal API Keys in PostHog).",
      pageViews24h: 0,
      pageViews7d: 0,
      unique24h: 0,
      unique7d: 0,
      topPages: [],
      topEvents: [],
      topReferrers: [],
      dashboardUrl,
    };
  }

  try {
    const [pv24, pv7, u24, u7, pages, events, referrers] = await Promise.all([
      hogqlQuery(
        `SELECT count() FROM events WHERE event = '$pageview' AND timestamp > now() - INTERVAL 24 HOUR`,
      ),
      hogqlQuery(
        `SELECT count() FROM events WHERE event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY`,
      ),
      hogqlQuery(
        `SELECT count(DISTINCT person_id) FROM events WHERE event = '$pageview' AND timestamp > now() - INTERVAL 24 HOUR`,
      ),
      hogqlQuery(
        `SELECT count(DISTINCT person_id) FROM events WHERE event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY`,
      ),
      hogqlQuery(`
        SELECT properties.$pathname AS path, count() AS c
        FROM events
        WHERE event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY
        GROUP BY path
        ORDER BY c DESC
        LIMIT 12
      `),
      hogqlQuery(`
        SELECT event, count() AS c
        FROM events
        WHERE timestamp > now() - INTERVAL 7 DAY
          AND event NOT IN ('$pageview', '$pageleave', '$autocapture', '$identify', '$set')
        GROUP BY event
        ORDER BY c DESC
        LIMIT 12
      `),
      hogqlQuery(`
        SELECT coalesce(nullIf(properties.$referring_domain, ''), '(direct)') AS ref, count() AS c
        FROM events
        WHERE event = '$pageview' AND timestamp > now() - INTERVAL 7 DAY
        GROUP BY ref
        ORDER BY c DESC
        LIMIT 12
      `),
    ]);

    const firstErr =
      [pv24, pv7, u24, u7, pages, events, referrers].find((r) => r.error)?.error ?? null;

    return {
      configured: true,
      error: firstErr ?? undefined,
      pageViews24h: scalarCount(pv24),
      pageViews7d: scalarCount(pv7),
      unique24h: scalarCount(u24),
      unique7d: scalarCount(u7),
      topPages: rowsPathCount(pages),
      topEvents: rowsEventCount(events),
      topReferrers: rowsReferrerCount(referrers),
      dashboardUrl,
    };
  } catch (e) {
    return {
      configured: true,
      error: e instanceof Error ? e.message : "posthog_fetch_failed",
      pageViews24h: 0,
      pageViews7d: 0,
      unique24h: 0,
      unique7d: 0,
      topPages: [],
      topEvents: [],
      topReferrers: [],
      dashboardUrl,
    };
  }
}
