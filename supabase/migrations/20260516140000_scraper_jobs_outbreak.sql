-- Outbreak refresh job (manual via Admin → Feed scrapers; cron disabled by default — heavy OpenAI run).
insert into public.scraper_jobs (job_key, name, target, schedule_cron, enabled, config)
values
  ('outbreak_refresh', 'Outbreak intelligence refresh', 'outbreak_scraper', '0 9 * * *', false, '{}'::jsonb)
on conflict (job_key) do update
set
  name = excluded.name,
  target = excluded.target,
  schedule_cron = excluded.schedule_cron;
