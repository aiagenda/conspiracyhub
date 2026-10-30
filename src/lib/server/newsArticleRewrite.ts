import type { SupabaseClient } from "@supabase/supabase-js";
import { callOpenAIJSON } from "@/lib/openai";
import { getFeedMinScore } from "@/lib/feedMinScore";
import { newsSourceLabel } from "@/lib/newsSourceLabel";
import { fetchNewsSourceContent } from "@/lib/server/fetchNewsSourceBody";
import {
  countH2Sections,
  injectInlineImages,
  normalizeImageSlots,
  resolveImagePlacements,
  type ImageSlot,
} from "@/lib/server/inlineArticleImages";
import { SYSTEM_NEWS_REWRITE } from "@/lib/prompts";
import { reviewArticleEvidence } from "@/lib/server/editorialReview";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-theorist.com";

export type NewsItemRewriteRow = {
  id: string;
  title: string;
  summary?: string | null;
  angle?: string | null;
  score?: number | null;
  section?: string | null;
  url?: string | null;
  source?: string | null;
  guardian_id?: string | null;
  image?: string | null;
  body_html?: string | null;
  rewrite_status?: string | null;
  published_at?: string | null;
};

type RewritePayload = {
  seo_description: string;
  body_markdown: string;
  image_slots?: ImageSlot[];
};

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export async function rewriteNewsArticleBody(
  apiKey: string,
  row: NewsItemRewriteRow,
  rawBody: string,
  sourceImages: Awaited<ReturnType<typeof fetchNewsSourceContent>>["images"],
): Promise<{ body_markdown: string; seo_description: string }> {
  const sourceLabel = newsSourceLabel(row.source, row.url);
  const sourceUrl = row.url ?? "";

  const result = await callOpenAIJSON<RewritePayload>({
    apiKey,
    system: SYSTEM_NEWS_REWRITE,
    user: `Write an attributed, factual news brief or explainer for The Theorist.

Original headline: "${row.title}"
Section: ${row.section ?? "news"}
Editorial question (only if supported): ${row.angle || "What happened and why does it matter?"}
Writing date: ${new Date().toISOString().slice(0, 10)}
Source publication date: ${row.published_at || "unknown; avoid current-news wording"}
Format: ${wordCount(rawBody) < 400 ? "brief, 150–300 words maximum" : "explainer, 350–700 words maximum"}
Source outlet: ${sourceLabel}
Source URL (copy exactly in an inline citation): ${sourceUrl}
Source images available from article: ${sourceImages.length}

--- SOURCE TEXT (paraphrase; do not plagiarize) ---
${rawBody.slice(0, 6500)}
--- END SOURCE ---

Site: ${SITE_URL}`,
    maxTokens: 3200,
    model: "gpt-4o-mini",
  });

  if (!result.body_markdown?.trim()) {
    throw new Error("empty_rewrite");
  }
  if (wordCount(result.body_markdown) < 100) {
    throw new Error("rewrite_too_short");
  }

  let body_markdown = result.body_markdown.trim();
  const h2Count = countH2Sections(body_markdown);
  const slots = normalizeImageSlots(result.image_slots ?? [], h2Count);

  if (slots.length) {
    const placements = await resolveImagePlacements(slots, sourceImages, sourceLabel);
    body_markdown = injectInlineImages(body_markdown, placements);
  }

  return {
    body_markdown,
    seo_description: (result.seo_description ?? row.summary ?? "").trim().slice(0, 160),
  };
}

export async function rewriteNewsItem(
  admin: SupabaseClient,
  apiKey: string,
  row: NewsItemRewriteRow,
): Promise<"ready" | "skipped" | "failed"> {
  const minScore = getFeedMinScore();
  if ((row.score ?? 0) < minScore) {
    await admin
      .from("news_items")
      .update({ rewrite_status: "skipped", body_html: null })
      .eq("id", row.id);
    return "skipped";
  }

  if (row.body_html?.trim() && row.rewrite_status === "ready") {
    return "ready";
  }

  const source = await fetchNewsSourceContent(row);
  const { text: rawBody, images: sourceImages } = source;
  if (source.extraction !== "body" || wordCount(rawBody) < 80) {
    await admin
      .from("news_items")
      .update({ rewrite_status: "skipped", body_html: null })
      .eq("id", row.id);
    return "skipped";
  }

  try {
    const { body_markdown, seo_description } = await rewriteNewsArticleBody(
      apiKey,
      { ...row, url: source.resolvedUrl || row.url, published_at: source.publishedAt ?? row.published_at },
      rawBody,
      sourceImages,
    );
    const checks = await reviewArticleEvidence({
      apiKey,
      article: { title: row.title, content: body_markdown },
      findings: [{ title: source.title || row.title, url: source.resolvedUrl || row.url || "", text: rawBody, publishedAt: source.publishedAt ?? row.published_at }],
      minimumSources: 1,
    });
    if (!checks.passed) {
      console.warn(`[news-rewrite] ${row.id} held for review: ${checks.issues.join("; ")}`);
      await admin.from("news_items").update({ rewrite_status: "skipped", body_html: null }).eq("id", row.id);
      return "skipped";
    }
    const { error: saveError } = await admin
      .from("news_items")
      .update({
        body_html: body_markdown,
        seo_description,
        rewrite_status: "ready",
      })
      .eq("id", row.id);
    if (saveError) throw new Error(saveError.message);
    return "ready";
  } catch (e) {
    const msg = e instanceof Error ? e.message : "rewrite_failed";
    await admin.from("news_items").update({ rewrite_status: "failed" }).eq("id", row.id);
    console.error(`[news-rewrite] ${row.id} failed:`, msg);
    return "failed";
  }
}

/** Rewrite up to `limit` news items (new inserts + pending backlog). */
export async function rewriteNewsItemsBatch(
  admin: SupabaseClient,
  apiKey: string,
  rows: NewsItemRewriteRow[],
  limit = 5,
): Promise<{ ready: number; skipped: number; failed: number }> {
  const stats = { ready: 0, skipped: 0, failed: 0 };
  for (const row of rows.slice(0, limit)) {
    const status = await rewriteNewsItem(admin, apiKey, row);
    stats[status] += 1;
  }
  return stats;
}

/** Load pending high-score items missing a rewrite (for scraper backfill). */
export async function loadPendingRewriteCandidates(
  admin: SupabaseClient,
  limit: number,
): Promise<NewsItemRewriteRow[]> {
  const minScore = getFeedMinScore();
  const select = "id, title, summary, angle, score, section, url, source, guardian_id, image, published_at, body_html, rewrite_status";
  // Newest pending first. This is a news feed: working oldest-first spent every run on
  // stale stories while the current week stayed unwritten and therefore unpublished.
  const retrySlots = Math.min(2, Math.max(1, Math.floor(limit / 4)));
  const { data: pending } = await admin.from("news_items").select(select)
    .gte("score", minScore).eq("rewrite_status", "pending")
    .order("published_at", { ascending: false }).limit(limit - retrySlots);
  const rows = (pending ?? []) as NewsItemRewriteRow[];

  // Reserve capacity for retries. Previously failed rows were only picked up when fewer
  // than `limit` items were pending, so with a backlog they were never retried at all —
  // 28 of them sat untouched for two weeks and then all succeeded on a direct retry.
  const { data: failed } = await admin.from("news_items").select(select)
    .gte("score", minScore).eq("rewrite_status", "failed")
    .order("published_at", { ascending: false }).limit(limit - rows.length);
  rows.push(...((failed ?? []) as NewsItemRewriteRow[]));
  return rows;
}
