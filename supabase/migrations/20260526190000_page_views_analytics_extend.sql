-- Extended first-party analytics: visitor id, referrer, UTM, device type.

alter table public.page_views
  add column if not exists visitor_id text,
  add column if not exists referrer_host text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text,
  add column if not exists device_type text;

create index if not exists page_views_visitor_created_idx
  on public.page_views (visitor_id, created_at desc)
  where visitor_id is not null;

create index if not exists page_views_referrer_created_idx
  on public.page_views (referrer_host, created_at desc)
  where referrer_host is not null;

comment on column public.page_views.visitor_id is 'Anonymous browser UUID from localStorage (more stable than IP fingerprint).';
comment on column public.page_views.referrer_host is 'Normalized hostname from document.referrer at track time.';
comment on column public.page_views.device_type is 'mobile | desktop | tablet | unknown';

-- Distinct visitors: prefer visitor_id, fall back to fingerprint.
create or replace function public.admin_unique_visitors(
  since_at timestamptz,
  exclude_fingerprints text[] default null
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct coalesce(nullif(trim(pv.visitor_id), ''), pv.fingerprint))::bigint
  from public.page_views pv
  where pv.created_at >= since_at
    and (
      exclude_fingerprints is null
      or cardinality(exclude_fingerprints) = 0
      or pv.fingerprint is null
      or not (pv.fingerprint = any (exclude_fingerprints))
    );
$$;

create or replace function public.admin_page_views_by_referrer(
  since_at timestamptz,
  exclude_fingerprints text[] default null,
  row_limit int default 15
)
returns table (
  referrer_host text,
  view_count bigint,
  unique_viewers bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(nullif(trim(pv.referrer_host), ''), '(direct)') as referrer_host,
    count(*)::bigint as view_count,
    count(distinct coalesce(nullif(trim(pv.visitor_id), ''), pv.fingerprint))::bigint as unique_viewers
  from public.page_views pv
  where pv.created_at >= since_at
    and (
      exclude_fingerprints is null
      or cardinality(exclude_fingerprints) = 0
      or pv.fingerprint is null
      or not (pv.fingerprint = any (exclude_fingerprints))
    )
  group by 1
  order by view_count desc
  limit greatest(row_limit, 1);
$$;

create or replace function public.admin_page_views_by_device(
  since_at timestamptz,
  exclude_fingerprints text[] default null
)
returns table (
  device_type text,
  view_count bigint,
  unique_viewers bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(nullif(trim(pv.device_type), ''), 'unknown') as device_type,
    count(*)::bigint as view_count,
    count(distinct coalesce(nullif(trim(pv.visitor_id), ''), pv.fingerprint))::bigint as unique_viewers
  from public.page_views pv
  where pv.created_at >= since_at
    and (
      exclude_fingerprints is null
      or cardinality(exclude_fingerprints) = 0
      or pv.fingerprint is null
      or not (pv.fingerprint = any (exclude_fingerprints))
    )
  group by 1
  order by view_count desc;
$$;

grant execute on function public.admin_unique_visitors(timestamptz, text[]) to service_role;
grant execute on function public.admin_page_views_by_referrer(timestamptz, text[], int) to service_role;
grant execute on function public.admin_page_views_by_device(timestamptz, text[]) to service_role;
