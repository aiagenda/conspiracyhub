import type { SupabaseClient } from "@supabase/supabase-js";
import { canonicalSourceUrl, articleCitationUrls } from "@/lib/editorialQuality";

export type EditorialRow = {
  id: string; title: string; slug: string; content: string; status: string;
  sources: Array<{ title?: string; url?: string; description?: string }> | null;
  editorial_checks?: { passed?: boolean; issues?: string[]; [key: string]: unknown } | null;
  verified_at?: string | null; updated_at?: string | null; published_at?: string | null;
  source_published_at?: string | null;
};

/** Human review still has structural requirements; checkboxes cannot publish an empty draft. */
export function manualReviewIssues(article: EditorialRow): string[] {
  const issues: string[] = [];
  if (article.title.trim().length < 10) issues.push("Use a clear, descriptive title.");
  if (article.content.trim().split(/\s+/).length < 100) issues.push("Provide at least 100 words of useful reporting.");
  const sources = (article.sources ?? []).map((source) => canonicalSourceUrl(source.url ?? "")).filter(Boolean);
  const citations = articleCitationUrls(article.content);
  const citedSources = sources.filter((url) => citations.includes(url));
  const domains = new Set(citedSources.map((url) => new URL(url).hostname));
  if (domains.size < 2) issues.push("Cite specific sources from at least two independent domains in the article.");
  if (sources.some((url) => new URL(url).pathname === "/")) issues.push("Use the specific source page, not a publisher homepage.");
  if (article.source_published_at && Date.parse(article.source_published_at) > Date.now() + 86400000) issues.push("The source publication date is in the future.");
  return issues;
}

/** Shared by the general review queue and the tech desk. Never bypass the evidence gate. */
export async function publishReviewedArticle(db: SupabaseClient, article: EditorialRow) {
  const issues = manualReviewIssues(article);
  if (article.editorial_checks?.passed !== true || !article.verified_at) {
    issues.unshift("Complete an evidence review before publishing.");
  }
  if (issues.length) return { status: 422, body: { error: "editorial_review_required", issues } };
  if (!article.updated_at) return { status: 503, body: { error: "Apply the editorial quality migration before publishing." } };
  const { data, error } = await db.from("generated_articles")
    .update({ status: "published", published_at: article.status === "published" ? article.published_at : new Date().toISOString() })
    .eq("id", article.id).eq("updated_at", article.updated_at).select("id").maybeSingle();
  if (error) return { status: 500, body: { error: error.message } };
  if (!data) return { status: 409, body: { error: "This draft changed. Reload and review the current version." } };
  return { status: 200, body: { ok: true } };
}
