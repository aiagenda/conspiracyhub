-- Admin article/blog analytics: total hits + distinct viewers (fingerprint) per path.
-- PG forbids changing RETURNS TABLE columns via CREATE OR REPLACE; drop first.
drop function if exists public.admin_page_view_counts(text[], text[]);

create function public.admin_page_view_counts(
  request_paths text[],
  exclude_fingerprints text[] default null
)
returns table(path text, view_count bigint, unique_viewers bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    pv.path::text,
    count(*)::bigint as view_count,
    count(distinct coalesce(nullif(trim(pv.fingerprint), ''), '(row-' || pv.id::text || ')'))::bigint as unique_viewers
  from public.page_views pv
  where pv.path = any(request_paths)
    and (
      exclude_fingerprints is null
      or cardinality(exclude_fingerprints) = 0
      or pv.fingerprint is null
      or not (pv.fingerprint = any(exclude_fingerprints))
    )
  group by pv.path;
$$;

comment on function public.admin_page_view_counts(text[], text[]) is 'Per-path page view totals + distinct fingerprints (readers) for admin; optional fingerprint exclusion (ANALYTICS_EXCLUDE_*).';

grant execute on function public.admin_page_view_counts(text[], text[]) to service_role;
