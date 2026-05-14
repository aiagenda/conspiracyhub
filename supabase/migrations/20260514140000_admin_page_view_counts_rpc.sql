-- Grouped page view counts for admin (no 1000-row client limit on aggregates).
create or replace function public.admin_page_view_counts(
  request_paths text[],
  exclude_fingerprints text[] default null
)
returns table(path text, view_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select pv.path::text, count(*)::bigint
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

comment on function public.admin_page_view_counts(text[], text[]) is 'Per-path page view totals for admin; optional fingerprint exclusion (same semantics as app env ANALYTICS_EXCLUDE_*).';

grant execute on function public.admin_page_view_counts(text[], text[]) to service_role;
