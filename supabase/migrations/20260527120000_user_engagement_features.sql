-- Email preferences, saved investigations, reading state for continue-where-you-left-off.

alter table public.user_profiles
  add column if not exists email_weekly_briefing boolean not null default true,
  add column if not exists email_high_threat_alerts boolean not null default true;

comment on column public.user_profiles.email_weekly_briefing is 'Weekly intelligence briefing opt-in (Resend).';
comment on column public.user_profiles.email_high_threat_alerts is 'High-threat (75%+) alert emails; typically PRO users.';

create table if not exists public.saved_investigations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  news_id uuid references public.news_items (id) on delete cascade,
  generated_article_id uuid references public.generated_articles (id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  constraint saved_investigations_one_target check (
    (news_id is not null and generated_article_id is null)
    or (news_id is null and generated_article_id is not null)
  )
);

create unique index if not exists saved_investigations_user_news_uidx
  on public.saved_investigations (user_id, news_id)
  where news_id is not null;

create unique index if not exists saved_investigations_user_gen_uidx
  on public.saved_investigations (user_id, generated_article_id)
  where generated_article_id is not null;

create index if not exists saved_investigations_user_created_idx
  on public.saved_investigations (user_id, created_at desc);

alter table public.saved_investigations enable row level security;

drop policy if exists "Users manage own saved investigations" on public.saved_investigations;
create policy "Users manage own saved investigations"
  on public.saved_investigations for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create table if not exists public.user_reading_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  news_id uuid,
  generated_article_id uuid,
  title text not null,
  path text not null,
  score integer,
  updated_at timestamptz not null default now()
);

alter table public.user_reading_state enable row level security;

drop policy if exists "Users manage own reading state" on public.user_reading_state;
create policy "Users manage own reading state"
  on public.user_reading_state for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

insert into public.scraper_jobs (job_key, name, target, schedule_cron, enabled, config)
values (
  'weekly_briefing',
  'Weekly intelligence briefing email',
  'weekly_briefing',
  '0 9 * * 0',
  true,
  '{}'::jsonb
)
on conflict (job_key) do nothing;
