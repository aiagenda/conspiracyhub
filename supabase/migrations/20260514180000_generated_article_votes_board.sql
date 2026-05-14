-- Generated investigation articles: votes, Oracle cache, community threads (parity with news_items).

-- ── VOTES: optional generated_article_id (mutually exclusive with article_id / thread_id) ──
alter table votes add column if not exists generated_article_id uuid references generated_articles(id) on delete cascade;

alter table votes drop constraint if exists votes_one_target;

alter table votes add constraint votes_one_target check (
  (case when article_id is not null then 1 else 0 end)
  + (case when thread_id is not null then 1 else 0 end)
  + (case when generated_article_id is not null then 1 else 0 end)
  = 1
);

create unique index if not exists votes_generated_article_fingerprint_type_idx
  on votes (generated_article_id, fingerprint, vote_type)
  where generated_article_id is not null;

-- Aggregates for VotePanel (mirror article_votes)
create or replace view generated_article_votes as
select
  generated_article_id,
  vote_type,
  count(*)::bigint as vote_count,
  round(avg(value))::bigint as avg_value
from votes
where generated_article_id is not null
group by generated_article_id, vote_type;

-- ── ORACLE: cache analyses for generated articles ──
alter table oracle_analyses add column if not exists generated_article_id uuid references generated_articles(id) on delete cascade;

alter table oracle_analyses drop constraint if exists oracle_analyses_one_subject;

alter table oracle_analyses add constraint oracle_analyses_one_subject check (
  (news_id is not null and generated_article_id is null)
  or (news_id is null and generated_article_id is not null)
);

create index if not exists oracle_analyses_generated_article_id_idx
  on oracle_analyses (generated_article_id, created_at desc);

-- ── THREADS: link discussion to a generated article ──
alter table threads add column if not exists linked_generated_article_id uuid references generated_articles(id) on delete set null;

create unique index if not exists threads_linked_generated_article_unique
  on threads (linked_generated_article_id)
  where linked_generated_article_id is not null and status <> 'removed';
