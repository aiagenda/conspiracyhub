/** One origin for canonical links, feeds, email links and metadata. */
export function getSiteUrl(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "https:" || url.protocol === "http:") return url.origin;
    } catch { /* Fall back to the public origin. */ }
  }
  return "https://www.the-theorist.com";
}
