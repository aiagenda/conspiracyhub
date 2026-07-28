/**
 * Research-first step for the article writer.
 *
 * The old pipeline wrote from the model's parametric memory and only afterwards tried
 * to retrofit URLs onto claims it had already made — which is why generated articles
 * shipped with empty `url` fields. Here we search the live web BEFORE writing and feed
 * real, reachable results into the prompt, so the model cites what actually exists.
 */

import { searchBrave, type BraveResult } from "@/lib/braveSearch";
import { trustedArticleSourceUrl, type SanitizedSource } from "@/lib/generatedArticleSourceUrls";

export type ResearchFinding = { title: string; url: string; description: string };

const MAX_FINDINGS = 12;
const MAX_PER_HOST = 3;
const RESULTS_PER_QUERY = 6;

/**
 * Complementary angles so the pool holds primary documents, mainstream coverage and the
 * sceptical side. Plain keyword queries only — Brave handles `OR` operators poorly and
 * an operator-laden query measurably returns fewer results.
 */
function buildResearchQueries(topic: string): string[] {
  const clean = topic.replace(/\s+/g, " ").trim().slice(0, 180);
  if (!clean) return [];
  return [
    clean,
    `${clean} declassified documents FOIA`,
    `${clean} fact check evidence origins`,
  ];
}

/**
 * Run a small batch of live searches and keep only results on trusted domains.
 *
 * Queries run sequentially: Brave's free tier allows ~1 request/second, and firing them
 * in parallel makes every one but the first burn its single 429 retry.
 *
 * @param freshness `null` (default) searches all time — correct for archival topics like
 *   MKULTRA. Pass `"py"` for news-pegged pieces where only recent coverage matters.
 */
export async function researchTopic(
  topic: string,
  freshness: "pd" | "pw" | "pm" | "py" | null = null,
): Promise<ResearchFinding[]> {
  if (!process.env.BRAVE_SEARCH_API_KEY?.trim()) return [];

  const queries = buildResearchQueries(topic);
  const collected: BraveResult[] = [];
  for (const q of queries) {
    try {
      collected.push(...(await searchBrave(q, RESULTS_PER_QUERY, 0, freshness)));
    } catch {
      // A failed query just means fewer findings — never block article generation.
    }
  }

  const seenUrl = new Set<string>();
  const perHost = new Map<string, number>();
  const findings: ResearchFinding[] = [];

  for (const r of collected) {
    const url = trustedArticleSourceUrl(r.url);
    if (!url || seenUrl.has(url)) continue;

    let host: string;
    try {
      host = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      continue;
    }
    const used = perHost.get(host) ?? 0;
    if (used >= MAX_PER_HOST) continue; // keep the citation pool diverse

    seenUrl.add(url);
    perHost.set(host, used + 1);
    findings.push({
      title: r.title.trim(),
      url,
      description: (r.description ?? "").trim().slice(0, 220),
    });
    if (findings.length >= MAX_FINDINGS) break;
  }

  return findings;
}

/** Prompt block listing the verified URLs the model must cite from. */
export function researchPromptBlock(findings: ResearchFinding[]): string {
  if (!findings.length) return "";

  const lines = findings.map(
    (f, i) => `${i + 1}. ${f.title}\n   URL: ${f.url}\n   ${f.description}`,
  );

  return `\n\n--- WEB RESEARCH (live results, already verified reachable)
These pages were retrieved from a live web search moments ago. Ground the article in them:
- Cite them INLINE in the body as markdown links — [source title](URL) — at the exact claim they support, not only in a list at the end.
- Copy every URL VERBATIM from this list. Never shorten, modify, or guess a path.
- Add the ones you actually used to the "sources" array, again with the URL copied verbatim.
- Use at least ${Math.min(6, findings.length)} of these across the article.

${lines.join("\n")}`;
}

/** Article/dossier source row — `tier` is only used by the lore dossier path. */
export type SourceRow = SanitizedSource & { tier?: string };

/**
 * Append research findings the model did not cite, so an article always ships with real
 * links even when the model returns a thin `sources` array. Model-chosen sources keep
 * their position at the front.
 */
export function mergeResearchSources(
  modelSources: SourceRow[],
  findings: ResearchFinding[],
  opts: { cap?: number; tier?: string } = {},
): SourceRow[] {
  const { cap = 14, tier } = opts;
  const out: SourceRow[] = [...modelSources];
  const seen = new Set(modelSources.map((s) => s.url).filter(Boolean));

  for (const f of findings) {
    if (out.length >= cap) break;
    if (seen.has(f.url)) continue;
    seen.add(f.url);
    out.push({ title: f.title, url: f.url, description: f.description, ...(tier ? { tier } : {}) });
  }

  return out;
}
