-- AI-generated investigation articles
create table if not exists generated_articles (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  slug text not null unique,
  meta_description text,
  focus_keyword text,
  secondary_keywords text[] default '{}',
  content text not null,
  excerpt text,
  category text not null default 'general',
  tags text[] default '{}',
  sources jsonb default '[]',
  mode text not null default 'news_jacking',   -- 'news_jacking' | 'evergreen'
  status text not null default 'published' check (status in ('draft','published','removed')),
  published_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists generated_articles_slug_idx on generated_articles(slug);
create index if not exists generated_articles_status_idx on generated_articles(status);
create index if not exists generated_articles_published_idx on generated_articles(published_at desc);
create index if not exists generated_articles_category_idx on generated_articles(category);

alter table generated_articles enable row level security;
create policy "Public read published articles" on generated_articles
  for select using (status = 'published');
create policy "Service role full access" on generated_articles
  for all using (true);
