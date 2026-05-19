-- 30-day Analyst Pass (signup trial) — no Stripe required
alter table public.user_profiles
  add column if not exists pro_trial_ends_at timestamptz,
  add column if not exists pro_trial_granted_at timestamptz,
  add column if not exists pro_trial_redeemed boolean not null default false;

comment on column public.user_profiles.pro_trial_ends_at is 'When signup/claimed PRO trial access ends (UTC).';
comment on column public.user_profiles.pro_trial_granted_at is 'When the trial was granted.';
comment on column public.user_profiles.pro_trial_redeemed is 'True once user received a signup/claim trial (one per account).';

create index if not exists user_profiles_pro_trial_ends_idx
  on public.user_profiles (pro_trial_ends_at)
  where pro_trial_ends_at is not null and plan = 'pro';
