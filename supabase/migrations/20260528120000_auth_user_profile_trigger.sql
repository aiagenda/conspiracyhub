-- Create user_profiles on signup so admin + billing see new users immediately.
-- Signup trial (founding slot / 30-day pass) is still applied on first GET /api/account.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (id, email, plan)
  values (new.id, coalesce(new.email, ''), 'free')
  on conflict (id) do update
    set email = excluded.email
    where public.user_profiles.email is distinct from excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill auth users missing a profile (e.g. registered before this trigger).
insert into public.user_profiles (id, email, plan)
select u.id, coalesce(u.email, ''), 'free'
from auth.users u
where not exists (
  select 1 from public.user_profiles p where p.id = u.id
)
on conflict (id) do nothing;
