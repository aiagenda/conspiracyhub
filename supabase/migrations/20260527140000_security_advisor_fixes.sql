-- Supabase Security Advisor: enable RLS on backend-only tables and use security_invoker views.
-- Service role (server routes, cron) bypasses RLS. No anon/authenticated policies = locked via PostgREST.

-- ── Backend tables: RLS on, no public policies ───────────────────────────────
alter table public.scraper_jobs enable row level security;
alter table public.scraper_runs enable row level security;
alter table public.reddit_matches enable row level security;
alter table public.founding_claims enable row level security;

-- ── Views: run as caller (respect underlying table RLS) ──────────────────────
create or replace view public.article_votes
with (security_invoker = true) as
  select
    article_id,
    vote_type,
    count(*)::bigint as vote_count,
    round(avg(value))::bigint as avg_value
  from public.votes
  where article_id is not null
  group by article_id, vote_type;

create or replace view public.generated_article_votes
with (security_invoker = true) as
  select
    generated_article_id,
    vote_type,
    count(*)::bigint as vote_count,
    round(avg(value))::bigint as avg_value
  from public.votes
  where generated_article_id is not null
  group by generated_article_id, vote_type;

create or replace view public.trending_news
with (security_invoker = true) as
  select *
  from public.news_items
  where published_at > now() - interval '48 hours'
    and score >= 65
  order by score desc, published_at desc
  limit 20;
