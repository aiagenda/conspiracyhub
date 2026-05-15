-- Weekly GSC sync (Sunday 07:00 UTC) then SEO article from top opportunity (08:00 UTC).
insert into public.scraper_jobs (job_key, name, target, schedule_cron, enabled, config)
values
  ('search_console_sync', 'Search Console sync', 'search_console', '0 7 * * 0', true, '{}'::jsonb),
  ('article_writer_gsc', 'Search Console SEO Article', 'article_writer', '0 8 * * 0', true, '{"mode":"search_console"}'::jsonb)
on conflict (job_key) do update
set
  name = excluded.name,
  target = excluded.target,
  schedule_cron = excluded.schedule_cron,
  enabled = excluded.enabled,
  config = excluded.config;
