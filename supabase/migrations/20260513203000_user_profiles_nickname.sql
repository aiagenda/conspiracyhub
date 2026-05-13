-- Public display name collected at signup; editable on /account.
alter table public.user_profiles
  add column if not exists nickname text;

comment on column public.user_profiles.nickname is 'Display nickname (2–40 chars), optional for legacy rows; synced from auth metadata on first profile insert.';
