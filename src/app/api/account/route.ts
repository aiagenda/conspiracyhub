import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

/** Profile + billing summary for the signed-in user (Bearer JWT). */
export async function GET(req: NextRequest) {
  try {
    const admin = getAdmin();
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }
    const token = auth.replace(/^Bearer\s+/i, "");
    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(token);
    if (userErr || !user) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    let { data: profile, error: selErr } = await admin
      .from("user_profiles")
      .select(
        "email, plan, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at"
      )
      .eq("id", user.id)
      .maybeSingle();

    if (selErr) {
      return NextResponse.json({ error: selErr.message }, { status: 500 });
    }

    if (!profile) {
      const email = user.email ?? "";
      const { error: insErr } = await admin.from("user_profiles").insert({
        id: user.id,
        email,
        plan: "free",
      });
      if (insErr) {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      const again = await admin
        .from("user_profiles")
        .select(
          "email, plan, stripe_customer_id, stripe_subscription_id, subscription_status, subscription_current_period_end, created_at"
        )
        .eq("id", user.id)
        .single();
      profile = again.data;
    }

    if (!profile) {
      return NextResponse.json({ error: "profile_missing" }, { status: 500 });
    }

    const hasStripeCustomer = Boolean(profile.stripe_customer_id);

    return NextResponse.json({
      email: profile.email,
      plan: profile.plan,
      subscription_status: profile.subscription_status ?? null,
      current_period_end: profile.subscription_current_period_end ?? null,
      billing_portal_available: hasStripeCustomer,
      stripe_subscription_id: (profile.stripe_subscription_id as string | null) ?? null,
      member_since: profile.created_at ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
