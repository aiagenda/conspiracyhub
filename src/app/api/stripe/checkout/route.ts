import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const priceId = body.priceId || process.env.STRIPE_PRICE_ID;
    if (!priceId) return NextResponse.json({ error: "missing_price_id" }, { status: 400 });

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.nextUrl.origin}/account?checkout=success`,
      cancel_url: `${req.nextUrl.origin}/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[stripe-checkout]", error);
    return NextResponse.json({ error: "checkout_failed" }, { status: 500 });
  }
}
