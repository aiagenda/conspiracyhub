/** Default minimum AI priority score for ingest and public feed. Override with SCRAPER_MIN_SCORE or FEED_MIN_SCORE. */
export const FEED_MIN_SCORE_DEFAULT = 80;

/** Email/push alerts only for exceptional scores (above feed cutoff). */
export const ALERT_MIN_SCORE_DEFAULT = 85;

export function getFeedMinScore(): number {
  const raw = process.env.SCRAPER_MIN_SCORE ?? process.env.FEED_MIN_SCORE ?? String(FEED_MIN_SCORE_DEFAULT);
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return FEED_MIN_SCORE_DEFAULT;
  return Math.max(0, Math.min(100, n));
}

export function getAlertMinScore(): number {
  const raw = process.env.ALERT_MIN_SCORE ?? String(ALERT_MIN_SCORE_DEFAULT);
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return ALERT_MIN_SCORE_DEFAULT;
  return Math.max(0, Math.min(100, n));
}
