import { callOpenAIJSON } from "@/lib/openai";

/** Minimum words before we trigger an automatic expansion pass. */
export const ARTICLE_MIN_WORDS = 1800;

/** Target band communicated to the model on expand passes. */
export const ARTICLE_TARGET_WORDS = "2500-3500";

export function countArticleWords(content: string): number {
  return content.split(/\s+/).filter(Boolean).length;
}

/** ## sections thinner than `minWords` (excluding FAQ / related blocks). */
export function thinSectionHeadings(content: string, minWords = 120): string[] {
  return content
    .split(/^##\s+/m)
    .slice(1)
    .map((part) => {
      const lines = part.split("\n");
      const name = lines[0]?.trim() ?? "";
      const body = lines.slice(1).join("\n").trim();
      return { name, words: countArticleWords(body) };
    })
    .filter(
      (s) =>
        s.name &&
        s.words < minWords &&
        !/^FAQ/i.test(s.name) &&
        !/^Related investigations/i.test(s.name),
    )
    .map((s) => `${s.name} (${s.words} words)`);
}

const EXPAND_SYSTEM = `You expand investigative articles to long-form flagship depth for The Theorist.

Return ONLY valid JSON with the same top-level keys as the draft you receive:
title, slug, meta_description, focus_keyword, secondary_keywords, content, excerpt, category, tags, faqs, sources
(and "tier" on sources when present).

Rules:
- Expand "content" to ${ARTICLE_TARGET_WORDS} words total. This is mandatory.
- Keep title, slug, focus_keyword, and category unless a tiny SEO tweak clearly helps.
- Every ## section needs 3+ substantial paragraphs (150+ words each). No one-paragraph sections.
- Add ### subheadings inside thin sections. Include specific dates, names, document IDs, quotes.
- Preserve accurate facts from the draft; add depth, context, timelines, and competing interpretations.
- Cite sources INLINE as markdown links — [title](URL) — at the claims they support.
- Keep ## FAQ with 3-4 ### questions; update faqs array to match.
- Never invent URLs. Copy verbatim from WEB RESEARCH or ALLOWED_SOURCE_URLS blocks in the user message.
- Do not pad with filler — earn length with substance.`;

export type ExpandableArticle = {
  title: string;
  slug: string;
  meta_description: string;
  focus_keyword: string;
  secondary_keywords: string[];
  content: string;
  excerpt: string;
  category: string;
  tags: string[];
  faqs?: Array<{ question: string; answer: string }>;
  sources: Array<{ title: string; url: string; description: string; tier?: string }>;
};

/**
 * Run up to `maxPasses` expansion calls when the draft is under `minWords`.
 * Returns the longest successful version.
 */
export async function expandArticleIfShort<T extends ExpandableArticle>(opts: {
  apiKey: string;
  article: T;
  researchBlock: string;
  allowlistBlock: string;
  minWords?: number;
  maxPasses?: number;
}): Promise<{ article: T; wordsBefore: number; wordsAfter: number; expanded: boolean; passes: number }> {
  const minWords = opts.minWords ?? ARTICLE_MIN_WORDS;
  const maxPasses = opts.maxPasses ?? 2;
  const wordsBefore = countArticleWords(opts.article.content);

  if (wordsBefore >= minWords) {
    return { article: opts.article, wordsBefore, wordsAfter: wordsBefore, expanded: false, passes: 0 };
  }

  let current = opts.article;
  let passes = 0;

  for (let pass = 1; pass <= maxPasses; pass += 1) {
    const words = countArticleWords(current.content);
    if (words >= minWords) break;

    const thin = thinSectionHeadings(current.content);
    const expandUser = `The draft below is only ${words} words — expand it to ${ARTICLE_TARGET_WORDS} words.

Sections that are too thin and MUST be developed: ${thin.length ? thin.join("; ") : "most body sections"}.

${opts.researchBlock}${opts.allowlistBlock}

DRAFT JSON TO EXPAND (return the full expanded JSON, especially a complete "content" field):
${JSON.stringify(current)}`;

    current = await callOpenAIJSON<T>({
      apiKey: opts.apiKey,
      system: EXPAND_SYSTEM,
      user: expandUser,
      maxTokens: 9000,
      model: "gpt-4o",
    });
    passes = pass;
  }

  const wordsAfter = countArticleWords(current.content);
  return {
    article: current,
    wordsBefore,
    wordsAfter,
    expanded: wordsAfter > wordsBefore,
    passes,
  };
}
