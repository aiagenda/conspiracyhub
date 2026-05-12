import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
  );
}

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
}

// GET — list all users with plan info + email
export async function GET(req: NextRequest) {
  try {
    const db = admin();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = 50;
    const from = (page - 1) * limit;
    const planFilter = searchParams.get("plan"); // "pro" | "free" | null

    // 1. Pull user_profiles (paginated)
    let profileQuery = db
      .from("user_profiles")
      .select(
        "id, plan, subscription_status, subscription_current_period_end, stripe_customer_id, stripe_subscription_id, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, from + limit - 1);

    if (planFilter === "pro" || planFilter === "free") {
      profileQuery = profileQuery.eq("plan", planFilter);
    }

    const { data: profiles, count, error: profErr } = await profileQuery;
    if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 });

    const ids = (profiles ?? []).map((p) => p.id);

    // 2. Pull auth.users for emails (admin API)
    const { data: authData, error: authErr } = await db.auth.admin.listUsers({ perPage: 1000 });
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 });

    const emailMap: Record<string, { email: string; last_sign_in_at: string | null }> = {};
    for (const u of authData.users ?? []) {
      emailMap[u.id] = { email: u.email ?? "", last_sign_in_at: u.last_sign_in_at ?? null };
    }

    // 3. Oracle analysis count per user (rough proxy for engagement)
    const { data: oracleCounts } = await db
      .from("oracle_analyses")
      .select("id")
      .in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    // Note: oracle_analyses doesn't have user_id, so we just mark 0 for now
    // This can be improved when user_id tracking is added to oracle_analyses

    const users: AdminUser[] = (profiles ?? []).map((p) => ({
      id: p.id,
      email: emailMap[p.id]?.email ?? "(no email)",
      plan: p.plan ?? "free",
      subscription_status: p.subscription_status ?? null,
      subscription_current_period_end: p.subscription_current_period_end ?? null,
      stripe_customer_id: p.stripe_customer_id ?? null,
      stripe_subscription_id: p.stripe_subscription_id ?? null,
      created_at: p.created_at,
      last_sign_in_at: emailMap[p.id]?.last_sign_in_at ?? null,
      oracle_count: 0,
    }));

    // 4. Revenue summary
    const proCount = users.filter((u) => u.plan === "pro").length;
    // Also get total pro count from DB for accurate MRR
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
      total: count ?? 0,
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
    const patch: Record<string, unknown> = { plan };
    if (plan === "free") {
      patch.subscription_status = "canceled";
      patch.stripe_subscription_id = null;
    }
    const { error } = await db.from("user_profiles").update(patch).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, note: note ?? null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
