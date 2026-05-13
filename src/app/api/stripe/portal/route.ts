import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  return new Stripe(key);
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

/** Stripe Customer Portal — manage card, cancel, invoices. Requires Bearer JWT + stripe_customer_id on profile. */
export async function POST(req: NextRequest) {
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

    const body = (await req.json().catch(() => ({}))) as { intent?: string };
    const intent = body.intent === "cancel_subscription" ? "cancel_subscription" : "default";

    const { data: profile, error } = await admin
      .from("user_profiles")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const customerId = profile?.stripe_customer_id as string | null | undefined;
    if (!customerId) {
      return NextResponse.json(
        { error: "no_stripe_customer", message: "Subscribe via PRO first to open billing." },
        { status: 400 }
      );
    }

    const subscriptionId = profile?.stripe_subscription_id as string | null | undefined;
    if (intent === "cancel_subscription" && !subscriptionId) {
      return NextResponse.json(
        { error: "no_subscription", message: "No active subscription id on file — use Manage billing in Stripe." },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const origin = req.nextUrl.origin;

    const sessionParams: Stripe.BillingPortal.SessionCreateParams = {
      customer: customerId,
      return_url: `${origin}/account`,
    };
    if (intent === "cancel_subscription" && subscriptionId) {
      sessionParams.flow_data = {
        type: "subscription_cancel",
        subscription_cancel: { subscription: subscriptionId },
      };
    }

    const session = await stripe.billingPortal.sessions.create(sessionParams);

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("[stripe-portal]", e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "portal_failed", message: msg }, { status: 500 });
  }
}
