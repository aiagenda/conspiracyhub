-- Twitter/X draft batches: cache latest picks + exclude recently used articles.

create table if not exists public.twitter_draft_batches (
  id uuid primary key default gen_random_uuid(),
  picks jsonb not null,
  article_keys text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists twitter_draft_batches_created_idx
  on public.twitter_draft_batches (created_at desc);

alter table public.twitter_draft_batches enable row level security;
create policy "twitter_draft_batches_admin_only"
  on public.twitter_draft_batches for all
  using (false);

comment on table public.twitter_draft_batches is 'Cached GPT tweet draft batches for admin X Drafts tab; article_keys used to avoid repeats.';
