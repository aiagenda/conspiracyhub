import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase";

export function signInWithEmail(email: string, password: string) {
  return getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
}

/** Browser autofill often skips React onChange — read controlled inputs from the DOM before submit. */
export function readAuthFieldValues(
  emailInput: HTMLInputElement | null,
  passwordInput: HTMLInputElement | null,
  stateEmail: string,
  statePassword: string,
): { email: string; password: string } {
  const email = (stateEmail.trim() || emailInput?.value.trim() || "").trim();
  const password = statePassword || passwordInput?.value || "";
  return { email, password };
}

/** After signInWithPassword, the session cookie can lag behind onAuthStateChange by a tick. */
export async function waitForSupabaseSession(maxMs = 3000): Promise<boolean> {
  const client = getSupabaseBrowserClient();
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const {
      data: { session },
    } = await client.auth.getSession();
    if (session?.access_token) return true;
    await new Promise((r) => setTimeout(r, 80));
  }
  return false;
}

export function signUpWithEmail(
  email: string,
  password: string,
  profile?: { nickname?: string }
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

export function resetPasswordForEmail(email: string) {
  const client = getSupabaseBrowserClient();
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? null);
  return client.auth.resetPasswordForEmail(email.trim(), {
    ...(origin ? { redirectTo: `${origin}/auth/reset-password` } : {}),
  });
}

export function updatePassword(password: string) {
  return getSupabaseBrowserClient().auth.updateUser({ password });
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
