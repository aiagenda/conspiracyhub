import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, ipHash } from "@/lib/server/rateLimit";
import { newToken, newsletterAdmin, sendConfirmation } from "@/lib/server/newsletter";

/**
 * Public newsletter signup.
 *
 * The response never says whether an address was already on the list: that would
 * turn this endpoint into a way to test whether someone has subscribed.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { email?: string; source?: string };
    const email = body.email?.trim().toLowerCase() ?? "";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    const admin = newsletterAdmin();
    const limiter = await checkRateLimit(admin, req, { bucket: "newsletter", limit: 5, windowMinutes: 60 });
    if (!limiter.allowed) {
      return NextResponse.json({ error: "Too many requests — try again later." }, { status: 429 });
    }
    await limiter.record();

    const { data: existing } = await admin
      .from("newsletter_subscribers")
      .select("token, confirmed_at")
      .eq("email", email)
      .maybeSingle();

    if (existing?.confirmed_at) return NextResponse.json({ ok: true });

    if (existing) {
      // Asked again before confirming — resend rather than mint a second token.
      await sendConfirmation(email, existing.token as string);
      return NextResponse.json({ ok: true });
    }

    const token = newToken();
    const { error } = await admin.from("newsletter_subscribers").insert({
      email: email.slice(0, 200),
      source: (body.source ?? "site").slice(0, 80),
      ip_hash: ipHash(req),
      token,
    });
    if (error) {
      console.error("[newsletter/subscribe]", error.message);
      return NextResponse.json({ error: "Could not save subscription" }, { status: 500 });
    }

    await sendConfirmation(email, token);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[newsletter/subscribe]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
