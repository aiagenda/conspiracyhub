const BRAVE_API = "https://api.search.brave.com/res/v1/web/search";

export interface BraveResult {
  title: string;
  url: string;
  description: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Run a Brave Web Search query.
 * Returns up to `count` results (default 5).
 * Returns [] silently on any error or missing API key.
 *
 * The Oracle pipeline fires many Brave queries at once (one per node + theory), so on
 * rate-limited tiers a 429/503 is common. We retry once with a jittered backoff to recover
 * those results instead of silently dropping them — which previously left boards with very
 * few "related coverage" sources.
 */
export async function searchBrave(
  query: string,
  count = 5,
  offset = 0,
): Promise<BraveResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!key) return [];

  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(count, 10)),
    search_lang: "en",
    safesearch: "moderate",
    freshness: "py", // past year
  });
  // Page offset (0-9): skip `offset` pages of `count` results to fetch deeper coverage.
  if (offset > 0) params.set("offset", String(Math.min(Math.max(offset, 0), 9)));

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${BRAVE_API}?${params}`, {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": key,
        },
        signal: AbortSignal.timeout(6000),
      });
      // Retry once on rate-limit / transient unavailability, spread out via jitter.
      if ((res.status === 429 || res.status === 503) && attempt === 0) {
        await sleep(700 + Math.floor(Math.random() * 1300));
        continue;
      }
      if (!res.ok) return [];
      const json = (await res.json()) as {
        web?: { results?: { title?: string; url?: string; description?: string }[] };
      };
      return (json.web?.results ?? [])
        .filter((r) => r.url && /^https?:\/\//i.test(r.url))
        .map((r) => ({
          title: r.title ?? r.url!,
          url: r.url!,
          description: r.description ?? "",
        }))
        .slice(0, count);
    } catch {
      return []; // network error / timeout — don't retry (avoid doubling latency)
    }
  }
  return [];
}
