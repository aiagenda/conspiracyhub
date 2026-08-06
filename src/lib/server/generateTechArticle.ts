/**
 * AI & Tech article writer — the "paste a source, get an original long-form piece" path.
 *
 * Deliberately NOT a rewriter. Paraphrasing a source sentence-by-sentence produces what
 * Google's spam policies call scraped/scaled content, which is the opposite of the goal
 * (traffic). Instead: extract the FACTS from the source, run independent research, and
 * write an original piece with its own structure and analysis that attributes and links
 * the source. `verbatimOverlapPercent` on the result reports how much literal phrasing
 * survived, so originality is a measured number rather than a promise.
 */

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { callOpenAIJSON } from "@/lib/openai";
import { fetchUrlContent } from "@/lib/urlContent";
import { sanitizeSources, trustedArticleSourceUrl } from "@/lib/generatedArticleSourceUrls";
import { createSourceUrlAllowlist, mergeUrlSeeds } from "@/lib/sourceUrlAllowlist";
import { enrichSourcesWithRealUrls } from "@/lib/searchSourceUrl";
import { mergeResearchSources, researchPromptBlock, researchTopic } from "@/lib/server/articleResearch";
import { countArticleWords, expandArticleIfShort, type ExpandableArticle } from "@/lib/server/articleExpand";
import { fetchNewsSourceContent } from "@/lib/server/fetchNewsSourceBody";
import {
  countH2Sections,
  firstMarkdownImageUrl,
  injectInlineImages,
  normalizeImageSlots,
  resolveImagePlacements,
  type ImageSlot,
  type SourceImage,
} from "@/lib/server/inlineArticleImages";
import { injectInternalLinks, normalizeFaqs, rankRelatedArticles } from "@/lib/blogSeo";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://the-theorist.com";

/** Section identity: `category` drives the /ai listing, `mode` labels the writer. */
export const TECH_CATEGORY = "ai";
export const TECH_MODE = "tech_brief";

/**
 * Long-form floor for this section. Word count is not a Google ranking factor, but for
 * competitive AI/tech explainer queries the formats that satisfy intent land here.
 */
const TECH_MIN_WORDS = 2000;

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
    .replace(/-$/, "");
}

const TECH_SYSTEM = `You are a senior technology journalist writing original long-form analysis on AI and technology for The Theorist's AI & Tech desk.

This desk is FACTUAL REPORTING — not speculation, not conspiracy framing. Never imply a cover-up
or hidden agenda. If a claim is contested, say who contests it and on what evidence.

=== ORIGINALITY — THE HARD RULE ===
The user message contains a SOURCE ARTICLE. It is raw material, NOT a template.
- NEVER paraphrase it sentence-by-sentence or section-by-section. Sentence-level rewriting is
  plagiarism with extra steps and will be rejected.
- Build your OWN outline. It must differ structurally from the source's ordering.
- Your value-add is what the source does NOT have: technical mechanics, comparison to
  alternatives, historical context, second-order implications, and who is affected how.
- Ground the piece in the WEB RESEARCH results too, not only the source.
- Attribute the source explicitly and link it once — e.g. "as [Publication](URL) first reported".
- You may quote at most ONE short fragment (under 20 words) in quotation marks with attribution.
  Everything else must be your own wording.
- Facts are not owned — reuse them freely. Sentences ARE owned — never reuse them.

=== FORMAT (this is the structure that performs for AI/tech queries) ===
- Open with a "## TL;DR" — 3-5 tight bullets a reader can act on immediately.
- Then develop the story: what happened, how the technology actually works, how it compares to
  the alternatives, what it changes, what to watch next.
- ${TECH_MIN_WORDS}-3000 words. Earn the length with substance — specific numbers, versions,
  benchmarks, dates, named people and companies. Never pad with filler or restatement.
- At least 6 H2 sections, each 3+ substantial paragraphs. Use ### subheadings inside them.
- Include at least one markdown comparison table where it genuinely aids understanding
  (models, versions, pricing, benchmark numbers, before/after).
- Use fenced code blocks for any code, config, or API example.
- Cite sources INLINE as markdown links — [source title](URL) — at the exact claim they support.
- End with "## FAQ": exactly 3-4 "### Question?" subsections with direct answers, and mirror
  the same Q&A pairs into the "faqs" JSON array.
- Plan 3 inline image breaks (Medium-style): after H2 sections 2, 4, and 6 (or the last
  section if fewer). Provide specific image search queries — product photos, hardware, UI
  screenshots, logos, conference photos. No generic stock clichés.
- Do NOT put image markdown in "content" — images are injected separately from image_slots.

=== SOURCE URL RULES ===
Priority: (1) URLs in the "--- WEB RESEARCH" block — retrieved live, verified reachable, copy
VERBATIM; (2) the source article's own URL; (3) your own recall, ONLY if you are 100% certain the
exact URL exists. If unsure, set url to "" and explain in the description where to find it.
Never invent or guess a URL, document ID, version number, or benchmark figure.
Aim for 8-14 entries in "sources".

Return ONLY valid JSON (no markdown outside the JSON):
{
  "title": "SEO title, 60 chars max, contains the main keyword naturally",
  "slug": "url-friendly-slug",
  "meta_description": "155 char SEO description",
  "focus_keyword": "main keyword phrase",
  "secondary_keywords": ["kw2", "kw3", "kw4"],
  "content": "Full article in markdown with ## and ### headings, a table, and inline links",
  "excerpt": "2-3 sentence teaser",
  "category": "${TECH_CATEGORY}",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "faqs": [{"question": "...?", "answer": "2-4 sentence direct answer."}],
  "image_slots": [
    {
      "after_h2_index": 2,
      "search_query": "specific 4-8 word image search for this section",
      "caption": "Short factual caption (max 18 words)"
    },
    {
      "after_h2_index": 4,
      "search_query": "specific 4-8 word image search",
      "caption": "Short factual caption"
    },
    {
      "after_h2_index": 6,
      "search_query": "specific 4-8 word image search",
      "caption": "Short factual caption"
    }
  ],
  "sources": [{"title": "...", "url": "https://real-url-or-empty", "description": "what it contains and why it matters"}]
}`;

