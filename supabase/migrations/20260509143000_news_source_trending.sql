-- Track ingest origin (guardian, rss feeds, etc.)
alter table news_items add column if not exists source text default 'guardian';

create index if not exists news_items_source_idx on news_items(source);
create index if not exists news_items_score_idx on news_items(score desc);
create index if not exists news_items_published_idx on news_items(published_at desc);

create or replace view trending_news as
  select * from news_items
  where published_at > now() - interval '48 hours'
    and score >= 65
  order by score desc, published_at desc
  limit 20;
