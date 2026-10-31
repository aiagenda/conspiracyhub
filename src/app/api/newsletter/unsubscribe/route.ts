import { NextRequest, NextResponse } from "next/server";
import { newsletterAdmin } from "@/lib/server/newsletter";

/**
 * One-click unsubscribe (RFC 8058) and the target of the button on the
 * unsubscribe page. POST only, so that a mail client prefetching links in the
 * briefing cannot drop someone off the list on their behalf.
 */
export async function POST(req: NextRequest) {
  const token =
    new URL(req.url).searchParams.get("token") ??
    ((await req.json().catch(() => ({}))) as { token?: string }).token ??
    "";
  if (!token) return NextResponse.json({ error: "missing_token" }, { status: 400 });

  const { error } = await newsletterAdmin()
    .from("newsletter_subscribers")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("token", token);

  if (error) {
    console.error("[newsletter/unsubscribe]", error.message);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  // An unknown token reports success too — it is not this endpoint's job to tell
  // a stranger which tokens are real.
  return NextResponse.json({ ok: true });
}
