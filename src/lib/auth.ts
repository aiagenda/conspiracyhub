import { getSupabaseBrowserClient } from "@/lib/supabase";

export function signInWithEmail(email: string, password: string) {
  return getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
}

export function signUpWithEmail(email: string, password: string) {
  return getSupabaseBrowserClient().auth.signUp({ email, password });
}

export function signOut() {
  return getSupabaseBrowserClient().auth.signOut();
}

export async function getCurrentUser() {
  const {
    data: { user },
  } = await getSupabaseBrowserClient().auth.getUser();
  return user;
}

export async function getUserPlan() {
  const user = await getCurrentUser();
  if (!user) return "free";
  const { data } = await getSupabaseBrowserClient()
    .from("user_profiles")
    .select("plan")
    .eq("id", user.id)
    .single();
  return data?.plan ?? "free";
}
