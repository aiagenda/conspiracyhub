import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/server/email";

/**
 * High-threat alerts, for the accounts that opted in before registration was
 * retired. These are a different thing from the weekly brief and were
 * deliberately not folded into the mailing list — nobody subscribes to a weekly
 * digest expecting breaking alerts.
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

export async function POST(req: NextRequest) {
  try {
    const { news } = await req.json();
    if (!news || news.score < 75) return NextResponse.json({ sent: 0 });

    const admin = getAdminClient();
    const { data: users } = await admin
      .from("user_profiles")
      .select("email, email_high_threat_alerts")
      .eq("email_high_threat_alerts", true);

    const emails = (users ?? []).map((u) => u.email).filter(Boolean) as string[];
    if (!emails.length) return NextResponse.json({ sent: 0 });

    const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.the-theorist.com").replace(/\/$/, "");
    const articleUrl = news.id ? `${site}/article/${news.id}` : site;
    const html = `<div style="background:#050c07;color:#c8e8d0;font-family:monospace;padding:16px">
        <h2 style="color:#ff3333">⚠ HIGH THREAT LEVEL DETECTED</h2>
        <p><b>${news.title}</b></p>
        <p>Threat score: ${news.score}%</p>
        <p>${news.angle ?? ""}</p>
        <p style="margin-top:16px"><a href="${articleUrl}" style="color:#00ff88">Open investigation →</a></p>
        <p style="margin-top:20px;font-size:10px;color:#3a5040"><a href="${site}/account" style="color:#5a8068">Email preferences</a></p>
      </div>`;

    // One message each: a shared `to:` would show every recipient the others.
    let sent = 0;
    for (const to of emails) {
      const result = await sendEmail({ to, subject: "⚠ HIGH THREAT LEVEL DETECTED", html });
      if (result.ok) sent += 1;
    }
    return NextResponse.json({ sent });
  } catch (error) {
    console.error("[alerts]", error);
    return NextResponse.json({ error: "alerts_failed" }, { status: 500 });
  }
}
