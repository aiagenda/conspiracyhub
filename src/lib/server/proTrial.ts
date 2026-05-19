import type { SupabaseClient } from "@supabase/supabase-js";
import { buildSignupTrialPatch, type UserProfilePlanRow } from "@/lib/userPlan";

export const PROFILE_PLAN_SELECT =
  "plan, stripe_subscription_id, subscription_status, pro_trial_ends_at, pro_trial_granted_at, pro_trial_redeemed";

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

export function trialGrantForNewProfile(): ReturnType<typeof buildSignupTrialPatch> {
  return buildSignupTrialPatch();
}

export function mergeTrialIntoInsert(
  base: Record<string, unknown>,
): Record<string, unknown> {
  return { ...base, ...buildSignupTrialPatch() };
}

export type { UserProfilePlanRow };
