import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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

export async function POST(req: NextRequest) {
  try {
    const { news } = await req.json();
    if (!news || news.score < 75) return NextResponse.json({ sent: 0 });

    const admin = getAdminClient();
    const { data: users } = await admin.from("user_profiles").select("email").eq("plan", "pro");
    const emails = (users ?? []).map((u) => u.email).filter(Boolean);
    if (!emails.length) return NextResponse.json({ sent: 0 });

    const resend = getResend();
    await resend.emails.send({
      from: "The Theorist <alerts@thetheorist.local>",
      to: emails,
      subject: "⚠ HIGH THREAT LEVEL DETECTED",
      html: `<div style="background:#050c07;color:#c8e8d0;font-family:monospace;padding:16px">
        <h2 style="color:#ff3333">⚠ HIGH THREAT LEVEL DETECTED</h2>
        <p><b>${news.title}</b></p>
        <p>Threat score: ${news.score}%</p>
        <p>${news.angle ?? ""}</p>
      </div>`,
    });

    return NextResponse.json({ sent: emails.length });
  } catch (error) {
    console.error("[alerts]", error);
    return NextResponse.json({ error: "alerts_failed" }, { status: 500 });
  }
}
