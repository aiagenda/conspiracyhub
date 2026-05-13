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
  return { admin: createClient(url, key), url, serviceKey: key };
}

/**
 * Permanently delete the authenticated user (Auth + cascaded public rows).
 * Cancels active Stripe subscription first when possible.
 * Body: { "confirm": "DELETE" } required.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { confirm?: string };
    if (body.confirm !== "DELETE") {
      return NextResponse.json(
        { error: "confirmation_required", message: 'Send JSON body { "confirm": "DELETE" }.' },
        { status: 400 }
      );
    }

    const { admin, url, serviceKey } = getAdmin();
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const {
      data: { user },
      error: userErr,
    } = await admin.auth.getUser(token);
    if (userErr || !user?.id) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }

    const { data: profile } = await admin
      .from("user_profiles")
      .select("stripe_subscription_id")
      .eq("id", user.id)
      .maybeSingle();

    const subId = profile?.stripe_subscription_id as string | null | undefined;
    if (subId) {
      try {
        await getStripe().subscriptions.cancel(subId);
      } catch {
        /* already canceled or invalid — continue with account deletion */
      }
    }

    const delRes = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
      method: "DELETE",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
    });
    if (!delRes.ok) {
      const detail = await delRes.text().catch(() => "");
      console.error("[account/delete] auth admin delete failed", delRes.status, detail);
      return NextResponse.json(
        { error: "delete_failed", message: "Could not remove auth user. Check Supabase logs and FK policies." },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[account/delete]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
