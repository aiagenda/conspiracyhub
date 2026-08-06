/**
 * Trusted apex domains for generated article `sources[].url`.
 * Used at insert time and for admin bulk "sanitize sources".
 */
import { isOracleUrlTooVague } from "@/lib/oracleSourceUrls";

export const TRUSTED_SOURCE_DOMAINS = [
  // ── US government & military (blanket) ──────────────────────────────────────
  // Any *.gov / *.mil host is inherently a primary source for FOIA, declassified
  // programs and agency records (fbi.gov/vault, nsa.gov, state.gov, energy.gov …).
  // Note: `.gov.uk` and other foreign TLDs do NOT match — this is US-only.
  // Homepages are still rejected downstream by isOracleUrlTooVague().
  "gov",
  "mil",
  // ── Academic & university ───────────────────────────────────────────────────
  // `edu` covers US universities; `ac.uk` the UK. Universities on national TLDs
  // (mcgill.ca, uni-x.de …) cannot be matched by suffix and must be named explicitly.
  "edu",
  "ac.uk",
  // ── Reference & fact-checking ───────────────────────────────────────────────
  // A site that weighs "documented vs speculation" needs the debunk side on hand —
  // without these the model can only cite sources that support a claim.
  "wikipedia.org",
  "britannica.com",
  "theconversation.com",
  "snopes.com",
  "factcheck.org",
  "politifact.com",
  "fullfact.org",
  // ── Named government paths kept explicit (used as site: hints when searching) ─
  "cia.gov",
  "archives.gov",
  "federalregister.gov",
  "congress.gov",
  "govinfo.gov",
  "gao.gov",
  "dni.gov",
  "defense.gov",
  "darpa.mil",
  "fda.gov",
  "cdc.gov",
  "pubmed.ncbi.nlm.nih.gov",
  "ncbi.nlm.nih.gov",
  "patents.google.com",
  "aaro.mil",
  "nsarchive.gwu.edu",
  // ── Archives & primary-document repositories ────────────────────────────────
  "archive.org",
  "hathitrust.org",
  "wikisource.org",
  "muckrock.com",
  "governmentattic.org",
  "documentcloud.org",
  // ── Peer-reviewed / scientific ──────────────────────────────────────────────
  "nature.com",
  "science.org",
  "jstor.org",
  "arxiv.org",
  "bmj.com",
  "thelancet.com",
  "nejm.org",
  "scientificamerican.com",
  // ── Major news outlets ──────────────────────────────────────────────────────
  "nytimes.com",
  "theguardian.com",
  "reuters.com",
  "apnews.com",
  "bbc.com",
  "bbc.co.uk",
  "washingtonpost.com",
  "politico.com",
  "wired.com",
  "theintercept.com",
  "propublica.org",
  "npr.org",
  "pbs.org",
  "theatlantic.com",
  "newyorker.com",
  "latimes.com",
  "bloomberg.com",
  "ft.com",
  "economist.com",
  "time.com",
  "nbcnews.com",
  "cbsnews.com",
  "cnn.com",
  "forbes.com",
  "newsweek.com",
  "aljazeera.com",
  "dw.com",
  "smithsonianmag.com",
  // ── Advocacy / research organisations ───────────────────────────────────────
  "fas.org",
  "aclu.org",
  // ── AI & technology ─────────────────────────────────────────────────────────
  // Required by the AI & Tech section: without these, researchTopic() returns almost
  // nothing for AI topics, because the general news list barely covers this beat.
  // Primary sources — the labs' own docs and announcements. Measured note: for AI queries
  // Brave mostly returns vendor blogs and SEO farms, so the official product/doc domains
  // ARE the primary sources here and must be listed explicitly. `claude.com` matters
  // because Anthropic's docs live on platform.claude.com, not anthropic.com.
  "anthropic.com",
  "claude.com",
  "openai.com",
  "deepmind.google",
  "ai.google.dev",
  "research.google",
  "blog.google",
  "ai.meta.com",
  "mistral.ai",
  "cohere.com",
  "x.ai",
  "huggingface.co",
  "github.com",
  "github.blog",
  "arxiv.org",
  "paperswithcode.com",
  "artificialanalysis.ai",
  "pytorch.org",
  "tensorflow.org",
  "nvidia.com",
  "developer.nvidia.com",
  // Major clouds & platform docs (Bedrock, Azure AI, Vertex …):
  "aws.amazon.com",
  "cloud.google.com",
  "azure.microsoft.com",
  "microsoft.com",
  "databricks.com",
  "cloudflare.com",
  "vercel.com",
  // Developer reference:
  "developer.mozilla.org",
  "python.org",
  "kubernetes.io",
  "docker.com",
  "npmjs.com",
  "stackoverflow.com",
  // Standards & policy:
  "nist.gov",
  "iso.org",
  "w3.org",
  "digital-strategy.ec.europa.eu",
  // Trade press:
  "techcrunch.com",
  "arstechnica.com",
  "theverge.com",
  "venturebeat.com",
  "zdnet.com",
  "theregister.com",
  "technologyreview.com",
  "ieee.org",
  "spectrum.ieee.org",
  "acm.org",
  "stackoverflow.blog",
  "semianalysis.com",
] as const;

export type SanitizedSource = { title: string; url: string; description: string };

/** Full https URL string if hostname is in TRUSTED_SOURCE_DOMAINS; otherwise "". */
export function trustedArticleSourceUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) return "";
  try {
    const { hostname } = new URL(trimmed);
    const trusted = TRUSTED_SOURCE_DOMAINS.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`),
    );
    if (!trusted) return "";
    if (isOracleUrlTooVague(trimmed)) return "";
    return trimmed;
  } catch {
    return "";
  }
}

interface RawSource {
  title?: unknown;
  url?: unknown;
  description?: unknown;
}

export function sanitizeSources(raw: unknown): SanitizedSource[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: RawSource) => {
      const title = String(s?.title ?? "").trim();
      const description = String(s?.description ?? "").trim();
      const rawUrl = String(s?.url ?? "").trim();
      const validatedUrl = trustedArticleSourceUrl(rawUrl);

      return { title, url: validatedUrl, description };
    })
    .filter((s) => s.title);
}
