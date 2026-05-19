/** Billing / trial fields used for PRO access checks. */
export type UserProfilePlanRow = {
  plan: string | null;
  stripe_subscription_id?: string | null;
  subscription_status?: string | null;
  pro_trial_ends_at?: string | null;
  pro_trial_granted_at?: string | null;
  pro_trial_redeemed?: boolean | null;
};

export const PRO_TRIAL_DAYS = 30;
export const PROMO_DISMISS_KEY = "theorist_analyst_pass_dismissed_until";

const PAID_STRIPE_STATUSES = new Set(["active", "trialing", "past_due"]);

export function trialEndsAtFromNow(days = PRO_TRIAL_DAYS): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

/** True when user should get Oracle, highlights PRO tier, etc. */
export function isEffectivePro(profile: UserProfilePlanRow | null | undefined): boolean {
  if (!profile || profile.plan !== "pro") return false;

  const subId = profile.stripe_subscription_id?.trim();
  const status = (profile.subscription_status ?? "").toLowerCase();
  if (subId && PAID_STRIPE_STATUSES.has(status)) return true;

  const trialEnd = profile.pro_trial_ends_at;
  if (trialEnd) {
    const t = new Date(trialEnd).getTime();
    if (!Number.isNaN(t) && t > Date.now()) return true;
    return false;
  }

  // Manual admin PRO (no trial window, no Stripe row yet)
  if (!subId) return true;

  return false;
}

export function proTrialDaysLeft(endsAt: string | null | undefined): number | null {
  if (!endsAt) return null;
  const t = new Date(endsAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function buildSignupTrialPatch(now = new Date()) {
  const ends = new Date(now);
  ends.setUTCDate(ends.getUTCDate() + PRO_TRIAL_DAYS);
  return {
    plan: "pro" as const,
    pro_trial_ends_at: ends.toISOString(),
    pro_trial_granted_at: now.toISOString(),
    pro_trial_redeemed: true,
    subscription_status: "trial",
  };
}

export function canClaimLegacyTrial(profile: UserProfilePlanRow | null | undefined): boolean {
  if (!profile) return true;
  if (profile.pro_trial_redeemed) return false;
  if (profile.stripe_subscription_id) return false;
  if (isEffectivePro(profile)) return false;
  return true;
}

export function isPromoDismissed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(PROMO_DISMISS_KEY);
    if (!raw) return false;
    const until = parseInt(raw, 10);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

export function dismissPromoForDays(days = 7) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROMO_DISMISS_KEY, String(Date.now() + days * 24 * 60 * 60 * 1000));
  } catch {
    /* ignore */
  }
}
