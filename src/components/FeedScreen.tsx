"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import AuthModal from "@/components/AuthModal";
import NewsCard from "@/components/NewsCard";
import UpgradeModal from "@/components/UpgradeModal";
import HighestImpactCard from "@/components/HighestImpactCard";
import ContinueReadingBanner from "@/components/ContinueReadingBanner";
import type { NewsItem } from "@/types";
import { pageContentShellStyle } from "@/lib/pageShell";
import { redirectToStripeCheckout } from "@/lib/stripeCheckoutClient";
import { getReadIds, READ_ARTICLES_EVENT } from "@/lib/readArticles";
import { getCurrentUser, signOut } from "@/lib/auth";
import type { Session, User } from "@supabase/supabase-js";
import { SHOW_COMMUNITY } from "@/lib/featureFlags";

const TICKER_ITEMS = [
  "▸ AI-FILTERED CONSPIRACY FEED — LIVE",
  "◈ CIA FOIA INDEX — CROSS-REFERENCE ACTIVE",
  "▸ USPTO PATENT DATABASE — SCANNING",
  "◈ GUARDIAN FEED — 6 CATEGORIES MONITORED",
  "▸ GPT-4o PRIORITY SCORER — ONLINE",
  "◈ ONLY 70%+ PRIORITY SCORE ARTICLES SHOWN",
  "▸ DARPA CONTRACTS — PARTIALLY CLASSIFIED",
  "◈ THE THEORIST — AI INVESTIGATIVE INTELLIGENCE",
];

type HealthSourceKey =
  | "ingest"
  | "guardian_api"
  | "gnews"
  | "reddit"
  | "rss"
  | "scraper"
  | "oracle"
  | "community"
  | "uap";

type HealthStatus = {
  ingest: string;
  guardian_api: string;
  gnews: string;
  reddit: string;
  rss: string;
  scraper: string;
  oracle: string;
  community: string;
  uap: string;
  last_at?: Partial<Record<HealthSourceKey, string | null>>;
};

