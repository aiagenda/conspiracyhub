-- First 100 registrants: 90-day Analyst Pass (atomic slot claim). No public counter UI.

create table if not exists public.founding_claims (
  slot smallint primary key check (slot between 1 and 100),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  claimed_at timestamptz not null default now()
);

alter table public.user_profiles
  add column if not exists founding_member boolean not null default false,
  add column if not exists founding_slot smallint;

create unique index if not exists user_profiles_founding_slot_uidx
  on public.user_profiles (founding_slot)
  where founding_slot is not null;

alter table public.user_profiles
  drop constraint if exists user_profiles_founding_slot_check;

alter table public.user_profiles
  add constraint user_profiles_founding_slot_check
  check (founding_slot is null or (founding_slot >= 1 and founding_slot <= 100));

comment on column public.user_profiles.founding_member is 'True when user claimed one of the first 100 founding operative slots (90-day trial).';
comment on column public.user_profiles.founding_slot is 'Founding slot 1–100; internal, not shown as a public counter.';

-- Atomically assign lowest free slot 1..100, idempotent per user.
create or replace function public.claim_founding_operative(p_user_id uuid)
returns table(is_founding boolean, slot smallint, trial_days integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot smallint;
begin
  select fc.slot into v_slot
  from public.founding_claims fc
  where fc.user_id = p_user_id;

  if found then
    return query select true, v_slot, 90;
    return;
  end if;

  insert into public.founding_claims (slot, user_id)
  select gs, p_user_id
  from generate_series(1, 100) as gs
  where not exists (
    select 1 from public.founding_claims fc where fc.slot = gs
  )
  order by gs
  limit 1
  returning founding_claims.slot into v_slot;

  if v_slot is not null then
    return query select true, v_slot, 90;
  else
    return query select false, null::smallint, 30;
  end if;
end;
$$;

grant execute on function public.claim_founding_operative(uuid) to service_role;
