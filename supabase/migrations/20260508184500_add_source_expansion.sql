alter table if exists oracle_analyses
  add column if not exists sources jsonb not null default '[]'::jsonb;

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
  unique (analysis_id, source_id)
);

alter table if exists source_documents enable row level security;
alter table if exists analysis_sources enable row level security;

drop policy if exists "Sources are public" on source_documents;
drop policy if exists "Analysis source links are public" on analysis_sources;

create policy "Sources are public" on source_documents for select using (true);
create policy "Analysis source links are public" on analysis_sources for select using (true);
