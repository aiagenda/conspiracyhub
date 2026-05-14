-- Oracle re-run + /api/admin/oracle-rerun: require user_profiles.is_admin = true.
--
-- Default: grant admin to the FIRST profile row (by created_at) — usually the site owner on a fresh project.
-- If the wrong user becomes admin, run in Dashboard SQL (once) to fix, or edit this migration before push:
--
--   update public.user_profiles set is_admin = false;
--   update public.user_profiles set is_admin = true
--   where lower(trim(email)) = lower(trim('you@example.com'));

update public.user_profiles
set is_admin = true
where id = (
  select id
  from public.user_profiles
  order by created_at asc
  limit 1
)
and coalesce(is_admin, false) is distinct from true;
