-- Daily UTC 09:00 — enable all five ingest jobs under Admin → Automation → Ingest & intel.
update public.scraper_jobs
set
  schedule_cron = '0 9 * * *',
  enabled = true,
  config = '{}'::jsonb
where job_key = 'news_main';

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
  config = '{}'::jsonb
where job_key = 'outbreak_refresh';

update public.scraper_jobs
set
  schedule_cron = '0 9 * * *',
  enabled = true,
  config = '{}'::jsonb
where job_key = 'reddit_radar_scan';

update public.scraper_jobs
set
  schedule_cron = '0 9 * * *',
  enabled = true,
  config = '{"mode":"full","max_new":70}'::jsonb
where job_key = 'uap_full_refresh';

insert into public.scraper_jobs (job_key, name, target, schedule_cron, enabled, config)
values
  ('news_main', 'Main news feed scrape', 'news_scraper', '0 9 * * *', true, '{}'::jsonb),
  ('uap_nuforc', 'NUFORC sightings scrape', 'uap_scraper', '0 9 * * *', true, '{"mode":"nuforc_only","max_new":70}'::jsonb),
  ('outbreak_refresh', 'Outbreak intelligence refresh', 'outbreak_scraper', '0 9 * * *', true, '{}'::jsonb),
  ('reddit_radar_scan', 'Reddit topic radar scan', 'reddit_radar_scraper', '0 9 * * *', true, '{}'::jsonb),
  ('uap_full_refresh', 'UAP full intelligence refresh', 'uap_scraper', '0 9 * * *', true, '{"mode":"full","max_new":70}'::jsonb)
on conflict (job_key) do nothing;
