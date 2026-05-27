import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildSignupTrialPatch,
  FOUNDING_TRIAL_DAYS,
  STANDARD_TRIAL_DAYS,
  type UserProfilePlanRow,
} from "@/lib/userPlan";

export const PROFILE_PLAN_SELECT =
  "plan, stripe_subscription_id, subscription_status, pro_trial_ends_at, pro_trial_granted_at, pro_trial_redeemed";

type FoundingClaimRow = {
  is_founding: boolean;
  slot: number | null;
  trial_days: number;
};

/** Expire DB trials where period ended and user has no paid Stripe sub. */
export async function expireExpiredProTrials(
  admin: SupabaseClient,
): Promise<{ expired: number }> {
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("user_profiles")
    .select("id")
    .eq("plan", "pro")
    .eq("subscription_status", "trial")
    .lt("pro_trial_ends_at", nowIso)
    .is("stripe_subscription_id", null);

  if (error) throw new Error(error.message);
  if (!rows?.length) return { expired: 0 };

  let expired = 0;
  for (const row of rows) {
    const { error: upErr } = await admin
      .from("user_profiles")
      .update({
        plan: "free",
        subscription_status: null,
        pro_trial_ends_at: null,
      })
      .eq("id", row.id);
    if (!upErr) expired++;
  }
  return { expired };
}

/** First 100 users get 90-day trial via DB RPC; everyone else 30 days. */
export async function resolveSignupTrial(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.rpc("claim_founding_operative", { p_user_id: userId });
  if (error) {
    console.warn("[proTrial] claim_founding_operative failed, using standard trial:", error.message);
    const now = new Date();
    return {
      patch: buildSignupTrialPatch(now, STANDARD_TRIAL_DAYS),
      founding_member: false,
      founding_slot: null as number | null,
      trial_days: STANDARD_TRIAL_DAYS,
    };
  }

  const row = (Array.isArray(data) ? data[0] : data) as FoundingClaimRow | null | undefined;
  const trialDays =
    row?.trial_days === FOUNDING_TRIAL_DAYS || row?.trial_days === STANDARD_TRIAL_DAYS
      ? row.trial_days
      : row?.is_founding
        ? FOUNDING_TRIAL_DAYS
        : STANDARD_TRIAL_DAYS;
  const now = new Date();

  return {
    patch: buildSignupTrialPatch(now, trialDays),
    founding_member: Boolean(row?.is_founding),
    founding_slot: typeof row?.slot === "number" ? row.slot : null,
    trial_days: trialDays,
  };
}

export async function buildNewProfileInsert(
  admin: SupabaseClient,
  userId: string,
  base: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const trial = await resolveSignupTrial(admin, userId);
  return {
    ...base,
    ...trial.patch,
    founding_member: trial.founding_member,
    ...(trial.founding_slot != null ? { founding_slot: trial.founding_slot } : {}),
  };
}

export function trialGrantForNewProfile(): ReturnType<typeof buildSignupTrialPatch> {
  return buildSignupTrialPatch();
}

/** @deprecated Use buildNewProfileInsert for new accounts. */
export function mergeTrialIntoInsert(base: Record<string, unknown>): Record<string, unknown> {
  return { ...base, ...buildSignupTrialPatch() };
}

export type { UserProfilePlanRow };
