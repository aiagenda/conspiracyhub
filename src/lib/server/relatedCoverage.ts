import { buildBraveQuery } from "@/lib/braveNodeQuery";
import { searchBrave, type BraveResult } from "@/lib/braveSearch";

/**
 * Broad "related coverage" search for the center ARTICLE node of an Oracle board.
 *
 * The article node represents the whole topic, so instead of a single narrow query we pull
 * two pages of Brave results (≈20) with a wide multi-source / forum query, dedupe by URL,
 * and drop near-duplicate links to the primary article's own domain so the panel shows
 * coverage from OTHER outlets and forums — not just the originating publisher.
 */
export async function fetchArticleRelatedCoverage(
  title: string,
  topic: string,
  opts: { excludeUrl?: string; limit?: number } = {},
): Promise<BraveResult[]> {
  const query = buildBraveQuery("article", title, topic);
  const limit = opts.limit ?? 16;

  const [page1, page2] = await Promise.all([
    searchBrave(query, 10, 0),
    searchBrave(query, 10, 1),
  ]);

  let primaryHost = "";
  try {
    primaryHost = opts.excludeUrl ? new URL(opts.excludeUrl).hostname.replace(/^www\./, "") : "";
  } catch {
    /* ignore */
  }

  const seen = new Set<string>();
  if (opts.excludeUrl) seen.add(opts.excludeUrl);

  const merged: BraveResult[] = [];
  for (const r of [...page1, ...page2]) {
    if (!r.url || seen.has(r.url)) continue;
    seen.add(r.url);
    // Keep the primary publisher out so "related coverage" really means OTHER sources.
    if (primaryHost) {
      try {
        if (new URL(r.url).hostname.replace(/^www\./, "") === primaryHost) continue;
      } catch {
        /* ignore */
      }
    }
    merged.push(r);
    if (merged.length >= limit) break;
  }
  return merged;
}