function formatHealthAge(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const sec = Math.floor((Date.now() - t) / 1000);
  if (sec < 45) return "just now";
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export type FeedNotice = "missing_supabase_env" | "empty_database";

export type FeedPagination = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export default function FeedScreen({
  initialItems,
  feedNotice,
  feedPagination,
  highestImpact,
}: {
  initialItems: NewsItem[];
  feedNotice?: FeedNotice;
  feedPagination?: FeedPagination;
  highestImpact?: NewsItem | null;
}) {
  const [sortBy, setSortBy] = useState<"latest" | "priority">("latest");
  const [showAuth, setShowAuth] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userLoaded, setUserLoaded] = useState(false);
  const [userPlan, setUserPlan] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  /** Re-render periodically so relative "Xm ago" labels advance without re-fetching /api/health. */
  const [healthAgeTick, setHealthAgeTick] = useState(0);
  const router = useRouter();
  const searchParams = useSearchParams();
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
    void getCurrentUser().then((u) => { setUser(u); setUserLoaded(true); });
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  useEffect(() => {
    const auth = searchParams.get("auth");
    if (auth === "signup" || auth === "signin") {
      setShowAuth(true);
    }
  }, [searchParams]);

  // Fetch plan from account API when user changes
  useEffect(() => {
    if (!user) {
      setUserPlan(null);
      return;
    }
    import("@/lib/supabase").then((mod) => {
      if (!mod.isSupabaseBrowserConfigured()) return;
      void mod
        .getSupabaseBrowserClient()
        .auth.getSession()
        .then((result: { data: { session: Session | null } }) => {
          const token = result.data.session?.access_token;
          if (!token) return;
          fetch("/api/account", { headers: { Authorization: `Bearer ${token}` } })
            .then((r) => r.json())
            .then((d) => setUserPlan(d.effective_plan ?? d.plan ?? null))
            .catch(() => {});
        });
    });
  }, [user]);

  // Dynamic status bar
  useEffect(() => {
    fetch("/api/health").then(r => r.json()).then(setHealth).catch(() => {});
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setHealthAgeTick((n) => n + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const visible = useMemo(() => {
    return [...initialItems].sort((a, b) => {
      if (sortBy === "priority") {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }
      const byDate = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (byDate !== 0) return byDate;
      return b.score - a.score;
    });
  }, [initialItems, sortBy]);

  function analyze(item: NewsItem) {
    router.push(`/article/${item.id}`);
  }

  return (
    <div className="min-h-screen" style={{ background: "#050c07", color: "#c8e8d0", fontFamily: "var(--font-share-tech-mono), monospace" }}>
      <div className="scanline" />
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* TOP NAV */}
        <header className="site-header" style={{ height: 48, background: "#050c07", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", padding: "0 20px", gap: 14, position: "sticky", top: 0, zIndex: 30 }}>
          <Link href="/" style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 16, fontWeight: 700, color: "#00ff88", letterSpacing: 3, textTransform: "uppercase", textShadow: "0 0 14px rgba(0,255,136,0.3)", textDecoration: "none", flexShrink: 0 }}>
            THE THEORIST
          </Link>
          <div style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <div className="site-header-subtitle" style={{ letterSpacing: 2, flexShrink: 0 }}>
            AI INVESTIGATIVE INTELLIGENCE
          </div>

          <div style={{ marginLeft: "auto", flexShrink: 0 }}>
            <SiteNav
              user={user}
              userPlan={userPlan}
              onSignIn={() => setShowAuth(true)}
              onUpgrade={() => setShowUpgrade(true)}
              onSignedOut={refreshUser}
            />
          </div>
        </header>

        {/* STATUS BAR — dynamic */}
        <div
          className="status-bar"
          data-age-tick={healthAgeTick}
          style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 10, padding: "7px 20px", borderBottom: "1px solid #1a3320", background: "rgba(0,255,136,0.01)" }}
        >
          {([
            { label: "INGEST", key: "ingest", tip: "Newest article in DB (any source), not last crawl." },
            { label: "GUARDIAN", key: "guardian_api", tip: "Newest Guardian-sourced row in DB by published_at." },
            { label: "GNEWS", key: "gnews", tip: "Newest Google News (RSS) row in DB — stays old if nothing new scores ≥ min." },
            { label: "REDDIT", key: "reddit", tip: "Newest Reddit-sourced row in DB by published_at." },
            { label: "RSS", key: "rss", tip: "Newest non-Guardian / non-GNews / non-Reddit feed row in DB." },
            { label: "SCRAPER", key: "scraper", tip: "Last news scraper job finished or started (scheduler)." },
            { label: "GPT-4o", key: "oracle", tip: "Latest oracle analysis created_at." },
            { label: "UAP", key: "uap", tip: "Last UAP full refresh (scheduler / intel cache), not last new NUFORC sighting." },
            ...(SHOW_COMMUNITY
              ? [{ label: "COMMUNITY", key: "community" as const, tip: "Latest community post (thread reply or new thread)." }]
              : []),
          ] as const).map(({ label, key, tip }) => {
            const status = health ? health[key] : null;
            const age = formatHealthAge(health?.last_at?.[key]);
            const col = !status ? "#6a9478" : status === "online" ? "#00ff88" : status === "degraded" || status === "idle" ? "#ffaa00" : "#ff3333";
            const pulse = status === "online";
            return (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }} title={tip}>
                <span className={pulse ? "animate-pulse-dot" : ""} style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: col }} />
                <span style={{ color: status === "error" ? "#ff8888" : "var(--muted, #7aaa8a)" }}>
                  {label}
                  {age ? <span style={{ color: "var(--muted-dim, #6a9478)", fontWeight: 400 }}> · {age}</span> : null}
                </span>
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
        <div className="ticker-bar" style={{ height: 26, borderBottom: "1px solid #1a3320", background: "#030803", overflow: "hidden", display: "flex", alignItems: "center" }}>
          <div style={{ padding: "0 10px", borderRight: "1px solid #1a3320", whiteSpace: "nowrap", flexShrink: 0, letterSpacing: 1 }}>
            LIVE
          </div>
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div className="animate-ticker" style={{ display: "flex", whiteSpace: "nowrap" }}>
              {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
                <span key={i} style={{ letterSpacing: 1, padding: "0 28px" }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div style={pageContentShellStyle()}>

          {/* PAGE HEADER */}
          <div style={{ textAlign: "center", marginBottom: "1.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid #1a3320" }}>
            <div className="feed-page-subhead" style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: 6, marginBottom: 6, textTransform: "uppercase" }}>
              ■ AI-CURATED CONSPIRACY INVESTIGATION FEED ■
            </div>
            <div className="feed-page-tagline" style={{ fontSize: 11, letterSpacing: 2 }}>
              LATEST FIRST · SWITCH TO PRIORITY SCORE WHEN NEEDED
            </div>
          </div>

          {(!feedPagination || feedPagination.page === 1) && highestImpact ? (
            <HighestImpactCard item={highestImpact} />
          ) : null}

          {(!feedPagination || feedPagination.page === 1) ? <ContinueReadingBanner /> : null}

          {/* SORT + COUNT */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
              <div style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "var(--muted-dim, #6a9478)", letterSpacing: 1 }}>SORT</span>
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
                      color: sortBy === opt.id ? "#00ff88" : "var(--muted, #7aaa8a)",
                      cursor: "pointer",
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {visible.length > 0 && (
                <span style={{ fontSize: 11, color: "var(--muted, #7aaa8a)", letterSpacing: 1 }}>
                  {feedPagination
                    ? `${visible.length} ON THIS PAGE · ${feedPagination.totalCount} TOTAL`
                    : `${visible.length} ACTIVE SIGNALS`}
                </span>
              )}
            </div>
          </div>

          {/* EMPTY STATE */}
          {visible.length === 0 && (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "var(--muted, #9ec8ae)", fontSize: 11, letterSpacing: 2 }}>
              {initialItems.length === 0 && feedNotice === "missing_supabase_env" ? (
                <>
                  <div style={{ marginBottom: 12, color: "#ffaa00" }}>◈ SERVER: SUPABASE NOT CONFIGURED</div>
                  <div style={{ fontSize: 10, color: "var(--muted-dim, #7aaa8a)", maxWidth: 420, margin: "0 auto 20px", lineHeight: 1.6 }}>
                    Set <span style={{ color: "var(--muted, #9ec8ae)" }}>NEXT_PUBLIC_SUPABASE_URL</span> and{" "}
                    <span style={{ color: "var(--muted, #9ec8ae)" }}>SUPABASE_SERVICE_KEY</span> on Vercel (Production), then redeploy.
                  </div>
                </>
              ) : initialItems.length === 0 && feedNotice === "empty_database" ? (
                <>
                  <div style={{ marginBottom: 12 }}>◈ NO ARTICLES IN DATABASE YET</div>
                  <div style={{ fontSize: 10, color: "var(--muted-dim, #7aaa8a)", maxWidth: 440, margin: "0 auto 16px", lineHeight: 1.6 }}>
                    Open <strong style={{ color: "var(--muted, #9ec8ae)" }}>Admin → Scrapers</strong> and use <strong style={{ color: "var(--muted, #9ec8ae)" }}>Run now</strong> on the news job, or wait for the daily cron (09:00 UTC). Ensure{" "}
                    <span style={{ color: "var(--muted, #9ec8ae)" }}>OPENAI_API_KEY</span>, <span style={{ color: "var(--muted, #9ec8ae)" }}>CRON_SECRET</span>, and migrations are applied on Supabase.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 12 }}>◈ NO ARTICLES TO SHOW</div>
                  <div style={{ fontSize: 9, color: "#2a4030", marginBottom: 20 }}>
                    MULTI-SOURCE SCRAPER — NEW ITEMS AS FEEDS UPDATE — CHECK BACK SOON
                  </div>
                </>
              )}
            </div>
          )}

          {/* NEWS GRID */}
          {visible.length > 0 && (
            <div
              className="feed-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
                gap: "1.25rem",
              }}
            >
              {visible.map((item, idx) => (
                <NewsCard key={item.id} item={item} read={readIds.has(item.id)} onAnalyze={analyze} priority={idx < 3} />
              ))}
            </div>
          )}

          {feedPagination && feedPagination.totalPages > 1 && (
            <div
              style={{
                marginTop: "2rem",
                paddingTop: "1.25rem",
                borderTop: "1px solid #1a3320",
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "center",
                gap: "12px 20px",
              }}
            >
              {/* Gate: guest on page 2+ sees a sign-in prompt */}
              {feedPagination.page > 1 && userLoaded && !user ? (
                <div
                  style={{
                    width: "100%",
                    maxWidth: 460,
                    border: "1px solid rgba(255,170,0,0.4)",
                    borderRadius: 6,
                    padding: "20px 22px",
                    textAlign: "center",
                    background: "linear-gradient(180deg, rgba(255,170,0,0.07) 0%, transparent 60%)",
                  }}
                >
                  <div style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: 4, color: "#ffaa33", marginBottom: 8 }}>
                    ⚠ FREE ACCOUNT REQUIRED
                  </div>
                  <div style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 16, fontWeight: 700, color: "#ffcc88", marginBottom: 10 }}>
                    SIGN IN TO BROWSE MORE PAGES
                  </div>
                  <div style={{ fontSize: 11, color: "#8aaa96", lineHeight: 1.7, marginBottom: 16 }}>
                    Page 1 is always free. Create a free account to access the full archive — no credit card needed.
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAuth(true)}
                    style={{
                      fontFamily: "var(--font-raj), sans-serif",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      padding: "10px 20px",
                      border: "1px solid #00bb66",
                      background: "rgba(0,255,136,0.08)",
                      color: "#00ff88",
                      borderRadius: 4,
                      cursor: "pointer",
                    }}
                  >
                    SIGN IN / SIGN UP — FREE
                  </button>
                </div>
              ) : (
                <>
                  <span style={{ fontSize: 10, color: "var(--muted-dim, #7aaa8a)", letterSpacing: 2, width: "100%", textAlign: "center" }}>
                    PAGE {feedPagination.page} / {feedPagination.totalPages}
                  </span>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {feedPagination.page > 1 ? (
                      <Link
                        href={feedPagination.page === 2 ? "/" : `/?page=${feedPagination.page - 1}`}
                        style={{
                          fontFamily: "var(--font-raj), sans-serif",
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          padding: "8px 18px",
                          borderRadius: 3,
                          border: "1px solid #00bb66",
                          background: "rgba(0,255,136,0.06)",
                          color: "#00ff88",
                          textDecoration: "none",
                        }}
                      >
                        ← PREV
                      </Link>
                    ) : (
                      <span
                        className="feed-pagination-muted"
                        style={{
                          fontFamily: "var(--font-raj), sans-serif",
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          padding: "8px 18px",
                          borderRadius: 3,
                          border: "1px solid #1a3320",
                          cursor: "default",
                        }}
                      >
                        ← PREV
                      </span>
                    )}
                    {feedPagination.page < feedPagination.totalPages ? (
                      userLoaded && !user ? (
                        /* Guest on page 1: show locked NEXT with sign-in prompt */
                        <button
                          type="button"
                          onClick={() => setShowAuth(true)}
                          style={{
                            fontFamily: "var(--font-raj), sans-serif",
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: 2,
                            textTransform: "uppercase",
                            padding: "8px 18px",
                            borderRadius: 3,
                            border: "1px solid rgba(255,170,0,0.5)",
                            background: "rgba(255,170,0,0.06)",
                            color: "#ffaa33",
                            cursor: "pointer",
                          }}
                          title="Sign in to browse more pages"
                        >
                          NEXT → 🔒
                        </button>
                      ) : (
                        <Link
                          href={`/?page=${feedPagination.page + 1}`}
                          style={{
                            fontFamily: "var(--font-raj), sans-serif",
                            fontSize: 12,
                            fontWeight: 700,
                            letterSpacing: 2,
                            textTransform: "uppercase",
                            padding: "8px 18px",
                            borderRadius: 3,
                            border: "1px solid #00bb66",
                            background: "rgba(0,255,136,0.06)",
                            color: "#00ff88",
                            textDecoration: "none",
                          }}
                        >
                          NEXT →
                        </Link>
                      )
                    ) : (
                      <span
                        className="feed-pagination-muted"
                        style={{
                          fontFamily: "var(--font-raj), sans-serif",
                          fontSize: 12,
                          fontWeight: 700,
                          letterSpacing: 2,
                          textTransform: "uppercase",
                          padding: "8px 18px",
                          borderRadius: 3,
                          border: "1px solid #1a3320",
                          cursor: "default",
                        }}
                      >
                        NEXT →
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        className="feed-scroll-top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        style={{
          position: "fixed",
          bottom: 72,
          right: 20,
          zIndex: 40,
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: "rgba(9,15,11,0.9)",
          border: "1px solid #1a3320",
          fontSize: 14,
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
          (e.currentTarget as HTMLButtonElement).style.color = "var(--muted-dim, #7aaa8a)";
        }}
        title="Back to top"
      >
        ↑
      </button>
      {showAuth && (
        <AuthModal
          initialTab={searchParams.get("auth") === "signup" ? "signup" : "signin"}
          onClose={() => {
            setShowAuth(false);
            refreshUser();
          }}
        />
      )}
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} onUpgrade={redirectToStripeCheckout} />}
    </div>
  );
}
