"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { signOut } from "@/lib/auth";
import { pageContentShellStyle } from "@/lib/pageShell";

type AccountPayload = {
  email: string;
  plan: string;
  subscription_status: string | null;
  current_period_end: string | null;
  billing_portal_available: boolean;
  member_since: string | null;
};

export default function AccountPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AccountPayload | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

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
      setData(json);
    }
    setLoading(false);
  }, []);

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

  async function openBillingPortal() {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return;
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
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

  const card = {
    background: "#090f0b",
    border: "1px solid #1a3320",
    borderRadius: 4,
    padding: "1.25rem",
  } as const;

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
              Your account
            </h1>
            <p style={{ fontSize: 11, color: "#5a8068", marginTop: 8, maxWidth: 520, lineHeight: 1.6 }}>
              Plan status, renewal window, and Stripe billing (card, invoices, cancel). No social notifications here
              yet — that comes in a later release.
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

              {/* Profile row */}
              <div style={card}>
                <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>PROFILE</div>
                <div style={{ fontSize: 14, color: "#e8ffe8", marginBottom: 4 }}>{data.email}</div>
                {data.member_since && (
                  <div style={{ fontSize: 10, color: "#3a5040" }}>
                    Member since {new Date(data.member_since).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Plan card — PRO variant */}
              {data.plan === "pro" ? (
                <div style={{ ...card, borderColor: "rgba(0,255,136,0.3)", background: "rgba(0,255,136,0.03)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 22, fontWeight: 700, color: "#00ff88", letterSpacing: 3 }}>PRO</span>
                    <span style={{ fontSize: 9, background: "rgba(0,255,136,0.15)", border: "1px solid rgba(0,255,136,0.4)", color: "#00ff88", padding: "2px 8px", borderRadius: 2, letterSpacing: 2 }}>ACTIVE</span>
                  </div>
                  {data.subscription_status && data.subscription_status !== "active" && (
                    <div style={{ fontSize: 11, color: "#ffaa00", marginBottom: 6 }}>
                      Subscription status: <span style={{ color: "#e8ffe8" }}>{data.subscription_status}</span>
                    </div>
                  )}
                  {data.current_period_end && (
                    <div style={{ fontSize: 11, color: "#7aaa8a", marginBottom: 12 }}>
                      Renews{" "}
                      <span style={{ color: "#c8e8d0" }}>
                        {new Date(data.current_period_end).toLocaleDateString(undefined, { dateStyle: "medium" })}
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={portalLoading}
                    onClick={() => void openBillingPortal()}
                    style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "9px 18px", border: "1px solid #00bb66", background: "rgba(0,255,136,0.06)", color: "#00ff88", borderRadius: 3, cursor: portalLoading ? "wait" : "pointer", opacity: portalLoading ? 0.7 : 1 }}
                  >
                    {portalLoading ? "OPENING…" : "◈ MANAGE BILLING & INVOICES ▸"}
                  </button>
                  <div style={{ fontSize: 10, color: "#3a5040", marginTop: 8 }}>Change card · Download invoices · Cancel anytime</div>
                </div>
              ) : (
                /* Plan card — FREE variant */
                <div style={{ ...card, borderColor: "#1a3320" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 22, fontWeight: 700, color: "#5a8068", letterSpacing: 3 }}>FREE</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#7aaa8a", marginBottom: 16, lineHeight: 1.7 }}>
                    Upgrade to <strong style={{ color: "#00ff88" }}>PRO</strong> for unlimited Oracle triggers, full article highlights, Polymarket real-time odds, URL analyzer and board export.
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link
                      href="/"
                      style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "9px 18px", border: "1px solid #00bb66", background: "rgba(0,255,136,0.06)", color: "#00ff88", borderRadius: 3, textDecoration: "none", display: "inline-block" }}
                    >
                      ◐ UPGRADE TO PRO — $7/mo ▸
                    </Link>
                  </div>
                  <div style={{ fontSize: 10, color: "#3a5040", marginTop: 8 }}>Click PRO ▶ on any page to open Stripe Checkout. Cancel anytime.</div>
                </div>
              )}

              {/* Sign out */}
              <div style={card}>
                <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>SESSION</div>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "8px 16px", border: "1px solid #1a3320", background: "transparent", color: "#5a8068", borderRadius: 3, cursor: "pointer" }}
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
