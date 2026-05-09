-- Composite index to support the new feed query:
-- .gte("published_at", cutoff).order("score", desc).order("published_at", desc)
create index if not exists news_items_published_score_idx
  on news_items (published_at desc, score desc);
