-- Optional link from a community thread to a news feed item (one active discussion per article).

alter table threads
  add column if not exists linked_article_id uuid references news_items(id) on delete set null;

comment on column threads.linked_article_id is 'News item this thread discusses; at most one active/featured thread per article.';

-- Only one non-removed thread may claim an article (removed threads keep the FK until cleared).
create unique index if not exists threads_linked_article_unique
  on threads (linked_article_id)
  where linked_article_id is not null and status <> 'removed';
