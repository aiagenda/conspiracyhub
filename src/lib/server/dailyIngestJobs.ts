/** Five ingest jobs refreshed daily (07:00 UTC automation + 09:00 UTC Vercel tick). */
export const DAILY_INGEST_JOB_KEYS = [
  "news_main",
  "uap_nuforc",
  "outbreak_refresh",
  "reddit_radar_scan",
  "uap_full_refresh",
] as const;

export type DailyIngestJobKey = (typeof DAILY_INGEST_JOB_KEYS)[number];

export const DAILY_INGEST_JOBS = [
  {
    job_key: "news_main",
    name: "Main news feed scrape",
    target: "news_scraper",
    schedule_cron: "0 9 * * *",
    enabled: true,
    config: {},
  },
  {
    job_key: "uap_nuforc",
    name: "NUFORC sightings scrape",
    target: "uap_scraper",
    schedule_cron: "0 9 * * *",
    enabled: true,
    config: { max_new: 70, mode: "nuforc_only" },
  },
  {
    job_key: "outbreak_refresh",
    name: "Outbreak intelligence refresh",
    target: "outbreak_scraper",
    schedule_cron: "0 9 * * *",
    enabled: true,
    config: {},
  },
  {
    job_key: "reddit_radar_scan",
    name: "Reddit topic radar scan",
    target: "reddit_radar_scraper",
    schedule_cron: "0 9 * * *",
    enabled: true,
    config: {},
  },
  {
    job_key: "uap_full_refresh",
    name: "UAP full intelligence refresh",
    target: "uap_scraper",
    schedule_cron: "0 9 * * *",
    enabled: true,
    config: { max_new: 70, mode: "full" },
  },
] as const;

export function isDailyIngestJobKey(key: string): key is DailyIngestJobKey {
  return (DAILY_INGEST_JOB_KEYS as readonly string[]).includes(key);
}
