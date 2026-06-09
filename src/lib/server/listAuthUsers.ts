import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Fetch all auth users (newest registration first). */
export async function listAllAuthUsers(admin: SupabaseClient): Promise<User[]> {
  const all: User[] = [];
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(error.message);
    const batch = data.users ?? [];
    all.push(...batch);
    if (batch.length < 1000) break;
    page += 1;
  }

  return all.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
