/**
 * Trusted apex domains for generated article `sources[].url`.
 * Used at insert time and for admin bulk "sanitize sources".
 */
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

      let validatedUrl = "";
      if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) {
        try {
          const { hostname } = new URL(rawUrl);
          const trusted = TRUSTED_SOURCE_DOMAINS.some(
            (d) => hostname === d || hostname.endsWith(`.${d}`),
          );
          if (trusted) validatedUrl = rawUrl;
        } catch {
          /* malformed URL */
        }
      }

      return { title, url: validatedUrl, description };
    })
    .filter((s) => s.title);
}
