/**
 * Oracle board links should point at a specific page (document, article, posting).
 * Bare origin URLs (e.g. https://nsarchive.gwu.edu/) read as "citations" but only open the homepage.
 */

export function isOracleUrlTooVague(urlStr: string): boolean {
  const trimmed = urlStr.trim();
  if (!/^https?:\/\//i.test(trimmed)) return true;
  try {
    const u = new URL(trimmed);
    const pathOnly = (u.pathname || "/").replace(/\/+$/, "") || "/";
    if (pathOnly !== "/") return false;
    return !u.search && !u.hash;
  } catch {
    return true;
  }
}

/** Returns a usable https URL or "" if missing, malformed, or homepage-only. */
export function sanitizeOracleHttpUrl(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (!s || !/^https?:\/\//i.test(s)) return "";
  if (isOracleUrlTooVague(s)) return "";
  return s;
}

export function sanitizeOracleTheoryUrlStrings(sources: unknown): string[] {
  if (!Array.isArray(sources)) return [];
  const out: string[] = [];
  for (const item of sources) {
    const u = sanitizeOracleHttpUrl(item);
    if (u && !out.includes(u)) out.push(u);
  }
  return out;
}
