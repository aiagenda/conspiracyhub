/** Default minimum AI priority score for ingest and public feed. Override with SCRAPER_MIN_SCORE or FEED_MIN_SCORE. */
export const FEED_MIN_SCORE_DEFAULT = 70;

export function getFeedMinScore(): number {
  const raw = process.env.SCRAPER_MIN_SCORE ?? process.env.FEED_MIN_SCORE ?? String(FEED_MIN_SCORE_DEFAULT);
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return FEED_MIN_SCORE_DEFAULT;
  return Math.max(0, Math.min(100, n));
}
