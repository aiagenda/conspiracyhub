"use client";

import { useEffect } from "react";

const FEATURES = [
  { icon: "◈", text: "Full Oracle investigation board — visual node graph with CIA/USPTO links" },
  { icon: "▸", text: "3 AI-generated conspiracy theories with probability scores per article" },
  { icon: "◈", text: "Polymarket-style betting on each theory (REAL / NOT REAL)" },
  { icon: "▸", text: "Email alerts when high-threat articles (75%+) are detected" },
  { icon: "◈", text: "All analyses cached — no repeated API costs" },
  { icon: "▸", text: "Unlimited investigations · Cancel anytime" },
];

export default function UpgradeModal({
  onClose,
  onUpgrade,
}: {
  onClose: () => void;
  onUpgrade: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(4,11,6,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="animate-fade-slide-in"
        style={{ width: "100%", maxWidth: 460, background: "#090f0b", border: "1px solid #1a3320", borderRadius: 4, overflow: "hidden" }}
      >
        {/* HEADER */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a3320", background: "#050c07", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, color: "#00bb66", letterSpacing: 4, textTransform: "uppercase" }}>
            ◈ PRO ACCESS REQUIRED
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid #1a3320", color: "#5a8068", fontFamily: "inherit", fontSize: 10, padding: "3px 8px", borderRadius: 2, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
          {/* PITCH */}
          <div style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 16, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.4 }}>
            Unlock the full investigation board
          </div>
          <div style={{ fontSize: 11, color: "#5a8068", lineHeight: 1.75 }}>
            The free tier shows the feed and threat scores. Pro unlocks the AI-powered investigation board with visual node graphs, evidence chains, and conspiracy probability scoring.
          </div>

          {/* FEATURES */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {FEATURES.map((f, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 11, color: "#7aaa8a" }}>
                <span style={{ color: "#00bb66", flexShrink: 0, marginTop: 1 }}>{f.icon}</span>
                <span>{f.text}</span>
              </div>
            ))}
          </div>

          {/* PRICE */}
          <div style={{ padding: "14px", border: "1px solid #1a3320", borderRadius: 4, background: "rgba(0,255,136,0.02)", display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 40, fontWeight: 700, color: "#00ff88", lineHeight: 1 }}>$7</span>
            <span style={{ fontSize: 11, color: "#5a8068", letterSpacing: 1 }}>/month · cancel anytime</span>
          </div>

          {/* CTA */}
          <button
            onClick={onUpgrade}
            style={{ padding: "12px", background: "transparent", border: "1px solid #00bb66", color: "#00ff88", fontFamily: "var(--font-raj), sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", borderRadius: 3, cursor: "pointer", transition: "all 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,255,136,0.08)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            ACTIVATE PRO SUBSCRIPTION ▶
          </button>

          <div style={{ fontSize: 9, color: "#3a5040", letterSpacing: 1, textAlign: "center" }}>
            SECURE CHECKOUT VIA STRIPE · 256-BIT ENCRYPTION
          </div>
        </div>
      </div>
    </div>
  );
}
