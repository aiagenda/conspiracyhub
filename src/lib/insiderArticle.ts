/** Promoted Insider Radar posts stored as news_items. */
export function isInsiderPromotedNews(row: {
  source?: string | null;
  guardian_id?: string | null;
  url?: string | null;
}): boolean {
  const source = String(row.source ?? "");
  const gid = String(row.guardian_id ?? "");
  if (source.startsWith("insider:")) return true;
  if (gid.startsWith("insider-")) return true;
  return isSocialPostUrl(String(row.url ?? ""));
}

export function isSocialPostUrl(url: string): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "x.com" || host === "twitter.com" || host === "mobile.twitter.com";
  } catch {
    return /(?:^|\/\/)(?:www\.)?(?:twitter\.com|x\.com)\//i.test(url);
  }
}

export function buildInsiderArticleBody(row: {
  summary?: string | null;
  angle?: string | null;
  url?: string | null;
}): string {
  const parts: string[] = [];
  const summary = String(row.summary ?? "").trim();
  const angle = String(row.angle ?? "").trim();
  if (summary) parts.push(summary);
  if (angle && angle !== summary) parts.push(angle);
  const url = String(row.url ?? "").trim();
  if (url && isSocialPostUrl(url)) {
    parts.push(`\nSource post: ${url}`);
  }
  return parts.join("\n\n").trim();
}
