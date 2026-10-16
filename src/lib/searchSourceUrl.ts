import type { SanitizedSource } from "@/lib/generatedArticleSourceUrls";

/**
 * Legacy compatibility hook. Missing URLs remain unresolved: a search result for a
 * similar title is not the cited document. Research now retrieves source bodies before
 * writing and stores their actual title + URL together in articleResearch.ts.
 */
export async function enrichSourcesWithRealUrls<T extends SanitizedSource>(sources: T[], _braveApiKey?: string): Promise<T[]> {
  void _braveApiKey;
  return sources;
}
