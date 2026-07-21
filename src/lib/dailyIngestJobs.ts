/** Daily ingest jobs shown under Admin → Automation → Ingest & intel (09:00 UTC). */
export const DAILY_INGEST_CRON = "0 9 * * *";

export type DailyIngestJobDef = {
  job_key: string;
  name: string;
  target:
    | "news_scraper"
    | "uap_scraper"
    | "outbreak_scraper"
    | "reddit_radar_scraper";
  enabled: boolean;
  config: Record<string, unknown>;
  /** When set, this job is kept for history but NUFORC runs via the successor job. */
  supersededBy?: string;
};

export const DAILY_INGEST_JOBS: DailyIngestJobDef[] = [
  {
    job_key: "news_main",
    name: "Main news feed scrape",
    target: "news_scraper",
    enabled: true,
    config: {},
  },
  {
    job_key: "uap_nuforc",
    name: "NUFORC sightings scrape",
    target: "uap_scraper",
    enabled: false,
    config: { mode: "nuforc_only", max_new: 70 },
    supersededBy: "uap_full_refresh",
  },
  {
    job_key: "outbreak_refresh",
    name: "Outbreak intelligence refresh",
    target: "outbreak_scraper",
    enabled: true,
    config: {},
  },
  {
    job_key: "reddit_radar_scan",
    name: "Reddit topic radar scan",
    target: "reddit_radar_scraper",
    enabled: true,
    config: {},
  },
  {
    job_key: "uap_full_refresh",
    name: "UAP full intelligence refresh",
    target: "uap_scraper",
    enabled: true,
    config: { mode: "full", max_new: 70 },
  },
];

export const DAILY_INGEST_JOB_KEYS = DAILY_INGEST_JOBS.map((j) => j.job_key);
