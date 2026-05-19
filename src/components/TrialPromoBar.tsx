"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getCurrentUser } from "@/lib/auth";
import { dismissPromoForDays, isPromoDismissed } from "@/lib/userPlan";

const RAJ = "var(--font-raj), sans-serif";
const MONO = "var(--font-share-tech-mono), monospace";

type AccountPeek = {
  effective_pro?: boolean;
  effective_plan?: string;
};

export default function TrialPromoBar() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isPromoDismissed()) {
      setVisible(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function run() {
      const user = await getCurrentUser();
      if (cancelled) return;
      if (!user) {
        setVisible(true);
        setLoading(false);
        return;
      }

      try {
        const { getSupabaseBrowserClient, isSupabaseBrowserConfigured } = await import("@/lib/supabase");
        if (!isSupabaseBrowserConfigured()) {
          setVisible(false);
          setLoading(false);
          return;
        }
        const { data: { session } } = await getSupabaseBrowserClient().auth.getSession();
        if (!session?.access_token) {
          setVisible(false);
          setLoading(false);
          return;
        }
        const res = await fetch("/api/account", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const d = (await res.json()) as AccountPeek;
        if (cancelled) return;
        setVisible(!d.effective_pro);
      } catch {
        if (!cancelled) setVisible(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || !visible) return null;

  function dismiss() {
    dismissPromoForDays(7);
    setVisible(false);
  }

  return (
    <div
      role="region"
      aria-label="Analyst Pass promotion"
      style={{
        background: "linear-gradient(90deg, rgba(0,255,136,0.12) 0%, rgba(201,77,255,0.08) 100%)",
        borderBottom: "1px solid rgba(0,187,102,0.35)",
        padding: "10px 16px",
        fontFamily: MONO,
        fontSize: 11,
        color: "#c8e8d0",
        position: "relative",
        zIndex: 40,
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        <div style={{ flex: "1 1 240px", minWidth: 0, lineHeight: 1.55 }}>
          <span style={{ fontFamily: RAJ, fontWeight: 700, color: "#00ff88", letterSpacing: 2, marginRight: 8 }}>
            ◈ NEW
          </span>
          Register free — get a <strong style={{ color: "#ffe8a0" }}>30-day Analyst Pass</strong> (full PRO).
          Run the Oracle, analyze URLs, unlock all article signals. No credit card.
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
          <Link
            href="/?auth=signup"
            style={{
              fontFamily: RAJ,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              padding: "7px 14px",
              borderRadius: 3,
              textDecoration: "none",
              border: "1px solid #00bb66",
              background: "rgba(0,255,136,0.15)",
              color: "#00ff88",
            }}
          >
            Register free
          </Link>
          <Link
            href="/guide"
            style={{
              fontFamily: RAJ,
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              padding: "7px 12px",
              borderRadius: 3,
              textDecoration: "none",
              border: "1px solid #1a3320",
              color: "#5a8068",
            }}
          >
            What&apos;s included
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss promotion for 7 days"
            style={{
              fontFamily: MONO,
              fontSize: 10,
              padding: "7px 10px",
              borderRadius: 3,
              border: "1px solid #1a3320",
              background: "transparent",
              color: "#5a8068",
              cursor: "pointer",
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
