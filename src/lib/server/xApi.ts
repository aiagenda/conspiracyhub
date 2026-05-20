/** X (Twitter) API v2 — app-only auth for Insider Radar timelines. */

export type XPost = { title: string; url: string; published: string };

export type XHandleResult = {
  handle: string;
  posts: XPost[];
  error?: string;
};

type TokenCache = { token: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

const USER_ID_CACHE = new Map<string, { id: string; expiresAt: number }>();
const USER_ID_TTL_MS = 24 * 60 * 60 * 1000;

function basicAuthHeader(clientId: string, clientSecret: string): string {
  const raw = `${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

async function fetchAppBearerToken(): Promise<string | null> {
  const staticBearer = process.env.X_BEARER_TOKEN?.trim();
  if (staticBearer) return staticBearer;

  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.token;
  }

  const clientId = process.env.X_CLIENT_ID?.trim();
  const clientSecret = process.env.X_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const endpoints = [
    "https://api.x.com/2/oauth2/token",
    "https://api.twitter.com/oauth2/token",
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: basicAuthHeader(clientId, clientSecret),
        },
        body: "grant_type=client_credentials",
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) continue;
      const data = (await res.json()) as { access_token?: string; expires_in?: number };
      if (!data.access_token) continue;
      const ttlSec = typeof data.expires_in === "number" ? data.expires_in : 7200;
      tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + ttlSec * 1000,
      };
      return data.access_token;
    } catch {
      continue;
    }
  }
  return null;
}

export function isXApiConfigured(): boolean {
  return !!(process.env.X_BEARER_TOKEN?.trim() || (process.env.X_CLIENT_ID?.trim() && process.env.X_CLIENT_SECRET?.trim()));
}

async function xGet<T>(path: string, bearer: string): Promise<{ data: T | null; error?: string }> {
  const bases = ["https://api.x.com", "https://api.twitter.com"];
  let lastErr = "X API request failed";

  for (const base of bases) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { Authorization: `Bearer ${bearer}`, "User-Agent": "TheTheorist/1.0" },
        signal: AbortSignal.timeout(12_000),
        cache: "no-store",
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        lastErr = `HTTP ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`;
        continue;
      }
      return { data: (await res.json()) as T };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return { data: null, error: lastErr };
}

async function resolveUserId(handle: string, bearer: string): Promise<{ id: string | null; error?: string }> {
  const key = handle.toLowerCase().replace(/^@/, "");
  const cached = USER_ID_CACHE.get(key);
  if (cached && cached.expiresAt > Date.now()) return { id: cached.id };

  const { data, error } = await xGet<{ data?: { id: string } }>(
    `/2/users/by/username/${encodeURIComponent(key)}?user.fields=username`,
    bearer,
  );
  const id = data?.data?.id;
  if (!id) return { id: null, error: error ?? `User @${key} not found` };
  USER_ID_CACHE.set(key, { id, expiresAt: Date.now() + USER_ID_TTL_MS });
  return { id };
}

/** Latest original tweets from a public X account (no retweets). */
export async function fetchXPostsByHandle(handle: string, limit = 3): Promise<XHandleResult> {
  const bearer = await fetchAppBearerToken();
  if (!bearer) {
    return { handle, posts: [], error: "X_BEARER_TOKEN or X_CLIENT_ID+SECRET not set" };
  }

  const { id: userId, error: userErr } = await resolveUserId(handle, bearer);
  if (!userId) return { handle, posts: [], error: userErr };

  const params = new URLSearchParams({
    max_results: "5",
    "tweet.fields": "created_at",
    exclude: "retweets,replies",
  });

  const { data, error } = await xGet<{
    data?: Array<{ id: string; text: string; created_at?: string }>;
  }>(`/2/users/${userId}/tweets?${params}`, bearer);

  if (error) return { handle, posts: [], error };
  if (!data?.data?.length) return { handle, posts: [], error: "No tweets returned (empty timeline or quota)" };

  const posts = data.data.slice(0, limit).map((tweet) => ({
    title: tweet.text.replace(/\s+/g, " ").trim(),
    url: `https://x.com/${handle.replace(/^@/, "")}/status/${tweet.id}`,
    published: tweet.created_at ?? new Date().toISOString(),
  }));

  return { handle, posts };
}

/** Fetch all Insider twitter handles in one call (for diagnostics). */
export async function fetchXPostsForHandles(handles: string[]): Promise<{
  results: XHandleResult[];
  configured: boolean;
}> {
  const configured = isXApiConfigured();
  if (!configured) {
    return {
      configured: false,
      results: handles.map((h) => ({ handle: h, posts: [], error: "X API not configured" })),
    };
  }
  const results = await Promise.all(handles.map((h) => fetchXPostsByHandle(h, 3)));
  return { configured: true, results };
}
