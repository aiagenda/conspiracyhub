create table if not exists news_items (
  id uuid default gen_random_uuid() primary key,
  guardian_id text unique not null,
  title text not null,
  summary text,
  url text not null,
  image text,
  published_at timestamptz not null,
  section text not null,
  score integer not null,
  angle text,
  created_at timestamptz default now()
);

create table if not exists oracle_analyses (
  id uuid default gen_random_uuid() primary key,
  news_id uuid references news_items(id) on delete cascade,
  nodes jsonb not null,
  edges jsonb not null,
  sources jsonb not null default '[]'::jsonb,
  theories jsonb not null,
  conclusion text not null,
  verdict text not null,
  created_at timestamptz default now()
);

create table if not exists source_documents (
  id uuid default gen_random_uuid() primary key,
  url text unique not null,
  domain text not null,
  title text not null,
  source_type text not null check (source_type in ('official', 'media', 'research', 'archive')),
  tier text not null check (tier in ('A', 'B', 'C')),
  excerpt text,
  created_at timestamptz default now()
);

create table if not exists analysis_sources (
  id uuid default gen_random_uuid() primary key,
  analysis_id uuid references oracle_analyses(id) on delete cascade,
  source_id uuid references source_documents(id) on delete cascade,
  relation_note text,
  created_at timestamptz default now(),
  unique(analysis_id, source_id)
);

create table if not exists user_profiles (
  id uuid references auth.users primary key,
  email text not null,
  plan text default 'free' check (plan in ('free', 'pro')),
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now()
);

create table if not exists bets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users,
  analysis_id uuid references oracle_analyses(id),
  theory_index integer not null,
  side text check (side in ('yes', 'no')),
  created_at timestamptz default now(),
  unique(user_id, analysis_id, theory_index)
);

alter table news_items enable row level security;
alter table oracle_analyses enable row level security;
alter table user_profiles enable row level security;
alter table bets enable row level security;
alter table source_documents enable row level security;
alter table analysis_sources enable row level security;

drop policy if exists "News items are public" on news_items;
drop policy if exists "Analyses are public" on oracle_analyses;
drop policy if exists "Users see own profile" on user_profiles;
drop policy if exists "Users manage own bets" on bets;
drop policy if exists "Sources are public" on source_documents;
drop policy if exists "Analysis source links are public" on analysis_sources;

create policy "News items are public" on news_items for select using (true);
create policy "Analyses are public" on oracle_analyses for select using (true);
create policy "Users see own profile" on user_profiles for all using (auth.uid() = id);
create policy "Users manage own bets" on bets for all using (auth.uid() = user_id);
create policy "Sources are public" on source_documents for select using (true);
create policy "Analysis source links are public" on analysis_sources for select using (true);

-- URL-based analyses (see migration 20260508210000_url_analyses.sql)
create table if not exists url_analyses (
  id uuid default gen_random_uuid() primary key,
  source_url text not null,
  title text not null,
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  theories jsonb not null default '[]'::jsonb,
  sources jsonb not null default '[]'::jsonb,
  conclusion text not null default '',
  verdict text not null default 'QUESTIONABLE',
  created_at timestamptz default now()
);

create index if not exists url_analyses_source_url_idx on url_analyses(source_url);

alter table url_analyses enable row level security;

create policy "URL analyses are public" on url_analyses for select using (true);
create policy "Allow insert url analyses" on url_analyses for insert with check (true);
