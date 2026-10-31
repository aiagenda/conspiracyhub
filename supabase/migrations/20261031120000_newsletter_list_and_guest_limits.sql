-- A real mailing list, and the rate limiting that replaces the sign-in wall.
--
-- Newsletter signups used to be parked in `contact_messages` next to support mail,
-- with no confirmation and no way to unsubscribe — not a list you can legally send
-- to. They get their own table, double opt-in, and a permanent unsubscribe token.
--
-- The research tools no longer ask for an account, so the account was also what
-- stopped one visitor from spending the OpenAI budget. `rate_limit_events` takes
-- over: one row per chargeable action, counted per hashed IP over a window.

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  ip_hash text,
  -- Doubles as the unsubscribe token: it stays valid after confirmation so every
  -- sent email can carry a working one-click opt-out.
  token text not null unique,
  confirmed_at timestamptz,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

-- The only query the sender runs: who is currently subscribed.
create index if not exists newsletter_subscribers_active_idx
  on public.newsletter_subscribers (confirmed_at)
  where confirmed_at is not null and unsubscribed_at is null;

create table if not exists public.rate_limit_events (
  id bigserial primary key,
  bucket text not null,
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists rate_limit_events_lookup_idx
  on public.rate_limit_events (bucket, ip_hash, created_at desc);

-- Both tables are written only by the service role on the server; RLS with no
-- policy means anon and authenticated cannot read a subscriber list or probe it.
alter table public.newsletter_subscribers enable row level security;
alter table public.rate_limit_events enable row level security;

grant select, insert, update, delete on public.newsletter_subscribers to service_role;
grant select, insert, delete on public.rate_limit_events to service_role;
grant usage, select on sequence public.rate_limit_events_id_seq to service_role;
