-- Community threads + posts + votes + article vote aggregates

-- ── THREADS (before votes.thread_id FK) ─────────────────────
create table if not exists threads (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  body text not null,
  author_name text not null default 'Anonymous',
  author_fingerprint text not null,
  status text not null default 'active' check (status in ('active','featured','removed')),
  category text not null default 'sighting' check (category in ('sighting','document','theory','question','tip')),
  location text,
  tags text[] default '{}',
  upvotes integer not null default 0,
  credibility_score integer not null default 50,
  oracle_analyzed boolean not null default false,
  post_count integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists thread_posts (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references threads(id) on delete cascade not null,
  author_name text not null default 'Anonymous',
  author_fingerprint text not null,
  author_type text not null default 'human' check (author_type in ('human','oracle','system')),
  content text not null,
  attachment_url text,
  upvotes integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists thread_votes (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references threads(id) on delete cascade,
  post_id uuid references thread_posts(id) on delete cascade,
  fingerprint text not null,
  vote_type text not null default 'up',
  created_at timestamptz default now()
);

create unique index if not exists thread_votes_thread_fingerprint_type_idx
  on thread_votes (thread_id, fingerprint, vote_type)
  where thread_id is not null;

create unique index if not exists thread_votes_post_fingerprint_type_idx
  on thread_votes (post_id, fingerprint, vote_type)
  where post_id is not null;

-- ── ARTICLE / THREAD VOTES ────────────────────────────────────
create table if not exists votes (
  id uuid default gen_random_uuid() primary key,
  article_id uuid references news_items(id) on delete cascade,
  thread_id uuid references threads(id) on delete cascade,
  fingerprint text not null,
  vote_type text not null,
  value integer not null default 1,
  created_at timestamptz default now(),
  constraint votes_one_target check (
    (article_id is not null and thread_id is null)
    or (article_id is null and thread_id is not null)
  )
);

create unique index if not exists votes_article_fingerprint_type_idx
  on votes (article_id, fingerprint, vote_type)
  where article_id is not null;

create unique index if not exists votes_thread_fingerprint_type_idx
  on votes (thread_id, fingerprint, vote_type)
  where thread_id is not null;

create or replace view article_votes as
  select
    article_id,
    vote_type,
    count(*)::bigint as vote_count,
    round(avg(value))::bigint as avg_value
  from votes
  where article_id is not null
  group by article_id, vote_type;

alter table votes enable row level security;
drop policy if exists "Anyone can vote" on votes;
drop policy if exists "Anyone can read votes" on votes;
create policy "Anyone can vote" on votes for insert with check (true);
create policy "Anyone can read votes" on votes for select using (true);

-- ── THREAD STATS TRIGGER ─────────────────────────────────────
create or replace function update_thread_stats()
returns trigger
language plpgsql
as $$
begin
  update threads set
    post_count = (select count(*) from thread_posts where thread_id = coalesce(NEW.thread_id, OLD.thread_id)),
    updated_at = now()
  where id = coalesce(NEW.thread_id, OLD.thread_id);
  return coalesce(NEW, OLD);
end;
$$;

drop trigger if exists thread_post_stats on thread_posts;
create trigger thread_post_stats
  after insert or delete on thread_posts
  for each row execute procedure update_thread_stats();

-- RLS
alter table threads enable row level security;
alter table thread_posts enable row level security;
alter table thread_votes enable row level security;

drop policy if exists "Anyone can read threads" on threads;
drop policy if exists "Anyone can create threads" on threads;
drop policy if exists "Anyone can read posts" on thread_posts;
drop policy if exists "Anyone can create posts" on thread_posts;
drop policy if exists "Anyone can vote threads" on thread_votes;
drop policy if exists "Anyone can read thread votes" on thread_votes;

create policy "Anyone can read threads" on threads for select using (status != 'removed');
create policy "Anyone can create threads" on threads for insert with check (true);
create policy "Anyone can read posts" on thread_posts for select using (true);
create policy "Anyone can create posts" on thread_posts for insert with check (true);
create policy "Anyone can vote threads" on thread_votes for insert with check (true);
create policy "Anyone can read thread votes" on thread_votes for select using (true);
