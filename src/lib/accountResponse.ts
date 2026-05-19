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
};

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
  };
}
