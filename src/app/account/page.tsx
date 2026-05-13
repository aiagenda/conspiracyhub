"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import { pageContentShellStyle } from "@/lib/pageShell";
import { redirectToStripeCheckout } from "@/lib/stripeCheckoutClient";
import { parseNicknameInput } from "@/lib/nickname";

type AccountPayload = {
  email: string;
  nickname: string | null;
  plan: string;
  subscription_status: string | null;
  current_period_end: string | null;
  billing_portal_available: boolean;
  stripe_subscription_id: string | null;
  subscription_cancel_at_period_end: boolean;
  member_since: string | null;
};

function accessPeriodHint(iso: string | null, cancelAtEnd: boolean): string | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  const ms = end - Date.now();
  const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) {
    return cancelAtEnd
      ? "PRO access ends today or has ended. Stripe will move you to FREE when the billing period closes."
      : "Renewal date is today or in the past — open Manage billing if this looks wrong.";
  }
  if (cancelAtEnd) {
    return `PRO features stay on for ${days} more day${days === 1 ? "" : "s"}, then your plan becomes FREE — subscription is canceled (no renewal).`;
  }
  return `Renews in ${days} day${days === 1 ? "" : "s"}.`;
}

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AccountPayload | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setData(null);
      setLoading(false);
      return;
    }
    const res = await fetch("/api/account", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const json = (await res.json()) as AccountPayload & { error?: string };
    if (!res.ok) {
      setError(json.error ?? "Could not load account");
      setData(null);
    } else {
      setData({
        ...json,
        nickname: json.nickname ?? null,
        stripe_subscription_id: json.stripe_subscription_id ?? null,
        subscription_cancel_at_period_end: Boolean(json.subscription_cancel_at_period_end),
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (data?.nickname != null) setNicknameDraft(data.nickname);
    else setNicknameDraft("");
  }, [data?.nickname]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => subscription.unsubscribe();
  }, [load]);

  /** After Stripe redirect, webhook may lag — poll account a few times. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const q = new URLSearchParams(window.location.search);
    if (q.get("checkout") !== "success") return;
    let n = 0;
    const id = window.setInterval(() => {
      void load();
      n += 1;
      if (n >= 10) window.clearInterval(id);
    }, 2000);
    return () => window.clearInterval(id);
  }, [load]);

  async function startCheckout() {
    setError(null);
    setCheckoutLoading(true);
    try {
      await redirectToStripeCheckout();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed.");
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function openBillingPortal(intent: "default" | "cancel_subscription" = "default") {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(intent === "cancel_subscription" ? { intent: "cancel_subscription" } : {}),
      });
      const json = (await res.json()) as { url?: string; error?: string; message?: string };
      if (json.url) window.location.href = json.url;
      else setError(json.message ?? json.error ?? "Portal unavailable");
    } finally {
      setPortalLoading(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    setData(null);
    void load();
  }

  async function saveProfile() {
    if (!data) return;
    const parsed = parseNicknameInput(nicknameDraft);
    if (!parsed.ok) {
      const msg =
        parsed.error === "nickname_too_short"
          ? "Display name must be at least 2 characters (or leave empty to clear)."
          : parsed.error === "nickname_too_long"
            ? "Display name is too long (max 40 characters)."
            : "Display name: use letters, numbers, spaces, _ - . only.";
      setError(msg);
      return;
    }
    setError(null);
    setProfileSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Session expired — sign in again.");
        return;
      }
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nickname: parsed.value }),
      });
      const json = (await res.json()) as { nickname?: string | null; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not update profile");
        return;
      }
      setData((prev) => (prev ? { ...prev, nickname: json.nickname ?? null } : null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function confirmDeleteAccount() {
    if (deletePhrase !== "DELETE") {
      setError('Type DELETE exactly to confirm account removal.');
      return;
    }
    setError(null);
    setDeleteLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError("Session expired — sign in again.");
        return;
      }
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      const json = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setError(json.message ?? json.error ?? "Delete failed.");
        return;
      }
      await signOut();
      window.location.href = "/";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleteLoading(false);
    }
  }

  const card = {
    background: "#090f0b",
    border: "1px solid #1a3320",
    borderRadius: 4,
    padding: "1.25rem",
  } as const;

  const cancelingSubscription = Boolean(data?.subscription_cancel_at_period_end);
  const periodHint = data?.current_period_end
    ? accessPeriodHint(data.current_period_end, cancelingSubscription)
    : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050c07",
        color: "#c8e8d0",
        fontFamily: "var(--font-share-tech-mono), monospace",
      }}
    >
      <div className="scanline" />
      <div style={{ position: "relative", zIndex: 1 }}>
        <header
          style={{
            height: 48,
            background: "#050c07",
            borderBottom: "1px solid #1a3320",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: 14,
          }}
        >
          <Link
            href="/"
            style={{
              fontSize: 10,
              color: "#5a8068",
              textDecoration: "none",
              letterSpacing: 2,
              border: "1px solid #1a3320",
              padding: "4px 10px",
              borderRadius: 3,
            }}
          >
            ← FEED
          </Link>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div
            style={{
              fontFamily: "var(--font-raj), sans-serif",
              fontSize: 14,
              fontWeight: 700,
              color: "#00ff88",
              letterSpacing: 2,
            }}
          >
            ACCOUNT
          </div>
        </header>

        <div style={pageContentShellStyle()}>
          <div style={{ marginBottom: "1.25rem" }}>
            <div
              style={{
                fontFamily: "var(--font-raj), sans-serif",
                fontSize: 10,
                letterSpacing: 4,
                color: "#5a8068",
                marginBottom: 6,
                textTransform: "uppercase",
              }}
            >
              ■ PROFILE & BILLING ■
            </div>
            <h1
              style={{
                fontFamily: "var(--font-raj), sans-serif",
                fontSize: 22,
                fontWeight: 700,
                color: "#00ff88",
                letterSpacing: 2,
                textTransform: "uppercase",
                margin: 0,
              }}
            >
              YOUR ACCOUNT
            </h1>
            <p style={{ fontSize: 11, color: "#5a8068", marginTop: 8, maxWidth: 520, lineHeight: 1.6 }}>
              Plan status, renewal countdown, Stripe billing (card, invoices, cancel). After checkout we refresh
              automatically for a short window while the webhook syncs.
            </p>
          </div>

          {loading && (
            <div style={{ ...card, fontSize: 11, color: "#3a5040", letterSpacing: 2 }}>LOADING…</div>
          )}

          {!loading && !data && (
            <div style={card}>
              <p style={{ fontSize: 12, color: "#c8e8d0", marginBottom: 12 }}>
                Sign in to view your profile and subscription.
              </p>
              <Link
                href="/"
                style={{
                  display: "inline-block",
                  fontFamily: "var(--font-raj), sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 2,
                  textTransform: "uppercase",
                  padding: "8px 16px",
                  border: "1px solid #00bb66",
                  color: "#00ff88",
                  textDecoration: "none",
                  borderRadius: 3,
                }}
              >
                Go to feed → Sign in
              </Link>
            </div>
          )}

          {error && (
            <div
              style={{
                ...card,
                borderColor: "rgba(255,51,51,0.35)",
                color: "#ff9b9b",
                fontSize: 12,
                marginBottom: 12,
              }}
            >
              {error}
            </div>
          )}

          {!loading && data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 560 }}>
              <div style={card}>
                <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>PROFILE</div>
                <div style={{ fontSize: 14, color: "#e8ffe8", marginBottom: 4 }}>{data.email}</div>
                <div style={{ marginTop: 10, marginBottom: 6 }}>
                  <label style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase", display: "block", marginBottom: 5 }}>
                    EDIT DISPLAY NAME
                  </label>
                  <input
                    type="text"
                    value={nicknameDraft}
                    onChange={(e) => setNicknameDraft(e.target.value)}
                    placeholder="2–40 characters · optional after signup"
                    maxLength={48}
                    style={{
                      background: "#050c07",
                      border: "1px solid #1a3320",
                      borderRadius: 3,
                      padding: "8px 10px",
                      color: "#c8e8d0",
                      fontFamily: "inherit",
                      fontSize: 12,
                      width: "100%",
                      maxWidth: 320,
                      outline: "none",
                    }}
                  />
                  <div style={{ fontSize: 9, color: "#3a5040", marginTop: 5, maxWidth: 400, lineHeight: 1.5 }}>
                    Letters, numbers, spaces, underscore, hyphen, period. Clear the field and save to remove your display name.
                  </div>
                </div>
                <button
                  type="button"
                  disabled={profileSaving}
                  onClick={() => void saveProfile()}
                  style={{
                    marginTop: 8,
                    fontFamily: "var(--font-raj), sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    padding: "8px 16px",
                    border: "1px solid #00bb66",
                    background: "rgba(0,255,136,0.06)",
                    color: "#00ff88",
                    borderRadius: 3,
                    cursor: profileSaving ? "wait" : "pointer",
                    opacity: profileSaving ? 0.7 : 1,
                  }}
                >
                  {profileSaving ? "SAVING…" : "SAVE DISPLAY NAME"}
                </button>
                {data.member_since && (
                  <div style={{ fontSize: 10, color: "#3a5040", marginTop: 12 }}>
                    Member since {new Date(data.member_since).toLocaleDateString()}
                  </div>
                )}
              </div>

              {data.plan === "pro" ? (
                <div style={{ ...card, borderColor: "rgba(0,255,136,0.3)", background: "rgba(0,255,136,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                    <span style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 22, fontWeight: 700, color: "#00ff88", letterSpacing: 3 }}>PRO</span>
                    {cancelingSubscription ? (
                      <span
                        style={{
                          fontSize: 9,
                          background: "rgba(255,170,0,0.12)",
                          border: "1px solid rgba(255,170,0,0.5)",
                          color: "#ffcc88",
                          padding: "2px 8px",
                          borderRadius: 2,
                          letterSpacing: 2,
                        }}
                      >
                        CANCELED · ACCESS UNTIL PERIOD END
                      </span>
                    ) : (
                      <span style={{ fontSize: 9, background: "rgba(0,255,136,0.15)", border: "1px solid rgba(0,255,136,0.4)", color: "#00ff88", padding: "2px 8px", borderRadius: 2, letterSpacing: 2 }}>ACTIVE</span>
                    )}
                  </div>
                  {cancelingSubscription && (
                    <div style={{ fontSize: 11, color: "#ffcc88", marginBottom: 10, lineHeight: 1.65 }}>
                      You canceled PRO in Stripe. Billing does not renew — you keep PRO features until the date below,
                      then the plan becomes FREE automatically.
                    </div>
                  )}
                  {data.subscription_status && data.subscription_status !== "active" && !cancelingSubscription && (
                    <div style={{ fontSize: 11, color: "#ffaa00", marginBottom: 6 }}>
                      Subscription status: <span style={{ color: "#e8ffe8" }}>{data.subscription_status}</span>
                    </div>
                  )}
                  {data.current_period_end && (
                    <div style={{ fontSize: 11, color: "#7aaa8a", marginBottom: 6, lineHeight: 1.6 }}>
                      {cancelingSubscription ? "PRO access ends:" : "Next renewal date:"}{" "}
                      <span style={{ color: "#c8e8d0" }}>
                        {new Date(data.current_period_end).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  )}
                  {periodHint && (
                    <div style={{ fontSize: 11, color: "#5a8068", marginBottom: 14, letterSpacing: 0.3 }}>{periodHint}</div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <button
                      type="button"
                      disabled={portalLoading}
                      onClick={() => void openBillingPortal("default")}
                      style={{
                        fontFamily: "var(--font-raj), sans-serif",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        padding: "9px 18px",
                        border: "1px solid #00bb66",
                        background: "rgba(0,255,136,0.06)",
                        color: "#00ff88",
                        borderRadius: 3,
                        cursor: portalLoading ? "wait" : "pointer",
                        opacity: portalLoading ? 0.7 : 1,
                      }}
                    >
                      {portalLoading ? "OPENING…" : "◈ MANAGE BILLING & INVOICES ▸"}
                    </button>
                    {data.billing_portal_available && data.stripe_subscription_id && !cancelingSubscription && (
                      <button
                        type="button"
                        disabled={portalLoading}
                        onClick={() => void openBillingPortal("cancel_subscription")}
                        style={{
                          fontFamily: "var(--font-raj), sans-serif",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          padding: "9px 18px",
                          border: "1px solid rgba(255,170,0,0.45)",
                          background: "rgba(255,170,0,0.06)",
                          color: "#ffcc66",
                          borderRadius: 3,
                          cursor: portalLoading ? "wait" : "pointer",
                          opacity: portalLoading ? 0.7 : 1,
                        }}
                      >
                        CANCEL SUBSCRIPTION
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "#3a5040", marginTop: 8 }}>
                    {cancelingSubscription
                      ? "You can still use Manage billing to update payment methods or invoices. Reactivate in Stripe if you change your mind before the end date."
                      : "Change card · Invoices · Cancel ends PRO at period end unless you choose immediate cancel in Stripe."}
                  </div>
                </div>
              ) : (
                <div style={{ ...card, borderColor: "#1a3320" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 22, fontWeight: 700, color: "#5a8068", letterSpacing: 3 }}>FREE</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#7aaa8a", marginBottom: 16, lineHeight: 1.7 }}>
                    Upgrade to <strong style={{ color: "#00ff88" }}>PRO</strong> for unlimited Oracle triggers, full article highlights, Polymarket real-time odds, URL analyzer and board export.
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={checkoutLoading}
                      onClick={() => void startCheckout()}
                      style={{
                        fontFamily: "var(--font-raj), sans-serif",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        padding: "9px 18px",
                        border: "1px solid #00bb66",
                        background: "rgba(0,255,136,0.06)",
                        color: "#00ff88",
                        borderRadius: 3,
                        cursor: checkoutLoading ? "wait" : "pointer",
                        opacity: checkoutLoading ? 0.7 : 1,
                      }}
                    >
                      {checkoutLoading ? "OPENING CHECKOUT…" : "◐ UPGRADE TO PRO — $7/mo ▸"}
                    </button>
                  </div>
                  <div style={{ fontSize: 10, color: "#3a5040", marginTop: 8 }}>
                    Opens Stripe Checkout on this site. You can also use <strong style={{ color: "#5a8068" }}>PRO ▶</strong> in the feed header.
                  </div>
                </div>
              )}

              <div style={card}>
                <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>SETTINGS & LINKS</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 11 }}>
                  {[
                    { href: "/privacy", label: "Privacy" },
                    { href: "/terms", label: "Terms" },
                    { href: "/faq", label: "FAQ" },
                    { href: "/guide", label: "Guide" },
                    { href: "/contact", label: "Contact" },
                  ].map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      style={{
                        color: "#00bb66",
                        textDecoration: "none",
                        borderBottom: "1px solid rgba(0,187,102,0.35)",
                        paddingBottom: 1,
                      }}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
                <p style={{ fontSize: 10, color: "#3a5040", marginTop: 12, marginBottom: 0, lineHeight: 1.65 }}>
                  Display name is stored on your profile (shown above). Email and password changes use Supabase Auth
                  (reset from sign-in). In-app email prefs can ship later.
                </p>
              </div>

              <div style={{ ...card, borderColor: "rgba(255,51,51,0.25)" }}>
                <div style={{ fontSize: 9, color: "#aa6666", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>DANGER ZONE</div>
                <p style={{ fontSize: 11, color: "#8a7068", marginTop: 0, marginBottom: 12, lineHeight: 1.6 }}>
                  Delete removes your login, profile, and linked app data where the database cascades. We cancel your
                  Stripe subscription first when we have a subscription id.
                </p>
                {!showDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      setShowDelete(true);
                      setDeletePhrase("");
                      setError(null);
                    }}
                    style={{
                      fontFamily: "var(--font-raj), sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      padding: "8px 16px",
                      border: "1px solid rgba(255,51,51,0.45)",
                      background: "rgba(255,51,51,0.06)",
                      color: "#ff8888",
                      borderRadius: 3,
                      cursor: "pointer",
                    }}
                  >
                    DELETE ACCOUNT…
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <label style={{ fontSize: 10, color: "#5a8068" }}>
                      Type <strong style={{ color: "#ff6666" }}>DELETE</strong> to confirm
                    </label>
                    <input
                      value={deletePhrase}
                      onChange={(e) => setDeletePhrase(e.target.value)}
                      placeholder="DELETE"
                      style={{
                        background: "#050c07",
                        border: "1px solid #1a3320",
                        borderRadius: 3,
                        padding: "8px 10px",
                        color: "#e8e8e8",
                        fontFamily: "inherit",
                        fontSize: 12,
                        maxWidth: 220,
                      }}
                    />
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        disabled={deleteLoading}
                        onClick={() => void confirmDeleteAccount()}
                        style={{
                          fontFamily: "var(--font-raj), sans-serif",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          padding: "8px 16px",
                          border: "1px solid #ff3333",
                          background: "rgba(255,51,51,0.12)",
                          color: "#ff6666",
                          borderRadius: 3,
                          cursor: deleteLoading ? "wait" : "pointer",
                        }}
                      >
                        {deleteLoading ? "REMOVING…" : "PERMANENTLY DELETE"}
                      </button>
                      <button
                        type="button"
                        disabled={deleteLoading}
                        onClick={() => {
                          setShowDelete(false);
                          setDeletePhrase("");
                        }}
                        style={{
                          fontFamily: "var(--font-raj), sans-serif",
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          padding: "8px 16px",
                          border: "1px solid #1a3320",
                          background: "transparent",
                          color: "#5a8068",
                          borderRadius: 3,
                          cursor: "pointer",
                        }}
                      >
                        BACK
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={card}>
                <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>SESSION</div>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  style={{
                    fontFamily: "var(--font-raj), sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                    padding: "8px 16px",
                    border: "1px solid #1a3320",
                    background: "transparent",
                    color: "#5a8068",
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                >
                  SIGN OUT
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
