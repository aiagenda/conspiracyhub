-- Reddit Radar: matched Reddit threads ↔ site content + AI drafts

create table if not exists public.reddit_matches (
  id uuid primary key default gen_random_uuid(),
  reddit_url text not null unique,
  reddit_title text not null,
  subreddit text not null,
  reddit_published_at timestamptz,
  match_type text not null default 'news_item',
  matched_id text,
  matched_title text,
  site_url text not null,
  match_score integer not null default 0,
  status text not null default 'pending',
  draft_variants jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reddit_matches_status_created_idx
  on public.reddit_matches(status, created_at desc);

create index if not exists reddit_matches_subreddit_idx
  on public.reddit_matches(subreddit);

create or replace function public.touch_reddit_matches_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tr_touch_reddit_matches_updated_at on public.reddit_matches;
create trigger tr_touch_reddit_matches_updated_at
before update on public.reddit_matches
for each row execute function public.touch_reddit_matches_updated_at();

insert into public.scraper_jobs (job_key, name, target, schedule_cron, enabled, config)
values (
  'reddit_radar_scan',
  'Reddit topic radar scan',
  'reddit_radar_scraper',
  '0 9 * * *',
  true,
  '{}'::jsonb
)
on conflict (job_key) do update
set
  name = excluded.name,
  target = excluded.target,
  schedule_cron = excluded.schedule_cron;
