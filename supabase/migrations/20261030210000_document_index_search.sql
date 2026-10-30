-- The document index grew from a hand-curated list of ~500 links into a harvested
-- archive of tens of thousands of individual declassified records. Filtering every
-- row in Node (as loadDocumentIndex did) silently truncated at PostgREST's 1000-row
-- ceiling, so search is moved into Postgres with real ranking and pagination.

alter table public.reference_documents
  add column if not exists doc_id text,
  add column if not exists collection text,
  add column if not exists pdf_url text;

alter table public.reference_documents
  add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('english',
      coalesce(title, '') || ' ' || coalesce(excerpt, '') || ' ' ||
      coalesce(collection, '') || ' ' || coalesce(agency, '') || ' ' || coalesce(doc_id, ''))
  ) stored;

create index if not exists reference_documents_search_idx
  on public.reference_documents using gin (search_vector);
create index if not exists reference_documents_collection_idx
  on public.reference_documents (collection);

-- Ranked search. Returning the total alongside each row avoids a second round trip
-- for the count, which on a GIN scan costs as much as the query itself.
create or replace function public.search_reference_documents(
  p_query text default '',
  p_agency text default '',
  p_limit int default 50,
  p_offset int default 0
)
returns table (
  id uuid,
  agency text,
  title text,
  canonical_url text,
  excerpt text,
  year smallint,
  collection text,
  pdf_url text,
  total bigint
)
language sql
stable
as $$
  with q as (
    select case
      when coalesce(trim(p_query), '') = '' then null
      else websearch_to_tsquery('english', p_query)
    end as ts
  ),
  matched as (
    select d.*
    from public.reference_documents d, q
    where (q.ts is null or d.search_vector @@ q.ts)
      and (coalesce(trim(p_agency), '') = '' or d.agency = upper(trim(p_agency)))
  )
  select m.id, m.agency, m.title, m.canonical_url, m.excerpt, m.year,
         m.collection, m.pdf_url,
         count(*) over () as total
  from matched m, q
  order by
    case when q.ts is null then 0 else ts_rank(m.search_vector, q.ts) end desc,
    m.year desc nulls last,
    m.agency asc,
    m.title asc
  limit greatest(1, least(p_limit, 200))
  offset greatest(0, p_offset);
$$;

-- Agency facet. A distinct scan over the whole table on every page render is the
-- one query that does not scale, so it gets its own aggregate.
create or replace function public.reference_document_agencies()
returns table (agency text, document_count bigint)
language sql
stable
as $$
  select agency, count(*)::bigint
  from public.reference_documents
  where agency is not null and agency <> ''
  group by agency
  order by agency;
$$;

grant execute on function public.search_reference_documents(text, text, int, int) to anon, authenticated, service_role;
grant execute on function public.reference_document_agencies() to anon, authenticated, service_role;

-- The CIA reading room retired this slug; the URL now 404s. The MKULTRA material it
-- pointed at is reachable through the reading room's own full-text search.
delete from public.reference_documents
  where canonical_url = 'https://www.cia.gov/readingroom/collection/behavior-modification';
