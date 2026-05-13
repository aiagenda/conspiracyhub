-- Enable Supabase Realtime for thread_posts (live article chat).
-- Safe if already added (e.g. manual dashboard change).
do $migration$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'thread_posts'
  ) then
    alter publication supabase_realtime add table public.thread_posts;
  end if;
end;
$migration$;
