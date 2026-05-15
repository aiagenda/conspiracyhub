-- Google Search Console opportunity cache (written by /api/search-console via service role).
create table if not exists public.search_console_cache (
  id text primary key default 'latest',
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.search_console_cache enable row level security;

create policy "Search console cache public read"
  on public.search_console_cache
  for select
  using (true);
