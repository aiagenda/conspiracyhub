create table if not exists public.scraper_jobs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null unique,
  name text not null,
  target text not null,
  schedule_cron text not null,
  enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scraper_runs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.scraper_jobs(id) on delete cascade,
  trigger text not null default 'cron',
  status text not null default 'running',
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  duration_ms integer,
  http_status integer,
  result jsonb,
  error_text text
);

create index if not exists scraper_jobs_enabled_idx
  on public.scraper_jobs(enabled);

create index if not exists scraper_runs_job_started_idx
  on public.scraper_runs(job_id, started_at desc);

create or replace function public.touch_scraper_jobs_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_touch_scraper_jobs_updated_at on public.scraper_jobs;
create trigger tr_touch_scraper_jobs_updated_at
before update on public.scraper_jobs
for each row execute function public.touch_scraper_jobs_updated_at();

insert into public.scraper_jobs (job_key, name, target, schedule_cron, enabled, config)
values
  ('news_main', 'Main news feed scrape', 'news_scraper', '0 9 * * *', true, '{}'::jsonb),
  ('uap_nuforc', 'NUFORC sightings scrape', 'uap_scraper', '0 9 * * *', true, '{"max_new":70}'::jsonb)
on conflict (job_key) do update
set
  name = excluded.name,
  target = excluded.target,
  schedule_cron = excluded.schedule_cron;
