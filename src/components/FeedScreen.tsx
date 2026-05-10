"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthModal from "@/components/AuthModal";
import NewsCard from "@/components/NewsCard";
import UpgradeModal from "@/components/UpgradeModal";
import type { NewsItem } from "@/types";

const TICKER_ITEMS = [
  "▸ AI-FILTERED CONSPIRACY FEED — LIVE",
  "◈ CIA FOIA INDEX — CROSS-REFERENCE ACTIVE",
  "▸ USPTO PATENT DATABASE — SCANNING",
  "◈ GUARDIAN FEED — 6 CATEGORIES MONITORED",
  "▸ GPT-4o THREAT SCORER — ONLINE",
  "◈ ONLY 55%+ THREAT SCORE ARTICLES SHOWN",
  "▸ DARPA CONTRACTS — PARTIALLY CLASSIFIED",
  "◈ THE THEORIST — AI INVESTIGATIVE INTELLIGENCE",
];

export default function FeedScreen({ initialItems }: { initialItems: NewsItem[] }) {
  const [filter, setFilter] = useState("all");
  const [showAuth, setShowAuth] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const router = useRouter();

  const sections = useMemo(
    () => ["all", ...new Set(initialItems.map((i) => i.section))],
    [initialItems]
  );
  const visible =
    filter === "all" ? initialItems : initialItems.filter((i) => i.section === filter);

  async function startCheckout() {
    const res = await fetch("/api/stripe/checkout", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  }

  function analyze(item: NewsItem) {
    router.push(`/article/${item.id}`);
  }

  return (
    <div className="min-h-screen" style={{ background: "#050c07", color: "#c8e8d0", fontFamily: "var(--font-share-tech-mono), monospace" }}>
      <div className="scanline" />
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* TOP NAV */}
        <header style={{ height: 48, background: "#050c07", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", padding: "0 20px", gap: 14 }}>
          <div style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 16, fontWeight: 700, color: "#00ff88", letterSpacing: 3, textTransform: "uppercase", textShadow: "0 0 14px rgba(0,255,136,0.3)" }}>
            THE THEORIST
          </div>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2 }}>AI INVESTIGATIVE INTELLIGENCE</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Link href="/search"
              style={{ background: "transparent", border: "1px solid #1a3320", color: "#5a8068", fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "6px 14px", borderRadius: 3, cursor: "pointer", textDecoration: "none", display: "inline-block" }}>
              ◈ SEARCH
            </Link>
            <Link href="/guide"
              style={{ background: "transparent", border: "1px solid #1a3320", color: "#5a8068", fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "6px 14px", borderRadius: 3, cursor: "pointer", textDecoration: "none", display: "inline-block" }}>
              ? GUIDE
            </Link>
            <Link href="/uap"
              style={{ background: "rgba(0,255,136,0.05)", border: "1px solid #00bb66", color: "#00ff88", fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "6px 14px", borderRadius: 3, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
              ◈ UAP FILES
            </Link>
            <Link href="/outbreaks"
              style={{ background: "rgba(255,51,51,0.08)", border: "1px solid #ff3333", color: "#ff3333", fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "6px 14px", borderRadius: 3, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6, animation: "outbreakBlink 1.8s ease-in-out infinite" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ff3333", display: "inline-block", animation: "outbreakDot 1s ease-in-out infinite" }} />
              OUTBREAKS
            </Link>
            <style>{`
              @keyframes outbreakBlink { 0%,100%{border-color:#ff3333;box-shadow:0 0 6px rgba(255,51,51,0.4)} 50%{border-color:rgba(255,51,51,0.4);box-shadow:none} }
              @keyframes outbreakDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.7)} }
            `}</style>
            <button
              onClick={() => setShowAuth(true)}
              style={{ background: "transparent", border: "1px solid #1a3320", color: "#5a8068", fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "6px 14px", borderRadius: 3, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#5a8068"; (e.currentTarget as HTMLButtonElement).style.color = "#c8e8d0"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a3320"; (e.currentTarget as HTMLButtonElement).style.color = "#5a8068"; }}
            >
              SIGN IN
            </button>
            <button
              onClick={() => setShowUpgrade(true)}
              style={{ background: "transparent", border: "1px solid #00bb66", color: "#00ff88", fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "6px 14px", borderRadius: 3, cursor: "pointer", transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,255,136,0.08)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              PRO ▶
            </button>
          </div>
        </header>

        {/* STATUS BAR */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 10, color: "#5a8068", padding: "7px 20px", borderBottom: "1px solid #1a3320", background: "rgba(0,255,136,0.01)" }}>
          {[
            { label: "GUARDIAN API", ok: true },
            { label: "GPT-4o", ok: true },
            { label: "CIA FOIA INDEX", ok: true },
            { label: "USPTO LIVE", ok: true },
          ].map(({ label, ok }) => (
            <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span className="animate-pulse-dot" style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: ok ? "#00ff88" : "#ff3333" }} />
              {label}
            </span>
          ))}
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#ff3333" }} />
            DARPA: <span style={{ background: "#1a3320", color: "transparent", userSelect: "none" }}>████████</span>
          </span>
        </div>

        {/* TICKER */}
        <div style={{ height: 26, borderBottom: "1px solid #1a3320", background: "#030803", overflow: "hidden", display: "flex", alignItems: "center" }}>
          <div style={{ fontSize: 9, color: "#1a4a2a", padding: "0 10px", borderRight: "1px solid #1a3320", whiteSpace: "nowrap", flexShrink: 0, letterSpacing: 1 }}>
            LIVE
          </div>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div className="animate-ticker" style={{ display: "flex", whiteSpace: "nowrap" }}>
              {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
                <span key={i} style={{ fontSize: 9, color: "#2a5035", letterSpacing: 1, padding: "0 28px" }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={{ maxWidth: 1520, margin: "0 auto", padding: "1.75rem clamp(1rem, 3vw, 2rem) 4rem" }}>

          {/* PAGE HEADER */}
          <div style={{ textAlign: "center", marginBottom: "1.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid #1a3320" }}>
            <div style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 6, color: "#5a8068", marginBottom: 6, textTransform: "uppercase" }}>
              ■ AI-CURATED CONSPIRACY INVESTIGATION FEED ■
            </div>
            <div style={{ fontSize: 11, color: "#3a6040", letterSpacing: 2 }}>
              ONLY ARTICLES WITH VERIFIED CONSPIRACY DOCUMENTATION ARE SHOWN
            </div>
          </div>

          {/* FILTERS + CONTROLS */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {sections.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  style={{
                    fontFamily: "var(--font-raj), sans-serif", fontSize: 12, fontWeight: 700,
                    letterSpacing: 2, textTransform: "uppercase", padding: "5px 12px", borderRadius: 3,
                    border: `1px solid ${filter === s ? "#00bb66" : "#1a3320"}`,
                    background: filter === s ? "rgba(0,255,136,0.08)" : "transparent",
                    color: filter === s ? "#00ff88" : "#5a8068", cursor: "pointer", transition: "all 0.15s"
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {visible.length > 0 && (
                <span style={{ fontSize: 11, color: "#5a8068", letterSpacing: 1 }}>
                  {visible.length} ACTIVE THREATS
                </span>
              )}
            </div>
          </div>

          {/* EMPTY STATE */}
          {visible.length === 0 && (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "#5a8068", fontSize: 11, letterSpacing: 2 }}>
              <div style={{ marginBottom: 8 }}>◈ NO HIGH-THREAT ARTICLES IN THIS CATEGORY</div>
              <div style={{ fontSize: 9, color: "#2a4030" }}>MULTI-SOURCE SCRAPER — NEW ITEMS AS FEEDS UPDATE — CHECK BACK SOON</div>
            </div>
          )}

          {/* NEWS GRID */}
          {visible.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" }}>
              {visible.map((item) => (
                <NewsCard key={item.id} item={item} onAnalyze={analyze} />
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        style={{
          position: "fixed",
          bottom: 24,
          right: 24,
          zIndex: 40,
          width: 40,
          height: 40,
          borderRadius: "50%",
          background: "rgba(9,15,11,0.9)",
          border: "1px solid #1a3320",
          color: "#5a8068",
          fontSize: 16,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
          backdropFilter: "blur(4px)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#00bb66";
          (e.currentTarget as HTMLButtonElement).style.color = "#00ff88";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a3320";
          (e.currentTarget as HTMLButtonElement).style.color = "#5a8068";
        }}
        title="Back to top"
      >
        ↑
      </button>
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} onUpgrade={startCheckout} />}
    </div>
  );
}
