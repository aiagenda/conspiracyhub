import {
  canClaimLegacyTrial,
  isEffectivePro,
  proTrialDaysLeft,
  type UserProfilePlanRow,
} from "@/lib/userPlan";

export type AccountProfileRow = UserProfilePlanRow & {
  email: string;
  nickname?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  subscription_current_period_end?: string | null;
  subscription_cancel_at_period_end?: boolean | null;
  created_at?: string | null;
  email_weekly_briefing?: boolean | null;
  email_high_threat_alerts?: boolean | null;
  founding_member?: boolean | null;
  founding_slot?: number | null;
};

function analystPassTrialDaysGranted(profile: AccountProfileRow): number | null {
  const g = profile.pro_trial_granted_at ? Date.parse(profile.pro_trial_granted_at) : NaN;
  const e = profile.pro_trial_ends_at ? Date.parse(profile.pro_trial_ends_at) : NaN;
  if (Number.isNaN(g) || Number.isNaN(e) || e <= g) return null;
  return Math.max(1, Math.round((e - g) / (24 * 60 * 60 * 1000)));
}

export function toAccountJson(profile: AccountProfileRow) {
  const effective = isEffectivePro(profile);
  const trialDays = proTrialDaysLeft(profile.pro_trial_ends_at ?? null);
  const onTrial =
    effective &&
    profile.subscription_status === "trial" &&
    Boolean(profile.pro_trial_ends_at);

  return {
    email: profile.email,
    nickname: profile.nickname ?? null,
    plan: profile.plan,
    effective_pro: effective,
    effective_plan: effective ? "pro" : "free",
    pro_trial_ends_at: profile.pro_trial_ends_at ?? null,
    pro_trial_days_left: trialDays,
    on_analyst_pass_trial: onTrial,
    can_claim_trial: canClaimLegacyTrial(profile),
    subscription_status: profile.subscription_status ?? null,
    current_period_end: profile.subscription_current_period_end ?? null,
    billing_portal_available: Boolean(profile.stripe_customer_id),
    stripe_subscription_id: profile.stripe_subscription_id ?? null,
    subscription_cancel_at_period_end: Boolean(profile.subscription_cancel_at_period_end),
    member_since: profile.created_at ?? null,
    email_weekly_briefing: profile.email_weekly_briefing !== false,
    email_high_threat_alerts: profile.email_high_threat_alerts !== false,
    founding_member: Boolean(profile.founding_member),
    analyst_pass_trial_days: analystPassTrialDaysGranted(profile),
  };
}
