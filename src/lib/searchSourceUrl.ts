/**
 * Brave Search API integration for enriching article source URLs.
 * When the model returns sources with empty `url`, we search for the real URL
 * on trusted government / news domains.
 */

import { TRUSTED_SOURCE_DOMAINS, SanitizedSource, trustedArticleSourceUrl } from "@/lib/generatedArticleSourceUrls";

const BRAVE_ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

type BraveResult = {
  title: string;
  url: string;
  description?: string;
};

type BraveResponse = {
  web?: {
    results?: BraveResult[];
  };
};

/**
 * Search Brave for a query and return the first URL that lands on a trusted domain.
 * Returns "" if nothing found or API key is missing.
 */
async function braveSearchFirstTrustedUrl(query: string, apiKey: string): Promise<string> {
  try {
    const params = new URLSearchParams({
      q: query,
      count: "5",
      safesearch: "off",
      text_decorations: "false",
    });
    const res = await fetch(`${BRAVE_ENDPOINT}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.warn(`[searchSourceUrl] Brave API ${res.status}: ${await res.text().catch(() => "")}`);
      return "";
    }
    const data = (await res.json()) as BraveResponse;
    const results = data?.web?.results ?? [];
    for (const r of results) {
      const validated = trustedArticleSourceUrl(r.url ?? "");
      if (validated) return validated;
    }
    return "";
  } catch (err) {
    console.warn("[searchSourceUrl] search error:", err instanceof Error ? err.message : err);
    return "";
  }
}

/** Build a focused search query for a source entry. */
function buildQuery(source: SanitizedSource): string {
  const title = source.title.trim().slice(0, 120);
  const desc = source.description.trim().slice(0, 80);
  // Add site: hints toward gov/archive domains to improve precision
  const govHint = TRUSTED_SOURCE_DOMAINS.filter((d) =>
    /cia\.gov|archives\.gov|congress\.gov|govinfo|gao\.gov|darpa|pubmed|aaro|nsarchive/.test(d),
  )
    .slice(0, 4)
    .map((d) => `site:${d}`)
    .join(" OR ");

  return desc ? `${title} ${desc.split(" ").slice(0, 6).join(" ")}` : title;
}

/**
 * For each source with an empty or invalid `url`, attempt a Brave Search to find
 * a real URL on a trusted domain. Sources that already have a trusted URL are left
 * untouched. Returns an updated copy of the sources array.
 */
export async function enrichSourcesWithRealUrls(
  sources: SanitizedSource[],
  braveApiKey?: string,
): Promise<SanitizedSource[]> {
  if (!braveApiKey) return sources;

  const enriched = await Promise.all(
    sources.map(async (source) => {
      // Already has a good URL → skip
      if (source.url && source.url.startsWith("https://")) return source;

      const query = buildQuery(source);
      if (!query) return source;

      const found = await braveSearchFirstTrustedUrl(query, braveApiKey);
      return found ? { ...source, url: found } : source;
    }),
  );

  return enriched;
}
