-- SEO rewrite body for high-priority feed articles (scrape → GPT rewrite → /article/[id]).

alter table public.news_items
  add column if not exists body_html text,
  add column if not exists seo_description text,
  add column if not exists rewrite_status text not null default 'pending'
    check (rewrite_status in ('pending', 'ready', 'failed', 'skipped'));

create index if not exists news_items_rewrite_status_idx
  on public.news_items (rewrite_status, score desc)
  where rewrite_status in ('pending', 'failed');

comment on column public.news_items.body_html is 'GPT SEO rewrite (markdown) shown on /article/[id]; live fetch is fallback.';
comment on column public.news_items.rewrite_status is 'pending=awaiting rewrite, ready=body_html set, failed=error, skipped=insufficient source text';
