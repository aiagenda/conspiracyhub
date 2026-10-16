import { createClient } from "@supabase/supabase-js";
import { findTopic } from "@/lib/topics";
import { plainTextFromHtml } from "@/lib/plainText";
import { mergePublicationResults, SEARCH_PAGE_SIZE, type PublicationFilters, type PublicationResult } from "@/lib/publicationSearch";

export type ArchiveResponse = { results: PublicationResult[]; total: number; page: number; pageSize: number; unavailable?: boolean };
function excerpt(text: unknown): string { return plainTextFromHtml(String(text ?? "")).replace(/[#*_`]/g, "").slice(0, 260); }

/** Each branch contributes N rows: sufficient for the first N of their date-sorted union. */
export async function searchPublication(filters: PublicationFilters): Promise<ArchiveResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return { results: [], total: 0, page: filters.page, pageSize: SEARCH_PAGE_SIZE, unavailable: true };
  const db = createClient(url, key);
  const topic = findTopic(filters.topic);
  const until = filters.page * SEARCH_PAGE_SIZE - 1;
  const cutoff = filters.period === "all" ? null : new Date(Date.now() - (filters.period === "week" ? 7 : 30) * 86400000).toISOString();
  const pattern = `%${filters.q}%`;
  const readNews = async () => {
    if (filters.type === "analysis") return { rows: [] as PublicationResult[], count: 0 };
    let request = db.from("news_items").select("id,title,summary,section,published_at,source", { count: "exact" });
    if (filters.q) request = request.or(`title.ilike.${pattern},summary.ilike.${pattern}`);
    if (topic) request = request.in("section", [...topic.sections]);
    if (cutoff) request = request.gte("published_at", cutoff);
    const { data, count, error } = await request.order("published_at", { ascending: false }).order("id").range(0, until);
    if (error) throw new Error("news_archive_unavailable");
    return { count: count ?? 0, rows: (data ?? []).map((row) => ({ id: row.id, title: row.title, excerpt: excerpt(row.summary), href: `/article/${row.id}`, kind: "news" as const, category: row.section ?? "news", publishedAt: row.published_at, source: row.source ?? "Original reporting" })) };
  };
  const readAnalysis = async () => {
    if (filters.type === "news") return { rows: [] as PublicationResult[], count: 0 };
    let request = db.from("generated_articles").select("id,title,slug,excerpt,meta_description,category,mode,published_at", { count: "exact" }).eq("status", "published");
    if (filters.q) request = request.or(`title.ilike.${pattern},excerpt.ilike.${pattern},focus_keyword.ilike.${pattern}`);
    if (topic) request = request.in("category", [...topic.sections]);
    if (cutoff) request = request.gte("published_at", cutoff);
    const { data, count, error } = await request.order("published_at", { ascending: false }).order("id").range(0, until);
    if (error) throw new Error("analysis_archive_unavailable");
    return { count: count ?? 0, rows: (data ?? []).map((row) => ({ id: row.id, title: row.title, excerpt: excerpt(row.excerpt || row.meta_description), href: `/blog/${row.slug}`, kind: (row.mode === "lore" || row.mode === "lore_dossier") ? "hypothesis" as const : "analysis" as const, category: row.category ?? "analysis", publishedAt: row.published_at, source: "The Theorist" })) };
  };
  const groups = await Promise.all([readNews(), readAnalysis()]);
  return { results: mergePublicationResults(groups.map((group) => group.rows), filters.page), total: groups.reduce((sum, group) => sum + group.count, 0), page: filters.page, pageSize: SEARCH_PAGE_SIZE };
}
