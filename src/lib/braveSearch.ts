const BRAVE_API = "https://api.search.brave.com/res/v1/web/search";

export interface BraveResult {
  title: string;
  url: string;
  description: string;
}

/**
 * Run a Brave Web Search query.
 * Returns up to `count` results (default 5).
 * Returns [] silently on any error or missing API key.
 */
export async function searchBrave(
  query: string,
  count = 5,
): Promise<BraveResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!key) return [];

  try {
    const params = new URLSearchParams({
      q: query,
      count: String(Math.min(count, 10)),
      search_lang: "en",
      safesearch: "moderate",
      freshness: "py", // past year
    });
    const res = await fetch(`${BRAVE_API}?${params}`, {
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": key,
      },
      // Hard timeout via AbortSignal
      signal: AbortSignal.timeout(6000),
    });
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
    return [];
  }
}
