/**
 * Starts Stripe Checkout from the browser. On success, redirects away.
 * Throws with a user-visible message if checkout cannot start.
 */
export async function redirectToStripeCheckout(): Promise<void> {
  let res: Response;
  try {
    res = await fetch("/api/stripe/checkout", { method: "POST" });
  } catch {
    throw new Error("Network error — check your connection.");
  }

  let data: { url?: string; error?: string };
  try {
    data = (await res.json()) as { url?: string; error?: string };
  } catch {
    throw new Error("Invalid response from billing server.");
  }

  if (data.url) {
    window.location.href = data.url;
    return;
  }

  if (data.error === "missing_price_id") {
    throw new Error("Billing is not configured yet (STRIPE_PRICE_ID on the server).");
  }
  if (data.error === "checkout_failed") {
    throw new Error("Stripe could not start checkout. Check STRIPE_SECRET_KEY and server logs.");
  }
  throw new Error(data.error ?? `Checkout unavailable (${res.status}).`);
}
