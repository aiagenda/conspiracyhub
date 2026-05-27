import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getPostHogClient } from "@/lib/posthog-server";

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

/** Stripe sends unix seconds; guard so we never call toISOString on Invalid Date (RangeError). */
function periodEndIsoFromUnixSeconds(ts: unknown): string | null {
  if (typeof ts !== "number" || !Number.isFinite(ts)) return null;
  const ms = ts * 1000;
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

/** Stripe Node types / webhook payloads: read fields defensively at runtime. */
type StripeSubscriptionLike = {
  id: string;
  status?: string;
  current_period_end?: unknown;
  cancel_at_period_end?: unknown;
  customer: string | Stripe.Customer | Stripe.DeletedCustomer;
};

function cancelAtPeriodEndFromStripe(v: unknown): boolean {
  return v === true || v === "true";
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ProfileBillingPatch = {
  plan: "pro" | "free";
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  subscription_current_period_end: string | null;
  subscription_status: string | null;
  subscription_cancel_at_period_end?: boolean;
};

async function updateProfileAfterCheckout(
  admin: ReturnType<typeof getAdminClient>,
  patch: ProfileBillingPatch,
  session: Stripe.Checkout.Session
) {
  const meta =
    (session.metadata?.supabase_user_id ?? session.client_reference_id ?? "").trim() || null;
  const userId = meta && UUID_RE.test(meta) ? meta : null;
  const email =
    (session.customer_details?.email ?? session.customer_email ?? "").trim() || null;

  if (userId) {
    const { data, error } = await admin.from("user_profiles").update(patch).eq("id", userId).select("id");
    if (error) throw error;
    if (data && data.length > 0) return;
  }
  if (email) {
    const { error } = await admin.from("user_profiles").update(patch).ilike("email", email);
    if (error) throw error;
  }
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
      const customerId = customerIdFromSession(session);

      let periodEnd: string | null = null;
      let subStatus: string | null = null;
      let subId: string | null = null;
      let cancelAtEnd = false;
      const subRef = session.subscription;
      if (subRef) {
        const sid = typeof subRef === "string" ? subRef : subRef.id;
        subId = sid;
        const sub = (await stripe.subscriptions.retrieve(sid)) as unknown as StripeSubscriptionLike;
        periodEnd = periodEndIsoFromUnixSeconds(sub.current_period_end);
        subStatus = sub.status ?? null;
        cancelAtEnd = cancelAtPeriodEndFromStripe(sub.cancel_at_period_end);
      }

      await updateProfileAfterCheckout(
        admin,
        {
          plan: "pro",
          ...(customerId ? { stripe_customer_id: customerId } : {}),
          ...(subId ? { stripe_subscription_id: subId } : {}),
          subscription_current_period_end: periodEnd,
          subscription_status: subStatus,
          subscription_cancel_at_period_end: cancelAtEnd,
        },
        session
      );

      const userId =
        (session.metadata?.supabase_user_id ?? session.client_reference_id ?? "").trim() || null;
      if (userId) {
        const posthog = getPostHogClient();
        posthog.capture({
          distinctId: userId,
          event: "subscription_activated",
          properties: {
            stripe_customer_id: customerId ?? undefined,
            stripe_subscription_id: subId ?? undefined,
            subscription_status: subStatus ?? undefined,
          },
        });
      }
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as unknown as StripeSubscriptionLike;
      const periodEnd = periodEndIsoFromUnixSeconds(sub.current_period_end);
      const proStatuses = new Set(["active", "trialing", "past_due"]);
      const status = sub.status ?? "";
      const plan = proStatuses.has(status) ? "pro" : "free";
      await admin
        .from("user_profiles")
        .update({
          plan,
          stripe_subscription_id: sub.id,
          subscription_current_period_end: periodEnd,
          subscription_status: status || null,
          subscription_cancel_at_period_end: cancelAtPeriodEndFromStripe(sub.cancel_at_period_end),
        })
        .eq("stripe_customer_id", stripeCustomerIdField(sub.customer));
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as unknown as StripeSubscriptionLike;
      await admin
        .from("user_profiles")
        .update({
          plan: "free",
          stripe_subscription_id: null,
          subscription_current_period_end: null,
          subscription_status: "canceled",
          subscription_cancel_at_period_end: false,
        })
        .eq("stripe_customer_id", stripeCustomerIdField(sub.customer));

      const customerId = stripeCustomerIdField(sub.customer);
      const posthog = getPostHogClient();
      posthog.capture({
        distinctId: customerId || sub.id,
        event: "subscription_cancelled",
        properties: {
          stripe_customer_id: customerId || undefined,
          stripe_subscription_id: sub.id,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[stripe-webhook]", error);
    return NextResponse.json({ error: "webhook_failed" }, { status: 400 });
  }
}
