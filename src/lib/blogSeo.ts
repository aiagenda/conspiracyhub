/** SEO helpers for /blog generated articles. */

export type BlogFaq = { question: string; answer: string };

export type RelatedBlogArticle = {
  slug: string;
  title: string;
  focus_keyword: string;
  category: string;
};

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-theorist.com").replace(/\/$/, "");
}

/** Dynamic OG image (SVG) with article title overlay. */
export function blogArticleOgImageUrl(title: string): string {
  const base = getSiteUrl();
  const q = new URLSearchParams({ title: title.slice(0, 120) });
  return `${base}/api/og/article?${q.toString()}`;
}

export function defaultOgImageUrl(): string {
  return `${getSiteUrl()}/brand/twitter/twitter-banner-the-theorist.png`;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Parse ## FAQ section from markdown if present. */
export function parseFaqsFromMarkdown(content: string): BlogFaq[] {
  const block = content.match(/##\s*FAQ\s*\n([\s\S]*?)(?=\n##\s+|$)/i)?.[1];
  if (!block) return [];

  const faqs: BlogFaq[] = [];
  const parts = block.split(/\n###\s+/).filter(Boolean);
  for (const part of parts) {
    const lines = part.trim().split("\n");
    const question = lines[0]?.replace(/^#+\s*/, "").trim();
    const answer = lines.slice(1).join("\n").trim();
    if (question && answer) faqs.push({ question, answer });
  }
  return faqs;
}

export function normalizeFaqs(
  raw: unknown,
  content: string,
): BlogFaq[] {
  if (Array.isArray(raw)) {
    const parsed = raw
      .map((row) => {
        if (!row || typeof row !== "object") return null;
        const q = String((row as { question?: string }).question ?? "").trim();
        const a = String((row as { answer?: string }).answer ?? "").trim();
        return q && a ? { question: q, answer: a } : null;
      })
      .filter((x): x is BlogFaq => x !== null);
    if (parsed.length) return parsed.slice(0, 6);
  }
  return parseFaqsFromMarkdown(content);
}

export function buildArticleJsonLd(article: {
  title: string;
  meta_description: string;
  focus_keyword: string;
  secondary_keywords?: string[];
  published_at: string;
  category: string;
  excerpt?: string;
}, canonical: string) {
  const site = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.meta_description,
    keywords: [article.focus_keyword, ...(article.secondary_keywords ?? [])].filter(Boolean).join(", "),
    datePublished: article.published_at,
    dateModified: article.published_at,
    url: canonical,
    articleSection: article.category,
    image: [blogArticleOgImageUrl(article.title), defaultOgImageUrl()],
    publisher: { "@type": "Organization", name: "The Theorist", url: site },
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
  };
}

export function buildFaqJsonLd(faqs: BlogFaq[], pageUrl: string) {
  if (!faqs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
  };
}

/** Score related articles for internal linking (same category + keyword overlap). */
export function rankRelatedArticles(
  current: { slug: string; focus_keyword: string; category: string; tags?: string[] },
  candidates: Array<RelatedBlogArticle & { tags?: string[] }>,
): RelatedBlogArticle[] {
  const kw = current.focus_keyword.toLowerCase();
  const tags = new Set((current.tags ?? []).map((t) => t.toLowerCase()));

  return [...candidates]
    .filter((c) => c.slug !== current.slug)
    .map((c) => {
      let score = 0;
      if (c.category === current.category) score += 3;
      const ck = c.focus_keyword.toLowerCase();
      if (ck && kw && (ck.includes(kw) || kw.includes(ck))) score += 4;
      for (const t of tags) {
        if (ck.includes(t) || c.title.toLowerCase().includes(t)) score += 1;
      }
      return { c, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ c }) => c)
    .slice(0, 6);
}

/**
 * Add contextual internal links + a Related investigations block (idempotent).
 */
export function injectInternalLinks(
  markdown: string,
  opts: { siteUrl: string; currentSlug: string; related: RelatedBlogArticle[] },
): string {
  const site = opts.siteUrl.replace(/\/$/, "");
  let out = markdown;
  const linkedSlugs = new Set<string>();

  if (out.includes("/blog/")) {
    const existing = out.matchAll(/\/blog\/([a-z0-9-]+)/gi);
    for (const m of existing) linkedSlugs.add(m[1].toLowerCase());
  }

  let inlineCount = 0;
  for (const r of opts.related) {
    if (inlineCount >= 2) break;
    if (r.slug === opts.currentSlug || linkedSlugs.has(r.slug.toLowerCase())) continue;

    const phrases = [r.focus_keyword, ...r.title.split(/\s+/).slice(0, 4).join(" ") ? [r.title.split(/\s+/).slice(0, 4).join(" ")] : []]
      .map((p) => p.trim())
      .filter((p) => p.length >= 5);

    for (const phrase of phrases) {
      const re = new RegExp(`(?<!\\[)(?<!/)\\b(${escapeRegex(phrase)})\\b`, "i");
      if (!re.test(out)) continue;
      const url = `${site}/blog/${r.slug}`;
      if (out.includes(url)) break;
      out = out.replace(re, `[$1](${url})`);
      linkedSlugs.add(r.slug.toLowerCase());
      inlineCount += 1;
      break;
    }
  }

  if (out.match(/##\s*Related investigations/i)) return out;

  const lines = opts.related
    .filter((r) => r.slug !== opts.currentSlug)
    .slice(0, 5)
    .map((r) => `- [${r.title}](${site}/blog/${r.slug}) — *${r.focus_keyword || r.category}*`);

  if (!lines.length) {
    lines.push(
      `- [Investigation reports](${site}/blog) — AI deep-dives on cover-ups, UAP, and declassified programs`,
      `- [UAP files](${site}/uap) — documented sighting archive`,
      `- [Investigation Board](${site}/guide) — interactive Oracle graph per story`,
    );
  }

  return `${out.trim()}\n\n## Related investigations\n\n${lines.join("\n")}\n`;
}
