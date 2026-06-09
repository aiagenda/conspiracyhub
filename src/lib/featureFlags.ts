/**
 * Feature toggles (mostly NEXT_PUBLIC_* so client bundles can read them).
 * Re-enable live chat: set NEXT_PUBLIC_LIVE_CHAT_ENABLED=true on Vercel and redeploy.
 */
function truthyEnv(v: string | undefined): boolean {
  const s = v?.trim().toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

/** Per-article sidebar live chat (ArticleReader / GeneratedArticleReader). Off unless explicitly enabled. */
export function isLiveChatEnabled(): boolean {
  return truthyEnv(process.env.NEXT_PUBLIC_LIVE_CHAT_ENABLED);
}

/** Re-enable when community launches publicly. */
export const SHOW_COMMUNITY = false;

/** Stripe / PRO tier / Analyst Pass — off while the product is fully free. */
export const BILLING_ENABLED = false;

export function isBillingEnabled(): boolean {
  return BILLING_ENABLED;
}
