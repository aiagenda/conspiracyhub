insert into public.scraper_jobs (job_key, name, target, schedule_cron, enabled, config)
values
  ('article_writer_daily', 'Daily News-Jacking Article', 'article_writer', '0 8 * * *', true, '{"mode":"news_jacking"}'::jsonb),
  ('article_writer_evergreen', 'Weekly Evergreen Article', 'article_writer', '0 10 * * 1', true, '{"mode":"evergreen"}'::jsonb)
on conflict (job_key) do update
set
  name = excluded.name,
  target = excluded.target,
  schedule_cron = excluded.schedule_cron,
  enabled = excluded.enabled,
  config = excluded.config;
