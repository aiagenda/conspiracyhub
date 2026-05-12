-- Billing / subscription fields for account page (Stripe sync via webhook)
alter table public.user_profiles
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists subscription_status text;

comment on column public.user_profiles.subscription_current_period_end is 'End of current Stripe billing period (UTC), from subscription.current_period_end';
comment on column public.user_profiles.subscription_status is 'Stripe subscription.status e.g. active, past_due, canceled';

-- Profile row for new users: created on first GET /api/account (Bearer) if missing.
-- Optional: add auth.users trigger in Supabase Dashboard to insert on signup for email/Stripe matching.
