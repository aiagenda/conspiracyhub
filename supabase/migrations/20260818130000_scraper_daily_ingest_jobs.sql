-- Daily UTC 09:00 — enable and normalize five ingest jobs for admin Automation → Ingest & intel.
update public.scraper_jobs
set
  enabled = true,
  schedule_cron = '0 9 * * *',
  config = '{}'::jsonb
where job_key = 'news_main';

update public.scraper_jobs
set
  enabled = true,
  schedule_cron = '0 9 * * *',
  config = '{"max_new":70,"mode":"nuforc_only"}'::jsonb
where job_key = 'uap_nuforc';

update public.scraper_jobs
set
  enabled = true,
  schedule_cron = '0 9 * * *',
  config = '{}'::jsonb
where job_key = 'outbreak_refresh';

update public.scraper_jobs
set
  enabled = true,
  schedule_cron = '0 9 * * *',
  config = '{}'::jsonb
where job_key = 'reddit_radar_scan';

update public.scraper_jobs
set
  enabled = true,
  schedule_cron = '0 9 * * *',
  config = '{"max_new":70,"mode":"full"}'::jsonb
where job_key = 'uap_full_refresh';

insert into public.scraper_jobs (job_key, name, target, schedule_cron, enabled, config)
values
  ('news_main', 'Main news feed scrape', 'news_scraper', '0 9 * * *', true, '{}'::jsonb),
  ('uap_nuforc', 'NUFORC sightings scrape', 'uap_scraper', '0 9 * * *', true, '{"max_new":70,"mode":"nuforc_only"}'::jsonb),
  ('outbreak_refresh', 'Outbreak intelligence refresh', 'outbreak_scraper', '0 9 * * *', true, '{}'::jsonb),
  ('reddit_radar_scan', 'Reddit topic radar scan', 'reddit_radar_scraper', '0 9 * * *', true, '{}'::jsonb),
  ('uap_full_refresh', 'UAP full intelligence refresh', 'uap_scraper', '0 9 * * *', true, '{"max_new":70,"mode":"full"}'::jsonb)
on conflict (job_key) do update
set
  name = excluded.name,
  target = excluded.target,
  schedule_cron = excluded.schedule_cron,
  enabled = excluded.enabled,
  config = excluded.config;
