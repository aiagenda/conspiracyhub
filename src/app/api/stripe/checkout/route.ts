import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  return new Stripe(key);
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const auth = req.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "missing_token", message: "Sign in to subscribe." }, { status: 401 });
    }
    const token = auth.replace(/^Bearer\s+/i, "");
    const admin = getAdmin();
    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(token);
    if (userErr || !user?.id) {
      return NextResponse.json({ error: "invalid_token", message: "Sign in to subscribe." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const priceId = (body as { priceId?: string }).priceId || process.env.STRIPE_PRICE_ID;
    if (!priceId) return NextResponse.json({ error: "missing_price_id" }, { status: 400 });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.nextUrl.origin}/account?checkout=success`,
      cancel_url: `${req.nextUrl.origin}/`,
      client_reference_id: user.id,
      metadata: { supabase_user_id: user.id },
      ...(user.email ? { customer_email: user.email } : {}),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[stripe-checkout]", error);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
