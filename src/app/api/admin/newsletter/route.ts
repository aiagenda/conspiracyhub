import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdminRequest } from "@/lib/server/requireAdminSession";
import { activeSubscribers, sendConfirmation } from "@/lib/server/newsletter";
import { buildWeeklyBriefingPreview, sendWeeklyBriefing } from "@/lib/server/weeklyBriefing";
import { sendEmail } from "@/lib/server/email";

export const maxDuration = 300; // One message per recipient, paced for Resend's rate limit.

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

type Row = {
  email: string;
  source: string | null;
  created_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
};

/** Counts and the most recent signups, for the mailing-list panel. */
export async function GET(req: NextRequest) {
  const access = await requireAdminRequest(req);
  if ("response" in access) return access.response;

  const db = admin();
  const { data, error } = await db
    .from("newsletter_subscribers")
    .select("email, source, created_at, confirmed_at, unsubscribed_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as Row[];
  const confirmed = rows.filter((r) => r.confirmed_at && !r.unsubscribed_at).length;
  const pending = rows.filter((r) => !r.confirmed_at && !r.unsubscribed_at).length;
  const left = rows.filter((r) => r.unsubscribed_at).length;

  const { data: job } = await db
    .from("scraper_jobs")
    .select("enabled, schedule_cron, next_run_at")
    .eq("job_key", "weekly_briefing")
    .maybeSingle();

  const preview = await buildWeeklyBriefingPreview(db);

  return NextResponse.json({
    counts: { confirmed, pending, left, total: rows.length },
    rows: rows.slice(0, 50),
    job: job ?? null,
    preview,
    senderConfigured: Boolean(process.env.RESEND_API_KEY),
    sender: process.env.RESEND_FROM?.trim() || "The Theorist <brief@the-theorist.com>",
  });
}

/** resend_confirmation · send_test · send_now */
export async function POST(req: NextRequest) {
  const access = await requireAdminRequest(req);
  if ("response" in access) return access.response;

  const body = (await req.json().catch(() => ({}))) as { action?: string; email?: string };
  const db = admin();

  if (body.action === "resend_confirmation") {
    const email = body.email?.trim().toLowerCase() ?? "";
    const { data: row } = await db
      .from("newsletter_subscribers")
      .select("token, confirmed_at")
      .eq("email", email)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "No such subscriber." }, { status: 404 });
    if (row.confirmed_at) return NextResponse.json({ error: "Already confirmed." }, { status: 400 });
    const sent = await sendConfirmation(email, row.token as string);
    return sent.ok
      ? NextResponse.json({ ok: true, message: `Confirmation resent to ${email}.` })
      : NextResponse.json({ error: sent.reason }, { status: 502 });
  }

  if (body.action === "send_test") {
    const email = body.email?.trim().toLowerCase() ?? "";
    if (!email) return NextResponse.json({ error: "An address is required." }, { status: 400 });
    const built = await buildWeeklyBriefingPreview(db);
    if (!built.subject) return NextResponse.json({ error: "Nothing to send — no articles this week." }, { status: 400 });
    // A test goes out with a real-looking opt-out so the whole message can be checked.
    const sent = await sendEmail({ to: email, subject: `[TEST] ${built.subject}`, html: built.html });
    return sent.ok
      ? NextResponse.json({ ok: true, message: `Test briefing sent to ${email}.` })
      : NextResponse.json({ error: sent.reason }, { status: 502 });
  }

  if (body.action === "send_now") {
    const result = await sendWeeklyBriefing(db);
    return NextResponse.json({
      ok: true,
      message: `Briefing sent to ${result.sent} of ${(await activeSubscribers(db)).length} confirmed subscribers.`,
      ...result,
    });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

export const dynamic = "force-dynamic";
