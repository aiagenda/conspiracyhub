-- URL-based analyses (user-submitted articles)
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

drop policy if exists "URL analyses are public" on url_analyses;
drop policy if exists "Pro users can insert url analyses" on url_analyses;

create policy "URL analyses are public" on url_analyses for select using (true);
-- Inserts go through the API (service role). Authenticated clients could be restricted later.
create policy "Allow insert url analyses" on url_analyses for insert with check (true);
