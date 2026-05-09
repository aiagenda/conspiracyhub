-- Outbreak data cache (1h TTL enforced in app). Writes use service role (bypasses RLS).
create table if not exists outbreak_cache (
  id uuid default gen_random_uuid() primary key,
  data jsonb not null,
  created_at timestamptz default now()
);

create index if not exists outbreak_cache_created_idx on outbreak_cache (created_at desc);

alter table outbreak_cache enable row level security;

create policy "Outbreak cache public read" on outbreak_cache for select using (true);