// ── Inline images ─────────────────────────────────────────────────────────────

type TechArticleDraft = ExpandableArticle & { image_slots?: ImageSlot[] };

function defaultTechImageSlots(keyword: string): ImageSlot[] {
  const q = keyword.trim() || "artificial intelligence technology";
  return [
    { after_h2_index: 2, search_query: `${q} product photo`, caption: `Visual context for ${q}` },
    { after_h2_index: 4, search_query: `${q} hardware diagram`, caption: `${q} in practice` },
    { after_h2_index: 6, search_query: `${q} industry conference`, caption: `${q} ecosystem` },
  ];
}

function sourceImageLabel(title: string, url: string): string {
  if (title.trim()) return title.trim();
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source article";
  }
}

async function enrichTechArticleImages(
  article: TechArticleDraft,
  sourceImages: SourceImage[],
  sourceLabel: string,
): Promise<string> {
  const h2Count = countH2Sections(article.content);
  const slots = normalizeImageSlots(
    article.image_slots?.length ? article.image_slots : defaultTechImageSlots(article.focus_keyword),
    h2Count,
  );
  if (!slots.length) return article.content;

  const placements = await resolveImagePlacements(slots, sourceImages, sourceLabel);
  return injectInlineImages(article.content, placements);
}

// ── Plagiarism measurement ────────────────────────────────────────────────────

