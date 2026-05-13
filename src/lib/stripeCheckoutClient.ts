import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase";

/**
 * Starts Stripe Checkout from the browser. On success, redirects away.
 * Throws with a user-visible message if checkout cannot start.
 */
export async function redirectToStripeCheckout(): Promise<void> {
  if (!isSupabaseBrowserConfigured()) {
    throw new Error("Sign in is not available (Supabase not configured in the browser).");
  }
  const supabase = getSupabaseBrowserClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    throw new Error("Sign in first to upgrade to PRO.");
  }

  let res: Response;
  try {
    res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
  } catch {
    throw new Error("Network error — check your connection.");
  }

  let data: { url?: string; error?: string; message?: string };
  try {
    data = (await res.json()) as { url?: string; error?: string; message?: string };
  } catch {
    throw new Error("Invalid response from billing server.");
  }

  if (data.url) {
    window.location.href = data.url;
    return;
  }

  if (res.status === 401) {
    throw new Error(data.message ?? "Sign in first to subscribe.");
  }
  if (data.error === "missing_price_id") {
    throw new Error("Billing is not configured yet (STRIPE_PRICE_ID on the server).");
  }
  if (data.error === "checkout_failed") {
    throw new Error("Stripe could not start checkout. Check STRIPE_SECRET_KEY and server logs.");
  }
  throw new Error(data.message ?? data.error ?? `Checkout unavailable (${res.status}).`);
}
