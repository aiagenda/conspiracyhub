-- Daily ingest jobs: all five Admin → Automation → Ingest & intel jobs at 09:00 UTC.
-- Vercel Hobby allows one cron/day; /api/scheduler/tick runs due jobs sequentially.

update public.scraper_jobs
set schedule_cron = '0 9 * * *', enabled = true
where job_key in (
  'news_main',
  'uap_nuforc',
  'outbreak_refresh',
  'reddit_radar_scan',
  'uap_full_refresh'
);

update public.scraper_jobs
set config = '{"mode":"nuforc_only","max_new":70}'::jsonb
where job_key = 'uap_nuforc';

update public.scraper_jobs
set config = '{"mode":"full","max_new":70}'::jsonb
where job_key = 'uap_full_refresh';
