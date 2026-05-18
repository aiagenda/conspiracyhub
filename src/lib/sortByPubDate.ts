/** Parse RSS / ISO pub dates; invalid → 0 so they sort to the end when descending. */
export function pubDateMs(raw: string | undefined | null): number {
  if (!raw?.trim()) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/** Newest first. Items with missing/invalid dates go last. */
export function sortByPubDateDesc<T extends { pubDate?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => pubDateMs(b.pubDate) - pubDateMs(a.pubDate));
}

/** Same for `published_at` field (outbreak rows). */
export function sortByPublishedAtDesc<T extends { published_at?: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => pubDateMs(b.published_at) - pubDateMs(a.published_at));
}
