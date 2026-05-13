import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase";

export function signInWithEmail(email: string, password: string) {
  return getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
}

export function signUpWithEmail(
  email: string,
  password: string,
  profile?: { nickname: string }
) {
  const client = getSupabaseBrowserClient();
  // Without emailRedirectTo, Supabase uses Dashboard "Site URL" in the confirm link (often still localhost).
  const origin = typeof window !== "undefined" ? window.location.origin : null;
  const nick = profile?.nickname?.trim() ?? "";
  return client.auth.signUp({
    email,
    password,
    options: {
      ...(origin ? { emailRedirectTo: `${origin}/account` } : {}),
      ...(nick.length >= 2 ? { data: { nickname: nick } } : {}),
    },
  });
}

export function signOut() {
  if (!isSupabaseBrowserConfigured()) return Promise.resolve();
  return getSupabaseBrowserClient().auth.signOut();
}

export async function getCurrentUser() {
  if (!isSupabaseBrowserConfigured()) return null;
  try {
    const {
      data: { user },
    } = await getSupabaseBrowserClient().auth.getUser();
    return user;
  } catch {
    return null;
  }
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
