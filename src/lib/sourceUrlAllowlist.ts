import type { OracleAnalysis } from "@/types";
import { trustedArticleSourceUrl } from "@/lib/generatedArticleSourceUrls";
import { sanitizeOracleHttpUrl } from "@/lib/oracleSourceUrls";

const HTTPS_IN_TEXT =
  /https?:\/\/[^\s"'<>)\]\u0000-\u001f]+/gi;

/** Normalize URL for allowlist equality (no hash; trim trailing slash on path). */
export function canonicalUrlKey(href: string): string | null {
  try {
    const u = new URL(href.trim());
    u.hash = "";
    let path = u.pathname;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    u.pathname = path;
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname}${u.search}`;
  } catch {
    return null;
  }
}

export function extractHttpsUrlsFromText(text: string, max = 40): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  const t = text ?? "";
  HTTPS_IN_TEXT.lastIndex = 0;
  while ((m = HTTPS_IN_TEXT.exec(t)) !== null) {
    let raw = m[0].replace(/[,;.)]+$/, "");
    try {
      const u = new URL(raw);
      const href = u.href;
      const k = canonicalUrlKey(href);
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push(href);
      }
    } catch {
      /* skip */
    }
    if (out.length >= max) break;
  }
  return out;
}

export function mergeUrlSeeds(...groups: (string | undefined | null)[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const g of groups) {
    for (const raw of g) {
      const s = typeof raw === "string" ? raw.trim() : "";
      if (!/^https?:\/\//i.test(s)) continue;
      const k = canonicalUrlKey(s);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}

export type SourceUrlAllowlist = {
  /** Non-empty when at least one seed URL exists — append to model user message. */
  promptBlock: string;
  /** True when model must only cite listed URLs (Oracle / strict article mode). */
  isActive: boolean;
  /** After vague-URL strip: keep URL only if allowlisted (or inactive → pass through if still https). */
  sanitizeToAllowlisted: (url: unknown) => string;
  /** Deep-merge allowlist onto Oracle JSON. */
  applyToOracleAnalysis: (analysis: OracleAnalysis) => OracleAnalysis;
};

export type SourceUrlAllowlistPromptStyle = "oracle" | "article";

export function createSourceUrlAllowlist(
  seedUrls: string[],
  promptStyle: SourceUrlAllowlistPromptStyle = "oracle",
): SourceUrlAllowlist {
  const merged = mergeUrlSeeds(seedUrls);
  const keys = new Set<string>();
  const resolve = new Map<string, string>();
  for (const u of merged) {
    const k = canonicalUrlKey(u);
    if (!k) continue;
    keys.add(k);
    if (!resolve.has(k)) resolve.set(k, u);
  }
  const isActive = keys.size > 0;

  const promptBlock = isActive
    ? promptStyle === "article"
      ? [
          "",
          "--- ALLOWED_SOURCE_URLS (seed story)",
          "These URLs come from the seed story or prompt context. When your source entry refers to that exact article or page, copy its url verbatim from the list below.",
          "You SHOULD also include additional sources[] rows with full https URLs on trusted domains from the system message (e.g. cia.gov reading room, congress.gov, archives.gov) when they support your claims — each must be a specific page path you are confident exists, not a bare homepage.",
          ...merged.slice(0, 35).map((u) => `- ${u}`),
        ].join("\n")
      : [
          "",
          "--- ALLOWED_SOURCE_URLS (mandatory)",
          "You may use ONLY the following exact HTTPS URLs for any web citation:",
          "* node.detail.source_url",
          '* theory "sources" array entries',
          '* top-level "sources" array item "url"',
          "Copy a URL verbatim from the list below, or use an empty string \"\" if none fits (never invent, guess, or use a different host/path).",
          ...merged.slice(0, 35).map((u) => `- ${u}`),
        ].join("\n")
    : "";

  function sanitizeToAllowlisted(url: unknown): string {
    const v = sanitizeOracleHttpUrl(url);
    if (!v) return "";
    if (!isActive) return v;
    const k = canonicalUrlKey(v);
    if (!k || !keys.has(k)) return "";
    return resolve.get(k) ?? v;
  }

  function applyToOracleAnalysis(analysis: OracleAnalysis): OracleAnalysis {
    const theories = (analysis.theories ?? []).map((t) => ({
      ...t,
      sources: (Array.isArray(t.sources) ? t.sources : [])
        .map((s) => sanitizeToAllowlisted(typeof s === "string" ? s : ""))
        .filter((s) => s.length > 0),
    }));

    const nodes = (analysis.nodes ?? []).map((node) => ({
      ...node,
      detail: {
        ...node.detail,
        source_url: (() => {
          const u = sanitizeToAllowlisted(node.detail?.source_url);
          return u || undefined;
        })(),
      },
    }));

    const sources = (Array.isArray(analysis.sources) ? analysis.sources : []).map((s) => ({
      ...s,
      url: sanitizeToAllowlisted((s as { url?: string }).url),
    }));

    return {
      ...analysis,
      nodes,
      theories,
      sources,
    };
  }

  return { promptBlock, isActive, sanitizeToAllowlisted, applyToOracleAnalysis };
}

/**
 * When the seed allowlist is active, URLs must still match either a seed URL or a
 * trusted outlet / government domain (same set as `sanitizeSources`) so FOIA and
 * Congress links are not stripped just because they were not in the news excerpt.
 */
export function applyAllowlistToArticleSources<T extends { url?: string }>(
  rows: T[],
  allow: SourceUrlAllowlist,
): T[] {
  return rows.map((row) => {
    const raw = typeof row.url === "string" ? row.url.trim() : String(row?.url ?? "").trim();
    const seeded = allow.sanitizeToAllowlisted(row.url);
    const trusted = allow.isActive && !seeded ? trustedArticleSourceUrl(raw) : "";
    return { ...row, url: seeded || trusted };
  });
}
