import type { SupabaseClient } from "@supabase/supabase-js";
import { isEffectivePro, type UserProfilePlanRow } from "@/lib/userPlan";
import { PROFILE_PLAN_SELECT } from "@/lib/server/proTrial";

export async function getProfilePlanRow(
  admin: SupabaseClient,
  userId: string,
): Promise<UserProfilePlanRow | null> {
  const { data, error } = await admin
    .from("user_profiles")
    .select(PROFILE_PLAN_SELECT)
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return data as UserProfilePlanRow;
}

export async function userHasEffectivePro(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const row = await getProfilePlanRow(admin, userId);
  return isEffectivePro(row);
}
