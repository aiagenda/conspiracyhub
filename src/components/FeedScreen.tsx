"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthModal from "@/components/AuthModal";
import NewsCard from "@/components/NewsCard";
import UpgradeModal from "@/components/UpgradeModal";
import type { NewsItem } from "@/types";
import { pageContentShellStyle } from "@/lib/pageShell";
import { getReadIds, READ_ARTICLES_EVENT } from "@/lib/readArticles";
import { getCurrentUser, signOut } from "@/lib/auth";
import type { User } from "@supabase/supabase-js";

const TICKER_ITEMS = [
  "▸ AI-FILTERED CONSPIRACY FEED — LIVE",
  "◈ CIA FOIA INDEX — CROSS-REFERENCE ACTIVE",
  "▸ USPTO PATENT DATABASE — SCANNING",
  "◈ GUARDIAN FEED — 6 CATEGORIES MONITORED",
  "▸ GPT-4o PRIORITY SCORER — ONLINE",
  "◈ ONLY 55%+ PRIORITY SCORE ARTICLES SHOWN",
  "▸ DARPA CONTRACTS — PARTIALLY CLASSIFIED",
  "◈ THE THEORIST — AI INVESTIGATIVE INTELLIGENCE",
];

type HealthStatus = { guardian: string; scraper: string; oracle: string; community: string };

