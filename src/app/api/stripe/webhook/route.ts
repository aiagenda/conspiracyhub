import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY missing");
  return new Stripe(key);
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

function customerIdFromSession(session: Stripe.Checkout.Session): string | null {
  const c = session.customer;
  if (typeof c === "string") return c;
  if (c && typeof c === "object" && "id" in c) return (c as Stripe.Customer).id;
  return null;
}

function stripeCustomerIdField(
  c: string | Stripe.Customer | Stripe.DeletedCustomer
): string {
  if (typeof c === "string") return c;
  if (c && typeof c === "object" && "id" in c) return (c as Stripe.Customer).id;
  return "";
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "missing_signature" }, { status: 400 });

  try {
    const stripe = getStripe();
    const admin = getAdminClient();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET missing");
    const event = stripe.webhooks.constructEvent(body, sig, secret);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const email =
        session.customer_details?.email ?? session.customer_email ?? null;
      const customerId = customerIdFromSession(session);

      let periodEnd: string | null = null;
      let subStatus: string | null = null;
      let subId: string | null = null;
      const subRef = session.subscription;
      if (subRef) {
        const sid = typeof subRef === "string" ? subRef : subRef.id;
        subId = sid;
        const sub = (await stripe.subscriptions.retrieve(sid)) as unknown as {
          current_period_end: number;
          status: string;
        };
        periodEnd = new Date(sub.current_period_end * 1000).toISOString();
        subStatus = sub.status;
      }

      if (email) {
        await admin
          .from("user_profiles")
          .update({
            plan: "pro",
            stripe_customer_id: customerId ?? undefined,
            stripe_subscription_id: subId ?? undefined,
            subscription_current_period_end: periodEnd,
            subscription_status: subStatus,
          })
          .eq("email", email);
      }
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as unknown as {
        id: string;
        customer: string | Stripe.Customer | Stripe.DeletedCustomer;
        status: string;
        current_period_end: number;
      };
      const periodEnd = new Date(sub.current_period_end * 1000).toISOString();
      const proStatuses = new Set(["active", "trialing", "past_due"]);
      const plan = proStatuses.has(sub.status) ? "pro" : "free";
      await admin
        .from("user_profiles")
        .update({
          plan,
          stripe_subscription_id: sub.id,
          subscription_current_period_end: periodEnd,
          subscription_status: sub.status,
        })
        .eq("stripe_customer_id", stripeCustomerIdField(sub.customer));
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as unknown as {
        customer: string | Stripe.Customer | Stripe.DeletedCustomer;
      };
      await admin
        .from("user_profiles")
        .update({
          plan: "free",
          stripe_subscription_id: null,
          subscription_current_period_end: null,
          subscription_status: "canceled",
        })
        .eq("stripe_customer_id", stripeCustomerIdField(sub.customer));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[stripe-webhook]", error);
    return NextResponse.json({ error: "webhook_failed" }, { status: 400 });
  }
}
