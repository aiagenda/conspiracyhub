/**
 * Reddit OAuth2 application-only client for server-side read access.
 * Register a "script" app at https://www.reddit.com/prefs/apps
 * Env: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET
 */

const UA = "TheTheorist/1.0 (reddit-radar; +https://www.the-theorist.com)";

type TokenCache = { accessToken: string; expiresAtMs: number } | null;
let tokenCache: TokenCache = null;

export function redditOAuthConfigured(): boolean {
  return Boolean(process.env.REDDIT_CLIENT_ID?.trim() && process.env.REDDIT_CLIENT_SECRET?.trim());
}

/** Obtain (cached) application-only bearer token. */
export async function getRedditOAuthToken(): Promise<{ token: string | null; error?: string }> {
  const clientId = process.env.REDDIT_CLIENT_ID?.trim();
  const clientSecret = process.env.REDDIT_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return { token: null, error: "REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET not set" };
  }

  if (tokenCache && tokenCache.expiresAtMs > Date.now() + 120_000) {
    return { token: tokenCache.accessToken };
  }

  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const res = await fetch("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        token: null,
        error: `OAuth token HTTP ${res.status}${body ? `: ${body.slice(0, 80)}` : ""}`,
      };
    }

    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    const accessToken = data.access_token?.trim();
    if (!accessToken) return { token: null, error: "OAuth response missing access_token" };

    const expiresIn = typeof data.expires_in === "number" ? data.expires_in : 3600;
    tokenCache = { accessToken, expiresAtMs: Date.now() + expiresIn * 1000 };
    return { token: accessToken };
  } catch (e) {
    return { token: null, error: e instanceof Error ? e.message : "OAuth token fetch failed" };
  }
}

/** GET from oauth.reddit.com (path must start with /). */
export async function redditOAuthGet(path: string, accessToken: string): Promise<Response> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return fetch(`https://oauth.reddit.com${normalized}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": UA,
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
}

/** Public JSON fallback (often 401/403 from datacenter IPs). */
export async function redditPublicGet(url: string): Promise<Response> {
  const headers = { "User-Agent": UA, Accept: "application/json" };
  let res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (res.ok || (res.status !== 401 && res.status !== 403)) return res;

  const oldUrl = url.replace(/\/\/(www\.)?reddit\.com/i, "//old.reddit.com");
  if (oldUrl !== url) {
    res = await fetch(oldUrl, { headers, cache: "no-store", signal: AbortSignal.timeout(12000) });
  }
  return res;
}

export { UA as REDDIT_API_UA };
