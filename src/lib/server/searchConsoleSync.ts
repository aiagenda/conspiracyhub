import { createClient } from "@supabase/supabase-js";

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

export type SearchConsoleOpportunity = {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  opportunity_score: number;
};

async function getAccessToken(): Promise<string> {
  const email = process.env.GSC_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GSC_PRIVATE_KEY;
  if (!email || !rawKey) throw new Error("GSC credentials not configured");

  const privateKey = rawKey.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: email,
    scope: SCOPES.join(" "),
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };

  const encode = (obj: object) => Buffer.from(JSON.stringify(obj)).toString("base64url");
  const unsigned = `${encode(header)}.${encode(payload)}`;

  const keyData = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(keyData), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(unsigned),
  );

  const jwt = `${unsigned}.${Buffer.from(signature).toString("base64url")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

function pageFilterForSite(siteUrl: string): string {
  if (siteUrl.startsWith("sc-domain:")) {
    return `https://${siteUrl.slice("sc-domain:".length)}/`;
  }
  return siteUrl.endsWith("/") ? siteUrl : `${siteUrl}/`;
}

async function listAccessibleSites(accessToken: string): Promise<string[]> {
  const res = await fetch("https://www.googleapis.com/webmasters/v3/sites", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { siteEntry?: Array<{ siteUrl?: string }> };
  return (data.siteEntry ?? []).map((e) => e.siteUrl ?? "").filter(Boolean);
}

async function gscApiError(res: Response, siteUrl: string, accessToken: string): Promise<never> {
  let detail = "";
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    detail = body.error?.message ?? "";
  } catch {
    detail = await res.text().catch(() => "");
  }

  if (res.status === 403) {
    const sites = await listAccessibleSites(accessToken);
    const sitesHint =
      sites.length > 0
        ? ` Service account sees: ${sites.join(", ")}.`
        : " Service account sees no properties — add it in Search Console → Settings → Users (or fix GSC_SITE_URL).";
    throw new Error(
      `GSC API 403 for "${siteUrl}".${sitesHint} Use sc-domain:the-theorist.com for domain properties. ${detail}`.trim(),
    );
  }

  throw new Error(`GSC API error ${res.status} for "${siteUrl}"${detail ? `: ${detail}` : ""}`);
}

async function fetchSearchConsoleRows(accessToken: string, siteUrl: string, days = 28) {
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split("T")[0];

  const res = await fetch(
    `https://searchconsole.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ["query"],
        rowLimit: 100,
        dimensionFilterGroups: [
          {
            filters: [
              {
                dimension: "page",
                expression: pageFilterForSite(siteUrl),
                operator: "contains",
              },
            ],
          },
        ],
      }),
    },
  );

  if (!res.ok) await gscApiError(res, siteUrl, accessToken);
  return res.json() as Promise<{ rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }> }>;
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

/** Fetch GSC queries, rank opportunities, cache in Supabase. */
export async function runSearchConsoleSync(days = 28): Promise<{
  opportunities: SearchConsoleOpportunity[];
  raw_count: number;
}> {
  const siteUrl = process.env.GSC_SITE_URL ?? "https://the-theorist.com";
  const token = await getAccessToken();
  const data = await fetchSearchConsoleRows(token, siteUrl, days);
  const rows = data.rows ?? [];

  const opportunities = rows
    .filter((r) => r.impressions >= 10)
    .map((r) => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: Math.round(r.ctr * 1000) / 10,
      position: Math.round(r.position * 10) / 10,
      opportunity_score: Math.round((r.impressions * (1 - r.ctr)) / Math.max(r.position, 1)),
    }))
    .sort((a, b) => b.opportunity_score - a.opportunity_score)
    .slice(0, 20);

  const admin = getAdmin();
  const { error } = await admin.from("search_console_cache").upsert({
    id: "latest",
    data: { opportunities, raw_count: rows.length, fetched_at: new Date().toISOString() },
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);

  return { opportunities, raw_count: rows.length };
}
