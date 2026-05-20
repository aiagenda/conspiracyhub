-- Insider Radar: single-row JSON cache. X/YouTube fetched only via cron or admin refresh.
create table if not exists public.insider_radar_cache (
  id text primary key,
  data jsonb not null,
  refreshed_at timestamptz not null default now()
);

alter table public.insider_radar_cache enable row level security;

create policy "Insider radar cache public read"
  on public.insider_radar_cache for select using (true);

insert into public.scraper_jobs (job_key, name, target, schedule_cron, enabled, config)
values (
  'insider_radar_refresh',
  'Insider Radar feed refresh',
  'insider_radar_scraper',
  '0 9,21 * * *',
  true,
  '{}'::jsonb
)
on conflict (job_key) do update
set
  name = excluded.name,
  target = excluded.target,
  schedule_cron = excluded.schedule_cron,
  enabled = excluded.enabled;
