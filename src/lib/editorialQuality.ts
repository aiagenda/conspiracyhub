/** Shared, deterministic publication checks. Passing is evidence coverage, not a truth verdict. */
export type EditorialEvidence = {
  title: string;
  url: string;
  text: string;
  publishedAt?: string | null;
};
export type EditorialChecks = {
  passed: boolean;
  issues: string[];
  checked_at: string;
  source_count: number;
};

export function canonicalSourceUrl(raw: string): string {
  try {
    const url = new URL(raw.trim());
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return "";
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return "";
  }
}

export function articleCitationUrls(content: string): string[] {
  return [...new Set([...content.matchAll(/(?<!!)\[[^\]]+\]\((https?:\/\/[^\s)]+)(?:\s+"[^"]*")?\)/g)]
    .map((m) => canonicalSourceUrl(m[1])).filter(Boolean))];
}

export function assessEditorialQuality(input: {
  title: string;
  content: string;
  evidence: EditorialEvidence[];
  minimumSources?: number;
  now?: Date;
}): EditorialChecks {
  const now = input.now ?? new Date();
  const issues: string[] = [];
  const words = input.content.trim().split(/\s+/).filter(Boolean).length;
  const evidence = input.evidence.filter((e) => e.text.trim().split(/\s+/).length >= 80 && canonicalSourceUrl(e.url));
  const urls = new Set(evidence.map((e) => canonicalSourceUrl(e.url)));
  const cited = articleCitationUrls(input.content);
  const citedEvidence = evidence.filter((e) => cited.includes(canonicalSourceUrl(e.url)));
  const domains = new Set(citedEvidence.map((e) => new URL(e.url).hostname.replace(/^www\./, "")));
  const minimumSources = input.minimumSources ?? 2;
  if (!input.title.trim() || words < 100) issues.push("Article needs a clear title and at least 100 words of useful reporting.");
  if (domains.size < minimumSources) issues.push(`Needs readable, cited evidence from at least ${minimumSources} independent source domains.`);
  const unknownLinks = cited.filter((url) => !urls.has(url) && !/(^|\.)the-theorist\.com$/.test(new URL(url).hostname));
  if (unknownLinks.length) issues.push("Some inline citations were not retrieved and checked against the evidence packet.");
  if (words > 1800 && evidence.length < 4) issues.push("Long investigation exceeds the available evidence; shorten it or research further.");
  const dated = citedEvidence.map((e) => e.publishedAt ? Date.parse(e.publishedAt) : NaN).filter(Number.isFinite);
  const newest = dated.length ? Math.max(...dated) : null;
  if (/\b(latest|breaking|today|yesterday|this (?:week|month|year)|new surge|recent surge)\b/i.test(`${input.title} ${input.content}`)) {
    if (newest === null || now.getTime() - newest > 45 * 86400000) issues.push("Current-news wording is unsupported by a recent, dated source; use explicit historical dates.");
  }
  if (dated.some((time) => time > now.getTime() + 86400000)) issues.push("A source publication date is in the future and needs review.");
  const paragraphs = input.content.split(/\n\s*\n/).map((p) => p.replace(/\W+/g, " ").trim().toLowerCase()).filter((p) => p.length > 120);
  if (new Set(paragraphs).size < paragraphs.length) issues.push("Repeated paragraphs need editing.");
  return { passed: issues.length === 0, issues, checked_at: now.toISOString(), source_count: domains.size };
}
