-- Supabase Dashboard → Auth → Delete user fails with "Database error deleting user"
-- when public tables reference auth.users without ON DELETE CASCADE.
-- This migration recreates those FKs with CASCADE so deleting an auth user
-- removes their profile and bets rows first.

alter table public.user_profiles
  drop constraint if exists user_profiles_id_fkey;

alter table public.user_profiles
  add constraint user_profiles_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

alter table public.bets
  drop constraint if exists bets_user_id_fkey;

alter table public.bets
  add constraint bets_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;
