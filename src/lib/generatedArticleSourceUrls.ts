/**
 * Trusted apex domains for generated article `sources[].url`.
 * Used at insert time and for admin bulk "sanitize sources".
 */
import { isOracleUrlTooVague } from "@/lib/oracleSourceUrls";

export const TRUSTED_SOURCE_DOMAINS = [
  "cia.gov",
  "archives.gov",
  "federalregister.gov",
  "congress.gov",
  "govinfo.gov",
  "gao.gov",
  "dni.gov",
  "defense.gov",
  "darpa.mil",
  "fda.gov",
  "cdc.gov",
  "pubmed.ncbi.nlm.nih.gov",
  "ncbi.nlm.nih.gov",
  "patents.google.com",
  "aaro.mil",
  "nsarchive.gwu.edu",
  "nytimes.com",
  "theguardian.com",
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "bbc.co.uk",
  "washingtonpost.com",
  "politico.com",
  "wired.com",
  "theintercept.com",
  "propublica.org",
  "documentcloud.org",
  "fas.org",
  "aclu.org",
] as const;

export type SanitizedSource = { title: string; url: string; description: string };

/** Full https URL string if hostname is in TRUSTED_SOURCE_DOMAINS; otherwise "". */
export function trustedArticleSourceUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return "";
  try {
    const { hostname } = new URL(trimmed);
    const trusted = TRUSTED_SOURCE_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`),
    );
    if (!trusted) return "";
    if (isOracleUrlTooVague(trimmed)) return "";
    return trimmed;
  } catch {
    return "";
  }
}

interface RawSource {
  title?: unknown;
  url?: unknown;
  description?: unknown;
}

export function sanitizeSources(raw: unknown): SanitizedSource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: RawSource) => {
      const title = String(s?.title ?? "").trim();
      const description = String(s?.description ?? "").trim();
      const rawUrl = String(s?.url ?? "").trim();
      const validatedUrl = trustedArticleSourceUrl(rawUrl);

      return { title, url: validatedUrl, description };
    })
    .filter((s) => s.title);
}
