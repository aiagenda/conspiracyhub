-- Seismic monitor refresh (USGS + EMSC; manual via Admin → Ingest & intel).
insert into public.scraper_jobs (job_key, name, target, schedule_cron, enabled, config)
values
  ('seismic_refresh', 'Seismic monitor refresh', 'seismic_scraper', '0 * * * *', false, '{}'::jsonb)
on conflict (job_key) do update
set
  name = excluded.name,
  target = excluded.target,
  schedule_cron = excluded.schedule_cron;

-- Reddit radar scan disabled (unused).
update public.scraper_jobs set enabled = false where job_key = 'reddit_radar_scan';
