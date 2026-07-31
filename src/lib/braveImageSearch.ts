const BRAVE_IMAGE_API = "https://api.search.brave.com/res/v1/images/search";

export type BraveImageResult = {
  url: string;
  title: string;
  thumbnail?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Brave Image Search — returns up to `count` image URLs (empty on error / missing key). */
export async function searchBraveImages(query: string, count = 3): Promise<BraveImageResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!key || !query.trim()) return [];

  const params = new URLSearchParams({
    q: query.trim().slice(0, 120),
    count: String(Math.min(Math.max(count, 1), 10)),
    safesearch: "moderate",
  });

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${BRAVE_IMAGE_API}?${params}`, {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": key,
        },
        signal: AbortSignal.timeout(8000),
      });
      if ((res.status === 429 || res.status === 503) && attempt === 0) {
        await sleep(800 + Math.floor(Math.random() * 900));
        continue;
      }
      if (!res.ok) return [];

      const json = (await res.json()) as {
        results?: Array<{
          title?: string;
          url?: string;
          properties?: { url?: string; width?: number; height?: number };
          thumbnail?: { src?: string };
        }>;
      };

      const mapped: BraveImageResult[] = [];
      for (const r of json.results ?? []) {
        const url = r.properties?.url ?? r.url ?? r.thumbnail?.src ?? "";
        if (!url.startsWith("http")) continue;
        const w = r.properties?.width ?? 0;
        const h = r.properties?.height ?? 0;
        if (w > 0 && h > 0 && (w < 200 || h < 120)) continue;
        mapped.push({
          url,
          title: (r.title ?? "").trim(),
          ...(r.thumbnail?.src ? { thumbnail: r.thumbnail.src } : {}),
        });
      }
      return mapped.slice(0, count);
    } catch {
      return [];
    }
  }
  return [];
}
