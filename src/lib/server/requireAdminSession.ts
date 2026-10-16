import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Validates Supabase JWT and `user_profiles.is_admin`.
 * Admin UI must send `Authorization: Bearer <access_token>`.
 */
export async function requireAdminSession(
  admin: SupabaseClient,
  req: NextRequest,
): Promise<{ userId: string } | { response: NextResponse }> {
  const auth = req.headers.get("authorization");
  if (!auth || !/^Bearer\s+\S+$/i.test(auth)) {
    return { response: NextResponse.json({ error: "missing_token" }, { status: 401 }) };
  }
  const token = auth.replace(/^Bearer\s+/i, "");
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

/** Authenticate before any service-role reads, writes, paid work, or request parsing. */
export async function requireAdminRequest(req: NextRequest) {
  if (!/^Bearer\s+\S+$/i.test(req.headers.get("authorization") ?? "")) {
    return { response: NextResponse.json({ error: "missing_token" }, { status: 401 }) };
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    return { response: NextResponse.json({ error: "admin_unavailable" }, { status: 503 }) };
  }
  try {
    const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const gate = await requireAdminSession(db, req);
    if ("response" in gate) return gate;
    return { db, userId: gate.userId };
  } catch {
    return { response: NextResponse.json({ error: "auth_unavailable" }, { status: 503 }) };
  }
}
