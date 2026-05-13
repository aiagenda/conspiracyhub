/** Fingerprint for automated article-discussion prompts (idempotent seed / backfill). */
export const ARTICLE_THREAD_STARTER_FP = "theorist-article-starters-v1";

export type ArticleStarterPostRow = {
  author_name: string;
  author_fingerprint: string;
  author_type: "system";
  content: string;
};

/** One transparent system post per article thread (avoids duplicate seed races). */
export function buildArticleThreadStarterRow(articleTitle: string): ArticleStarterPostRow {
  const t = articleTitle.trim() || "this article";
  const headline = t.length > 180 ? `${t.slice(0, 179)}…` : t;

  return {
    author_name: "THEORIST (starter)",
    author_fingerprint: ARTICLE_THREAD_STARTER_FP,
    author_type: "system",
    content: [
      "[Automated opening prompt — not a real member]",
      "",
      `Context: «${headline}»`,
      "",
      "▸ Which specific claims here deserve primary-source verification?",
      "▸ What would mainstream vs. skeptical investigators each want to see clarified?",
      "",
      "—",
      "",
      "▸ Paste links to documents, timelines, or datasets that stress-test the narrative.",
      "▸ Type @oracle if you want an AI pass over the thread (rate limits may apply).",
    ].join("\n"),
  };
}
