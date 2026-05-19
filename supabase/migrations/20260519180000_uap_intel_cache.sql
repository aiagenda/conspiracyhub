-- UAP intelligence cache: news + reference entities (incidents, people, orgs, documents)

create table if not exists public.uap_news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  source text,
  pub_date timestamptz,
  item_type text not null default 'news',
  scraped_at timestamptz not null default now(),
  constraint uap_news_url_unique unique (url)
);

create index if not exists uap_news_pub_date_idx on public.uap_news (pub_date desc nulls last);
create index if not exists uap_news_scraped_at_idx on public.uap_news (scraped_at desc);

create table if not exists public.uap_intel_reference (
  id text not null,
  entity_type text not null check (entity_type in ('incident', 'person', 'organization', 'document')),
  payload jsonb not null,
  is_curated boolean not null default false,
  source_label text,
  source_url text,
  updated_at timestamptz not null default now(),
  primary key (id, entity_type)
);

create index if not exists uap_intel_reference_type_idx
  on public.uap_intel_reference (entity_type, updated_at desc);

create table if not exists public.uap_intel_meta (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.uap_news enable row level security;
alter table public.uap_intel_reference enable row level security;
alter table public.uap_intel_meta enable row level security;

drop policy if exists "Public read uap_news" on public.uap_news;
create policy "Public read uap_news" on public.uap_news for select using (true);

drop policy if exists "Public read uap_intel_reference" on public.uap_intel_reference;
create policy "Public read uap_intel_reference" on public.uap_intel_reference for select using (true);

drop policy if exists "Public read uap_intel_meta" on public.uap_intel_meta;
create policy "Public read uap_intel_meta" on public.uap_intel_meta for select using (true);

-- Rename / upgrade scraper job to full UAP refresh
insert into public.scraper_jobs (job_key, name, target, schedule_cron, enabled, config)
values
  (
    'uap_full_refresh',
    'UAP full intelligence refresh',
    'uap_scraper',
    '0 9 * * *',
    true,
    '{"max_new":70}'::jsonb
  )
on conflict (job_key) do update
set
  name = excluded.name,
  target = excluded.target,
  schedule_cron = excluded.schedule_cron,
  config = excluded.config;

update public.scraper_jobs
set enabled = false
where job_key = 'uap_nuforc' and job_key <> 'uap_full_refresh';
