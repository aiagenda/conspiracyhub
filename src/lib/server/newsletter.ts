import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sendEmail, type SendResult } from "@/lib/server/email";
import { getSiteUrl } from "@/lib/siteUrl";

/**
 * The mailing list.
 *
 * Signups are double opt-in: a row exists from the moment someone asks, but it is
 * not a recipient until they click the link in the confirmation mail. The same
 * token stays valid afterwards so every briefing can carry a working one-click
 * unsubscribe — a list you cannot leave is not one you should be sending to.
 */
export type Subscriber = { email: string; token: string };

export function newsletterAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error("Supabase env missing");
  return createClient(url, key);
}

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function confirmUrl(token: string): string {
  return `${getSiteUrl()}/newsletter/confirm?token=${encodeURIComponent(token)}`;
}

export function unsubscribeUrl(token: string): string {
  return `${getSiteUrl()}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** Everyone who has confirmed and not since left. */
export async function activeSubscribers(admin: SupabaseClient): Promise<Subscriber[]> {
  const rows: Subscriber[] = [];
  // PostgREST caps an unranged select at 1000 rows.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("newsletter_subscribers")
      .select("email, token")
      .not("confirmed_at", "is", null)
      .is("unsubscribed_at", null)
      .range(from, from + 999);
    if (error || !data?.length) break;
    rows.push(...(data as Subscriber[]));
    if (data.length < 1000) break;
  }
  return rows;
}

export async function sendConfirmation(email: string, token: string): Promise<SendResult> {
  const link = confirmUrl(token);
  return sendEmail({
    to: email,
    subject: "Confirm your subscription to The Weekly Oracle Brief",
    html: `<div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:15px;line-height:1.6;color:#0b0f0d">
      <p>Someone — we hope you — asked for the weekly briefing from The Theorist.</p>
      <p><a href="${link}" style="color:#00bb66;font-weight:700">Confirm the subscription →</a></p>
      <p style="color:#5a8068;font-size:13px">If it was not you, ignore this message and nothing will be sent. The link confirms one address only.</p>
    </div>`,
  });
}
