-- Add article_writer jobs for UAP incident, Oracle deep-dive, and reference document modes
insert into public.scraper_jobs (job_key, name, target, schedule_cron, enabled, config)
values
  ('article_writer_uap', 'UAP Incident Article', 'article_writer', '0 9 * * 3', true, '{"mode":"uap_incident"}'::jsonb),
  ('article_writer_oracle', 'Oracle Deep-Dive Article', 'article_writer', '0 9 * * 5', true, '{"mode":"oracle_deep_dive"}'::jsonb),
  ('article_writer_ref', 'Declassified Doc Article', 'article_writer', '0 10 * * 3', true, '{"mode":"reference_doc"}'::jsonb)
on conflict (job_key) do update
set
  name = excluded.name,
  target = excluded.target,
  schedule_cron = excluded.schedule_cron,
  enabled = excluded.enabled,
  config = excluded.config;
