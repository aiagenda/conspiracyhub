import { Resend } from "resend";

/**
 * One place that knows how this site sends mail.
 *
 * There used to be three copies of these two functions, each defaulting the
 * sender to `alerts@thetheorist.local` — a domain that does not exist and that
 * Resend rejects outright. With RESEND_FROM unset in production, every email the
 * site has ever tried to send was refused, and nothing noticed, because none of
 * the callers looked at what Resend answered.
 */
const VERIFIED_SENDER = "The Theorist <brief@the-theorist.com>";

export function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

export function fromAddress(): string {
  return process.env.RESEND_FROM?.trim() || VERIFIED_SENDER;
}

export type SendResult = { ok: true } | { ok: false; reason: string };

/**
 * Sends and reports what happened. The Resend SDK returns `{ data, error }`
 * rather than throwing, so a caller that ignores the return value cannot tell a
 * delivered message from a refused one.
 */
export async function sendEmail(message: {
  to: string | string[];
  subject: string;
  html: string;
  headers?: Record<string, string>;
}): Promise<SendResult> {
  const client = getResend();
  if (!client) return { ok: false, reason: "RESEND_API_KEY is not configured" };

  try {
    const { error } = await client.emails.send({ from: fromAddress(), ...message });
    if (error) {
      console.error("[email]", error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    console.error("[email]", reason);
    return { ok: false, reason };
  }
}
