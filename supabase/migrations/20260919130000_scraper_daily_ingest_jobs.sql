-- Daily ingest jobs at 09:00 UTC (Admin → Automation → Ingest & intel).
-- Matches Vercel cron on /api/scheduler/tick.

update public.scraper_jobs
set schedule_cron = '0 9 * * *', enabled = true
where job_key in ('news_main', 'outbreak_refresh', 'reddit_radar_scan');

update public.scraper_jobs
set
  schedule_cron = '0 9 * * *',
  enabled = true,
  config = '{"mode":"nuforc_only","max_new":70}'::jsonb
where job_key = 'uap_nuforc';

update public.scraper_jobs
set
  schedule_cron = '0 9 * * *',
  enabled = true,
  config = '{"mode":"full","max_new":70}'::jsonb
where job_key = 'uap_full_refresh';
