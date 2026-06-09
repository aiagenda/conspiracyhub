import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { listAllAuthUsers } from "@/lib/server/listAuthUsers";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

type ProfileRow = {
  id: string;
  plan: "free" | "pro" | null;
  subscription_status: string | null;
  subscription_current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string | null;
};

export interface AdminUser {
  id: string;
  email: string;
  plan: "free" | "pro";
  subscription_status: string | null;
  subscription_current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  oracle_count: number;
  profile_pending: boolean;
}

async function loadProfilesByIds(db: ReturnType<typeof admin>, ids: string[]) {
  if (!ids.length) return [] as ProfileRow[];

  const rows: ProfileRow[] = [];
  const chunkSize = 200;
  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const { data, error } = await db
      .from("user_profiles")
      .select(
        "id, plan, subscription_status, subscription_current_period_end, stripe_customer_id, stripe_subscription_id, created_at",
      )
      .in("id", chunk);
    if (error) throw new Error(error.message);
    rows.push(...((data ?? []) as ProfileRow[]));
  }
  return rows;
}

// GET — list registered auth users merged with plan/profile data
export async function GET(req: NextRequest) {
  try {
    const db = admin();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = 50;
    const from = (page - 1) * limit;
    const planFilter = searchParams.get("plan"); // "pro" | "free" | null

    const authUsers = await listAllAuthUsers(db);
    const profiles = await loadProfilesByIds(
      db,
      authUsers.map((u) => u.id),
    );
    const profileMap = new Map(profiles.map((p) => [p.id, p]));

    let merged: AdminUser[] = authUsers.map((u) => {
      const profile = profileMap.get(u.id);
      const plan = profile?.plan === "pro" ? "pro" : "free";
      return {
        id: u.id,
        email: u.email ?? "",
        plan,
        subscription_status: profile?.subscription_status ?? null,
        subscription_current_period_end: profile?.subscription_current_period_end ?? null,
        stripe_customer_id: profile?.stripe_customer_id ?? null,
        stripe_subscription_id: profile?.stripe_subscription_id ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        oracle_count: 0,
        profile_pending: !profile,
      };
    });

    if (planFilter === "pro" || planFilter === "free") {
      merged = merged.filter((u) => u.plan === planFilter);
    }

    const users = merged.slice(from, from + limit);

    const { count: totalProCount } = await db
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("plan", "pro");
    const { count: totalFreeCount } = await db
      .from("user_profiles")
      .select("id", { count: "exact", head: true })
      .eq("plan", "free");

    return NextResponse.json({
      users,
      total: merged.length,
      page,
      summary: {
        totalPro: totalProCount ?? 0,
        totalFree: totalFreeCount ?? 0,
        mrr: (totalProCount ?? 0) * 7,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

// PATCH — change plan for a user (manual override)
export async function PATCH(req: NextRequest) {
  try {
    const db = admin();
    const { id, plan, note } = (await req.json()) as { id: string; plan: string; note?: string };
    if (!id || !["free", "pro"].includes(plan)) {
      return NextResponse.json({ error: "id and plan (free|pro) required" }, { status: 400 });
    }

    const { data: authUser, error: authErr } = await db.auth.admin.getUserById(id);
    if (authErr || !authUser.user) {
      return NextResponse.json({ error: authErr?.message ?? "user_not_found" }, { status: 404 });
    }

    const patch: Record<string, unknown> = { plan };
    if (plan === "free") {
      patch.subscription_status = "canceled";
      patch.stripe_subscription_id = null;
    }

    const { data: existing } = await db.from("user_profiles").select("id").eq("id", id).maybeSingle();
    if (!existing) {
      const { error: insErr } = await db.from("user_profiles").insert({
        id,
        email: authUser.user.email ?? "",
        ...patch,
      });
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    } else {
      const { error } = await db.from("user_profiles").update(patch).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, note: note ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
