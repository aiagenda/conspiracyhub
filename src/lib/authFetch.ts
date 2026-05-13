import { getSupabaseBrowserClient } from "@/lib/supabase";

/** Attaches `Authorization: Bearer <access_token>` when a Supabase session exists. */
export async function fetchWithSupabaseAuth(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers = new Headers(init?.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return fetch(input, { ...init, headers });
}