/** Lowercased word tokens, punctuation stripped — markdown syntax removed first. */
function tokenize(text: string): string[] {
  return text
    .replace(/```[\s\S]*?```/g, " ") // code blocks are legitimately similar; exclude
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // link text only, drop URLs
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Share of the article's 8-word sequences that appear verbatim in the source.
 *
 * An 8-gram window is long enough that natural overlap on shared facts and proper nouns
 * stays low: independently written prose about the same event typically lands in the low
 * single digits, while sentence-level paraphrasing pushes this sharply up.
 */
export function verbatimOverlapPercent(sourceText: string, articleText: string, n = 8): number {
  const src = tokenize(sourceText);
  const art = tokenize(articleText);
  if (src.length < n || art.length < n) return 0;

  const srcGrams = new Set<string>();
  for (let i = 0; i + n <= src.length; i++) srcGrams.add(src.slice(i, i + n).join(" "));

  let hits = 0;
  let total = 0;
  for (let i = 0; i + n <= art.length; i++) {
    total++;
    if (srcGrams.has(art.slice(i, i + n).join(" "))) hits++;
  }

  return total === 0 ? 0 : Math.round((hits / total) * 1000) / 10;
}

// ── Core ──────────────────────────────────────────────────────────────────────

export type TechArticleParams = {
  /** Source article URL — extracted via fetchUrlContent (handles HTML, PDF, social). */
  sourceUrl?: string;
  /** Pasted source text, for paywalled or hard-to-fetch pages. Used when sourceUrl fails. */
  sourceText?: string;
  /** Optional editorial angle to steer the piece. */
  angle?: string;
  /** Publish immediately instead of creating a draft. Defaults to draft. */
  publish?: boolean;
};

export type TechArticleResult = { status: number; payload: Record<string, unknown> };

export async function runTechArticleCore(params: TechArticleParams): Promise<TechArticleResult> {
  if (!process.env.OPENAI_API_KEY) {
    return { status: 500, payload: { error: "OPENAI_API_KEY missing" } };
  }

  const { sourceUrl, sourceText, angle, publish = false } = params;
  if (!sourceUrl && !sourceText?.trim()) {
    return { status: 400, payload: { error: "sourceUrl or sourceText is required" } };
  }

  try {
    const admin = getAdmin();

    // ── 1. Get the source material ──
    let sourceTitle = "";
    let sourceBody = (sourceText ?? "").trim();
    let resolvedSourceUrl = "";
    let extraction = "pasted_text";
    let sourceImages: SourceImage[] = [];

    if (sourceUrl) {
      try {
        const fetched = await fetchUrlContent(sourceUrl);
        sourceTitle = fetched.title;
        extraction = fetched.source;
        resolvedSourceUrl = sourceUrl;
        // Pasted text wins if provided — the user saw the page, we may have hit a paywall.
        if (!sourceBody) sourceBody = fetched.text;
      } catch (e) {
        if (!sourceBody) {
          return {
            status: 422,
            payload: {
              error: "source_fetch_failed",
              message: `Could not read the source URL (${e instanceof Error ? e.message : String(e)}). Paste the article text instead.`,
            },
          };
        }
        resolvedSourceUrl = sourceUrl;
      }
    }

    if (resolvedSourceUrl.startsWith("http")) {
      try {
        const media = await fetchNewsSourceContent({ url: resolvedSourceUrl });
        sourceImages = media.images;
      } catch {
        /* images are optional */
      }
    }

    if (!sourceBody || sourceBody.length < 200) {
      return {
        status: 422,
        payload: { error: "source_too_short", message: "Extracted source text is too short to work from. Paste the article text instead." },
      };
    }

    // ── 2. Independent research (this is what makes the result original, not a rewrite) ──
    const researchQuery = (sourceTitle || sourceBody.slice(0, 120)).replace(/\s+/g, " ").trim();
    // "py" freshness + tech query angles: AI/tech moves fast and the investigation-style
    // angles ("declassified FOIA") return nothing on this beat.
    const findings = await researchTopic(researchQuery, "py", "tech");

    const seedUrls = resolvedSourceUrl ? [resolvedSourceUrl] : [];
    const allowlist = createSourceUrlAllowlist(
      mergeUrlSeeds([...seedUrls, ...findings.map((f) => f.url)], []),
      "article",
    );

    const researchBlock = researchPromptBlock(findings);
    const userPrompt = `Write an original long-form AI/technology analysis grounded in the source below.

${angle ? `Editorial angle to pursue: "${angle}"\n` : ""}--- SOURCE ARTICLE (raw material — extract the facts, never the sentences)
Title: ${sourceTitle || "(untitled)"}
${resolvedSourceUrl ? `URL: ${resolvedSourceUrl}` : "URL: (pasted text, no URL)"}
Extraction method: ${extraction}

${sourceBody.slice(0, 12000)}
--- END SOURCE ARTICLE

Internal links: reference "${SITE_URL}/ai" for the AI & Tech index.${researchBlock}${allowlist.promptBlock}`;

    // ── 3. Write ──
    let article = await callOpenAIJSON<TechArticleDraft>({
      apiKey: process.env.OPENAI_API_KEY!,
      system: TECH_SYSTEM,
      user: userPrompt,
      maxTokens: 9000,
      model: "gpt-4o",
    });

    // ── 4. Guarantee long-form (reuses the existing expansion pass) ──
    const expansion = await expandArticleIfShort({
      apiKey: process.env.OPENAI_API_KEY!,
      article,
      researchBlock,
      allowlistBlock: allowlist.promptBlock,
      minWords: TECH_MIN_WORDS,
    });
    article = expansion.article;

    // ── 4b. Inline images (Medium-style breaks + Brave fallback) ──
    const sourceLabel = sourceImageLabel(sourceTitle, resolvedSourceUrl);
    const contentWithImages = await enrichTechArticleImages(article, sourceImages, sourceLabel);
    article = { ...article, content: contentWithImages };

    // ── 5. Originality measurement ──
    const overlap = verbatimOverlapPercent(sourceBody, article.content);

    // ── 6. SEO enrichment (internal links + FAQ normalisation), same as other writers ──
    const baseSlug = slugify(article.slug || article.title);
    const finalSlug = `${baseSlug}-${Date.now().toString(36)}`;

    const { data: peers } = await admin
      .from("generated_articles")
      .select("slug, title, focus_keyword, category, tags")
      .eq("status", "published")
      .limit(50);

    const related = rankRelatedArticles(
      { slug: finalSlug, focus_keyword: article.focus_keyword, category: TECH_CATEGORY, tags: article.tags },
      (peers ?? []) as Array<{ slug: string; title: string; focus_keyword: string; category: string }>,
    );
    const content = injectInternalLinks(article.content, { siteUrl: SITE_URL, currentSlug: finalSlug, related });
    const faqs = normalizeFaqs(article.faqs, content);

    // ── 7. Sources: validate, fill empty URLs, then top up from research ──
    const cleaned = sanitizeSources(
      (article.sources ?? []).map((s) => {
        const raw = String(s?.url ?? "").trim();
        return { ...s, url: allowlist.sanitizeToAllowlisted(raw) || trustedArticleSourceUrl(raw) };
      }),
    );
    const sources = mergeResearchSources(
      await enrichSourcesWithRealUrls(cleaned, process.env.BRAVE_SEARCH_API_KEY),
      findings,
    );

    // ── 8. Insert ──
    const status = publish ? "published" : "draft";
    const row: Record<string, unknown> = {
      title: article.title,
      slug: finalSlug,
      meta_description: article.meta_description,
      focus_keyword: article.focus_keyword,
      secondary_keywords: article.secondary_keywords ?? [],
      content,
      excerpt: article.excerpt,
      category: TECH_CATEGORY,
      tags: article.tags ?? [],
      faqs,
      sources,
      mode: TECH_MODE,
      status,
      published_at: new Date().toISOString(),
    };

    let inserted = await admin.from("generated_articles").insert(row).select().single();
    if (inserted.error && /faqs/i.test(inserted.error.message)) {
      const { faqs: _omit, ...withoutFaqs } = row;
      inserted = await admin.from("generated_articles").insert(withoutFaqs).select().single();
    }
    if (inserted.error) return { status: 500, payload: { error: inserted.error.message } };

    if (publish) {
      try {
        revalidatePath("/ai");
        revalidatePath(`/blog/${finalSlug}`);
      } catch {
        /* revalidatePath only valid during a Next.js request */
      }
    }

    return {
      status: 200,
      payload: {
        success: true,
        article: {
          id: inserted.data.id,
          title: article.title,
          slug: finalSlug,
          status,
          url: `${SITE_URL}/blog/${finalSlug}`,
          word_count: countArticleWords(content),
          words_before_expand: expansion.wordsBefore,
          expanded: expansion.expanded,
          expand_passes: expansion.passes,
          verbatim_overlap_percent: overlap,
          source_count: sources.length,
          sources_with_links: sources.filter((s) => s.url).length,
          research_findings: findings.length,
          inline_images: (contentWithImages.match(/!\[/g) ?? []).length,
        },
      },
    };
  } catch (e) {
    return { status: 500, payload: { error: e instanceof Error ? e.message : String(e) } };
  }
}
