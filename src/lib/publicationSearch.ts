export type PublicationResult = {
  id: string; title: string; excerpt: string; href: string;
  kind: "news" | "analysis" | "hypothesis";
  category: string; publishedAt: string; source: string;
};
export type PublicationFilters = {
  q: string; type: "all" | "news" | "analysis"; period: "all" | "week" | "month";
  topic: string; page: number;
};
export const SEARCH_PAGE_SIZE = 18;
/** Keep user text out of PostgREST's filter grammar and LIKE wildcards. */
export function normalizeSearchQuery(value: string): string {
  return value.replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}
export function parsePublicationFilters(params: URLSearchParams): PublicationFilters {
  const page = Number(params.get("page"));
  const type = params.get("type");
  const period = params.get("period");
  return {
    q: normalizeSearchQuery(params.get("q") ?? ""),
    type: type === "news" || type === "analysis" ? type : "all",
    period: period === "week" || period === "month" ? period : "all",
    topic: (params.get("topic") ?? "").replace(/[^a-z-]/g, "").slice(0, 50),
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 50) : 1,
  };
}
export function publicationSearchParams(filters: PublicationFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.type !== "all") params.set("type", filters.type);
  if (filters.period !== "all") params.set("period", filters.period);
  if (filters.topic) params.set("topic", filters.topic);
  if (filters.page > 1) params.set("page", String(filters.page));
  return params;
}
export function mergePublicationResults(groups: PublicationResult[][], page: number): PublicationResult[] {
  return groups.flat().sort((a, b) => {
    const aDate = Date.parse(a.publishedAt) || 0;
    const bDate = Date.parse(b.publishedAt) || 0;
    return bDate - aDate || a.id.localeCompare(b.id) || a.href.localeCompare(b.href);
  }).slice((page - 1) * SEARCH_PAGE_SIZE, page * SEARCH_PAGE_SIZE);
}
