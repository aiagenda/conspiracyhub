import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Validates Supabase JWT and `user_profiles.is_admin`.
 * Admin UI must send `Authorization: Bearer <access_token>`.
 */
export async function requireAdminSession(
  admin: SupabaseClient,
  req: NextRequest,
): Promise<{ userId: string } | { response: NextResponse }> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return { response: NextResponse.json({ error: "missing_token" }, { status: 401 }) };
  }
  const token = auth.replace("Bearer ", "");
  const {
    data: { user },
    error: userErr,
  } = await admin.auth.getUser(token);
  if (userErr || !user) {
    return { response: NextResponse.json({ error: "invalid_token" }, { status: 401 }) };
  }
  const { data: profile, error: profErr } = await admin
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (profErr || !profile?.is_admin) {
    return { response: NextResponse.json({ error: "admin_only" }, { status: 403 }) };
  }
  return { userId: user.id };
}
