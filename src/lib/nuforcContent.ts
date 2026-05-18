/** Shared NUFORC WordPress ingest / display helpers. */

export type NuforcContentKind = "report" | "blog" | "case";

const BLOG_TITLE_RE =
  /\b(workshop|participat|announc|historical|radar case surfaces|press release|blog|update from|report from)\b/i;

export function nuforcPostIdFromSourceId(sourceId: string): number | null {
  const m = sourceId.match(/^wp-(\d+)/);
  if (!m) return null;
  const id = parseInt(m[1], 10);
  return Number.isFinite(id) ? id : null;
}

export function extractFirstImageUrl(html: string): string | null {
  if (!html) return null;
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    let url = m[1].trim();
    if (!url || url.startsWith("data:")) continue;
    if (url.startsWith("//")) url = `https:${url}`;
    if (url.startsWith("/")) url = `https://nuforc.org${url}`;
    if (/\.(svg|ico)(\?|$)/i.test(url)) continue;
    return url;
  }
  return null;
}

export function inferContentKind(
  title: string,
  plainLength: number,
  fromCaseExtract: boolean,
): NuforcContentKind {
  if (fromCaseExtract) return "case";
  if (plainLength > 1800 || BLOG_TITLE_RE.test(title)) return "blog";
  return "report";
}

export const NUFORC_EXCERPT_MAX = 8000;
export const NUFORC_CASE_SNIPPET_MAX = 1400;
