import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { isBillingEnabled } from "@/lib/featureFlags";
import { isEffectivePro, type UserProfilePlanRow } from "@/lib/userPlan";

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY missing");
  return new Resend(key);
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

function fromAddress() {
  return process.env.RESEND_FROM ?? "The Theorist <alerts@thetheorist.local>";
}

export async function POST(req: NextRequest) {
  try {
    const { news } = await req.json();
    if (!news || news.score < 75) return NextResponse.json({ sent: 0 });

    const admin = getAdminClient();
    const { data: users } = await admin
      .from("user_profiles")
      .select(
        "email, plan, stripe_subscription_id, subscription_status, pro_trial_ends_at, pro_trial_granted_at, pro_trial_redeemed, email_high_threat_alerts",
      )
      .eq("email_high_threat_alerts", true);

    const emails = (users ?? [])
      .filter((u) => !isBillingEnabled() || isEffectivePro(u as UserProfilePlanRow))
      .map((u) => u.email)
      .filter(Boolean) as string[];

    if (!emails.length) return NextResponse.json({ sent: 0 });

    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.the-theorist.com").replace(/\/$/, "");
    const articleUrl = news.id ? `${site}/article/${news.id}` : site;

    const resend = getResend();
    await resend.emails.send({
      from: fromAddress(),
      to: emails,
      subject: "⚠ HIGH THREAT LEVEL DETECTED",
      html: `<div style="background:#050c07;color:#c8e8d0;font-family:monospace;padding:16px">
        <h2 style="color:#ff3333">⚠ HIGH THREAT LEVEL DETECTED</h2>
        <p><b>${news.title}</b></p>
        <p>Threat score: ${news.score}%</p>
        <p>${news.angle ?? ""}</p>
        <p style="margin-top:16px"><a href="${articleUrl}" style="color:#00ff88">Open investigation →</a></p>
        <p style="margin-top:20px;font-size:10px;color:#3a5040"><a href="${site}/account" style="color:#5a8068">Email preferences</a></p>
      </div>`,
    });

    return NextResponse.json({ sent: emails.length });
  } catch (error) {
    console.error("[alerts]", error);
    return NextResponse.json({ error: "alerts_failed" }, { status: 500 });
  }
}
