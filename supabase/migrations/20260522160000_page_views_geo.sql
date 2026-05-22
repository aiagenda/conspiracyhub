-- Geo fields on page_views (from Vercel edge headers at /api/track insert time).
alter table public.page_views
  add column if not exists country_code char(2),
  add column if not exists region text;

create index if not exists page_views_country_created_idx
  on public.page_views (country_code, created_at desc);

comment on column public.page_views.country_code is 'ISO 3166-1 alpha-2 from x-vercel-ip-country (or null if unknown / pre-migration).';
comment on column public.page_views.region is 'Region from x-vercel-ip-country-region when available.';

-- Admin aggregate: views + unique viewers by country since a timestamp.
create or replace function public.admin_page_views_by_country(
  since_at timestamptz,
  exclude_fingerprints text[] default null
)
returns table(country_code text, view_count bigint, unique_viewers bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    coalesce(nullif(trim(pv.country_code::text), ''), 'XX')::text as country_code,
    count(*)::bigint as view_count,
    count(distinct coalesce(nullif(trim(pv.fingerprint), ''), '(row-' || pv.id::text || ')'))::bigint as unique_viewers
  from public.page_views pv
  where pv.created_at >= since_at
    and (
      exclude_fingerprints is null
      or cardinality(exclude_fingerprints) = 0
      or pv.fingerprint is null
      or not (pv.fingerprint = any(exclude_fingerprints))
    )
  group by coalesce(nullif(trim(pv.country_code::text), ''), 'XX')
  order by view_count desc;
$$;

comment on function public.admin_page_views_by_country(timestamptz, text[]) is
  'Page views grouped by country_code since timestamp; XX = unknown; optional fingerprint exclusion.';

grant execute on function public.admin_page_views_by_country(timestamptz, text[]) to service_role;
