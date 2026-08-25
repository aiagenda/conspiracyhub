-- Brag / Hyperframes launch video jobs (admin Brag Studio).

create table if not exists public.brag_jobs (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'queued'
    check (status in ('queued', 'planning', 'rendering', 'ready', 'plan_ready', 'failed')),
  tone text not null default 'default',
  format text not null default 'landscape'
    check (format in ('landscape', 'vertical', 'square')),
  title text,
  creative_direction text,
  plan_json jsonb,
  share_copy text,
  error_text text,
  video_path text,
  word_count int,
  duration_sec numeric(6,2),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists brag_jobs_created_idx on public.brag_jobs (created_at desc);
create index if not exists brag_jobs_status_idx on public.brag_jobs (status);

alter table public.brag_jobs enable row level security;

comment on table public.brag_jobs is 'Admin Brag Studio — Hyperframes launch video generation jobs.';
