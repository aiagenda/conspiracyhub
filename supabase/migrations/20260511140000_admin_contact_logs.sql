-- Admin flag on user profiles
alter table public.user_profiles
  add column if not exists is_admin boolean not null default false;

-- ── CONTACT MESSAGES ─────────────────────────────────────────────────────────
create table if not exists public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null,
  category    text not null default 'support'
              check (category in ('support','business','press','other')),
  subject     text not null,
  message     text not null,
  ip_hash     text,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

alter table public.contact_messages enable row level security;
create policy "contact_messages_admin_only"
  on public.contact_messages for all
  using (false);   -- only accessible via service_role from API routes

-- ── PAGE VIEWS ───────────────────────────────────────────────────────────────
create table if not exists public.page_views (
  id          bigint generated always as identity primary key,
  path        text not null,
  fingerprint text,
  created_at  timestamptz not null default now()
);

create index if not exists page_views_created_at_idx on public.page_views (created_at desc);
create index if not exists page_views_path_idx on public.page_views (path);

alter table public.page_views enable row level security;
create policy "page_views_insert_public"
  on public.page_views for insert with check (true);
create policy "page_views_select_none"
  on public.page_views for select using (false);

-- ── API REQUEST LOGS ─────────────────────────────────────────────────────────
create table if not exists public.api_request_logs (
  id          bigint generated always as identity primary key,
  route       text not null,
  status_code integer not null default 200,
  duration_ms integer,
  created_at  timestamptz not null default now()
);

create index if not exists api_request_logs_created_at_idx on public.api_request_logs (created_at desc);
create index if not exists api_request_logs_route_idx on public.api_request_logs (route);

alter table public.api_request_logs enable row level security;
create policy "api_logs_insert_public"
  on public.api_request_logs for insert with check (true);
create policy "api_logs_select_none"
  on public.api_request_logs for select using (false);

-- ── AUTO-CLEANUP (keep 60 days of view/log data) ─────────────────────────────
create or replace function public.cleanup_old_logs()
returns void language sql as $$
  delete from public.page_views     where created_at < now() - interval '60 days';
  delete from public.api_request_logs where created_at < now() - interval '60 days';
$$;