export default function FeedScreen({ initialItems }: { initialItems: NewsItem[] }) {
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"latest" | "priority">("latest");
  const [showAuth, setShowAuth] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const router = useRouter();
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    function sync() { setReadIds(new Set(getReadIds())); }
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(READ_ARTICLES_EVENT, sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(READ_ARTICLES_EVENT, sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const refreshUser = useCallback(() => {
    void getCurrentUser().then(setUser);
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  // Fetch plan from account API when user changes
  useEffect(() => {
    if (!user) { setUserPlan(null); return; }
    import("@/lib/supabase").then(({ getSupabaseBrowserClient }) => {
      getSupabaseBrowserClient().auth.getSession().then(({ data: { session } }) => {
        if (!session?.access_token) return;
        fetch("/api/account", { headers: { Authorization: `Bearer ${session.access_token}` } })
          .then(r => r.json())
          .then(d => setUserPlan(d.plan ?? null))
          .catch(() => {});
      });
    });
  }, [user]);

  // Dynamic status bar
  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(setHealth).catch(() => {});
  }, []);

  const sections = useMemo(
    () => ["all", ...new Set(initialItems.map((i) => i.section))],
    [initialItems]
  );
  const visible = useMemo(() => {
    const filtered =
      filter === "all" ? initialItems : initialItems.filter((i) => i.section === filter);
    return [...filtered].sort((a, b) => {
      if (sortBy === "priority") {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      const byDate = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (byDate !== 0) return byDate;
      return b.score - a.score;
    });
  }, [filter, initialItems, sortBy]);

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
            <style>{`
              @keyframes outbreakBlink { 0%,100%{border-color:#ff3333;box-shadow:0 0 6px rgba(255,51,51,0.4)} 50%{border-color:rgba(255,51,51,0.4);box-shadow:none} }
              @keyframes outbreakDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.3;transform:scale(0.7)} }
            `}</style>

            {/* Nav links — hidden on very small screens via className */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { href: "/uap", label: "UAP", color: "#8aa6ff", bg: "rgba(145,170,255,0.06)" },
                { href: "/outbreaks", label: "OUTBREAKS", color: "#ff3333", bg: "rgba(255,51,51,0.08)", blink: true },
                { href: "/community", label: "COMMUNITY", color: "#00bb66", bg: "transparent" },
                { href: "/search", label: "SEARCH", color: "#5a8068", bg: "transparent" },
                { href: "/guide", label: "GUIDE", color: "#5a8068", bg: "transparent" },
              ].map(({ href, label, color, bg, blink }) => (
                <Link key={href} href={href} style={{ background: bg, border: `1px solid ${color}55`, color, fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "6px 12px", borderRadius: 3, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 5, animation: blink ? "outbreakBlink 1.8s ease-in-out infinite" : undefined }}>
                  {blink && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#ff3333", display: "inline-block", animation: "outbreakDot 1s ease-in-out infinite" }} />}
                  {label}
                </Link>
              ))}
            </div>

            <div style={{ width: 1, height: 18, background: "#1a3320", flexShrink: 0 }} />

            {/* Auth + PRO */}
            {user ? (
              <>
                <Link href="/account" style={{ background: "transparent", border: "1px solid #1a3320", color: "#00bb66", fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "6px 12px", borderRadius: 3, textDecoration: "none" }}>
                  ACCOUNT
                </Link>
                <button type="button" onClick={() => void signOut().then(() => { refreshUser(); setUserPlan(null); })} style={{ background: "transparent", border: "1px solid #1a3320", color: "#5a8068", fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "6px 12px", borderRadius: 3, cursor: "pointer" }}>
                  SIGN OUT
                </button>
              </>
            ) : (
              <button onClick={() => setShowAuth(true)} style={{ background: "transparent", border: "1px solid #1a3320", color: "#5a8068", fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "6px 12px", borderRadius: 3, cursor: "pointer" }}>
                SIGN IN
              </button>
            )}

            {/* PRO button — only show if not already PRO */}
            {userPlan !== "pro" && (
              <button
                onClick={() => setShowUpgrade(true)}
                style={{ background: "rgba(0,255,136,0.06)", border: "1px solid #00bb66", color: "#00ff88", fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "6px 14px", borderRadius: 3, cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,255,136,0.14)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,255,136,0.06)"; }}
              >
                PRO ▶
              </button>
            )}
          </div>
        </header>

        {/* STATUS BAR — dynamic */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 10, color: "#5a8068", padding: "7px 20px", borderBottom: "1px solid #1a3320", background: "rgba(0,255,136,0.01)" }}>
          {([
            { label: "GUARDIAN API", key: "guardian" },
            { label: "GPT-4o", key: "oracle" },
            { label: "SCRAPER", key: "scraper" },
            { label: "COMMUNITY", key: "community" },
          ] as const).map(({ label, key }) => {
            const status = health ? health[key] : null;
            const col = !status ? "#3a5040" : status === "online" ? "#00ff88" : status === "degraded" || status === "idle" ? "#ffaa00" : "#ff3333";
            const pulse = status === "online";
            return (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span className={pulse ? "animate-pulse-dot" : ""} style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: col }} />
                <span style={{ color: status === "error" ? "#ff8888" : "#5a8068" }}>{label}</span>
                {status && status !== "online" && (
                  <span style={{ fontSize: 8, color: col, letterSpacing: 1 }}>[{status.toUpperCase()}]</span>
                )}
              </span>
            );
          })}
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
        <div style={pageContentShellStyle()}>

          {/* PAGE HEADER */}
          <div style={{ textAlign: "center", marginBottom: "1.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid #1a3320" }}>
            <div style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 6, color: "#5a8068", marginBottom: 6, textTransform: "uppercase" }}>
              ■ AI-CURATED CONSPIRACY INVESTIGATION FEED ■
            </div>
            <div style={{ fontSize: 11, color: "#3a6040", letterSpacing: 2 }}>
              LATEST FIRST · SWITCH TO PRIORITY SCORE WHEN NEEDED
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
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "#3a5040", letterSpacing: 1 }}>SORT</span>
                {[
                  { id: "latest", label: "LATEST" },
                  { id: "priority", label: "PRIORITY" },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSortBy(opt.id as "latest" | "priority")}
                    style={{
                      fontFamily: "var(--font-raj), sans-serif",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                      padding: "4px 9px",
                      borderRadius: 2,
                      border: `1px solid ${sortBy === opt.id ? "#00bb66" : "#1a3320"}`,
                      background: sortBy === opt.id ? "rgba(0,255,136,0.08)" : "transparent",
                      color: sortBy === opt.id ? "#00ff88" : "#5a8068",
                      cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {visible.length > 0 && (
                <span style={{ fontSize: 11, color: "#5a8068", letterSpacing: 1 }}>
                  {visible.length} ACTIVE SIGNALS
                </span>
              )}
            </div>
          </div>

          {/* EMPTY STATE */}
          {visible.length === 0 && (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "#5a8068", fontSize: 11, letterSpacing: 2 }}>
              <div style={{ marginBottom: 12 }}>◈ NO HIGH-PRIORITY ARTICLES IN THIS CATEGORY</div>
              <div style={{ fontSize: 9, color: "#2a4030", marginBottom: 20 }}>MULTI-SOURCE SCRAPER — NEW ITEMS AS FEEDS UPDATE — CHECK BACK SOON</div>
              {filter !== "all" && (
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "7px 16px", borderRadius: 3, border: "1px solid #1a3320", background: "transparent", color: "#5a8068", cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#00bb66"; (e.currentTarget as HTMLButtonElement).style.color = "#00ff88"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a3320"; (e.currentTarget as HTMLButtonElement).style.color = "#5a8068"; }}
                >
                  ← SHOW ALL CATEGORIES
                </button>
              )}
            </div>
          )}

          {/* NEWS GRID */}
          {visible.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "1.25rem" }}>
              {visible.map((item, idx) => (
                <NewsCard key={item.id} item={item} read={readIds.has(item.id)} onAnalyze={analyze} priority={idx < 3} />
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
      {showAuth && <AuthModal onClose={() => { setShowAuth(false); refreshUser(); }} />}
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} onUpgrade={startCheckout} />}
    </div>
  );
}
