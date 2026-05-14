-- Reset page view aggregates (admin traffic / fresh analytics baseline).
truncate table public.page_views restart identity;
