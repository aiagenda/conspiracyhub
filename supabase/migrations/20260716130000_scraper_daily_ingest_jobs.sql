-- Daily ingest jobs: enable all five at 09:00 UTC (matches Vercel cron /api/scheduler/tick).
update public.scraper_jobs
set enabled = true, schedule_cron = '0 9 * * *'
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
