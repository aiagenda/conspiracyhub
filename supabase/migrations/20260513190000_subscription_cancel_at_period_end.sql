-- Stripe: cancel at period end — sync to UI (subscription stays "active" until period ends)
alter table public.user_profiles
  add column if not exists subscription_cancel_at_period_end boolean not null default false;

comment on column public.user_profiles.subscription_cancel_at_period_end is 'True when Stripe subscription.cancel_at_period_end is set; PRO UI shows end date instead of renewal.';
