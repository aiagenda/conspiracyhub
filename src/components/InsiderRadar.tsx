"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { CollapsibleSection } from "@/components/IntelAccordion";
import { pageContentShellStyle } from "@/lib/pageShell";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ  = "var(--font-raj), sans-serif";

interface Post {
  title: string; url: string; published: string; thumbnail?: string;
  tracker_id: string; tracker_name: string; tracker_type: string;
  avatar: string; color: string; category: string;
}
interface Tracker {
  id: string; name: string; type: string; color: string; avatar: string;
  category: string; post_count: number;
}

function timeAgo(d: string) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function useIsMobile(breakpoint = 768) {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const sync = () => setMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [breakpoint]);
  return mobile;
}

function PostCard({ post }: { post: Post }) {
  const isYT = post.tracker_type === "youtube";
  return (
    <a href={post.url} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none" }}>
      <div
        style={{ border: `1px solid ${post.color}33`, borderRadius: 4, background: "#090f0b", overflow: "hidden", transition: "all 0.15s", cursor: "pointer", height: "100%", display: "flex", flexDirection: "column" }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = post.color; (e.currentTarget as HTMLDivElement).style.background = `${post.color}08`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${post.color}33`; (e.currentTarget as HTMLDivElement).style.background = "#090f0b"; }}
      >
        {isYT && post.thumbnail && (
          <div style={{ position: "relative", height: 168, overflow: "hidden", flexShrink: 0 }}>
            <img src={post.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.35) brightness(0.55)", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 35%, #090f0b)" }} />
            <div style={{ position: "absolute", bottom: 10, left: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14 }}>▶</span>
              <span style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: "#ff3333", letterSpacing: 1 }}>YOUTUBE</span>
            </div>
          </div>
        )}

        <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>{post.avatar}</span>
            <span style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: post.color, letterSpacing: 1 }}>
              {post.tracker_name}
            </span>
            <span style={{ fontSize: 10, color: "#5a8068", border: "1px solid #1a3320", padding: "2px 7px", borderRadius: 2, letterSpacing: 1, textTransform: "uppercase", fontFamily: RAJ, fontWeight: 700 }}>
              {post.tracker_type === "youtube" ? "YT" : "X"}
            </span>
            <span style={{ fontSize: 11, color: "#5a8068", marginLeft: "auto", letterSpacing: 1 }}>{timeAgo(post.published)}</span>
          </div>

          <h3 style={{ fontFamily: RAJ, fontSize: 17, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.4, margin: 0, wordBreak: "break-word" }}>
            {post.title}
          </h3>

          <div style={{ marginTop: "auto", fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: post.color, letterSpacing: 1 }}>
            ↗ {isYT ? "WATCH" : "VIEW POST"}
          </div>
        </div>
      </div>
    </a>
  );
}

function TrackerChipRow({
  trackers,
  trackerFilter,
  onToggle,
}: {
  trackers: Tracker[];
  trackerFilter: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="insider-tracker-chips" style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
      {trackers.map((t) => {
        const on = trackerFilter === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onToggle(t.id)}
            title={on ? `Clear filter (${t.name})` : `Show only ${t.name}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              border: `1px solid ${on ? t.color : `${t.color}44`}`,
              borderRadius: 3,
              background: on ? `${t.color}22` : `${t.color}0a`,
              cursor: "pointer",
              transition: "all 0.15s",
              boxShadow: on ? `0 0 12px ${t.color}33` : undefined,
            }}
          >
            <span style={{ fontSize: 14 }}>{t.avatar}</span>
            <span style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: t.color, letterSpacing: 1 }}>{t.name}</span>
            <span style={{ fontSize: 10, color: on ? t.color : "var(--muted-dim, #7aaa8a)" }}>{t.post_count}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function InsiderRadar() {
  const [posts, setPosts]       = useState<Post[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading]   = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null);
  const [cacheHint, setCacheHint] = useState<string | null>(null);
  const [filter, setFilter]     = useState<"all" | "youtube" | "twitter">("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [trackerFilter, setTrackerFilter] = useState<string | null>(null);
  const [warmError, setWarmError] = useState<string | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    fetch("/api/insider-radar")
      .then(r => r.json())
      .then(d => {
        setPosts(d.posts ?? []);
        setTrackers(d.trackers ?? []);
        setRefreshedAt(d.refreshed_at ?? null);
        const hint =
          d.hint ??
          ((d.x_twitter_posts ?? 0) === 0
            ? "X posts not loaded yet — Admin → Automation → Insider Radar → Run now, or reload after daily refresh."
            : null);
        setCacheHint(hint ?? d.warm_error ?? null);
        setWarmError(d.warm_error ?? d.error ?? null);
      })
      .catch(() => setWarmError("Network error loading feed"))
      .finally(() => setLoading(false));
  }, []);

  const visible = posts.filter(p => {
    if (trackerFilter && p.tracker_id !== trackerFilter) return false;
    if (filter !== "all" && p.tracker_type !== filter) return false;
    if (catFilter !== "all" && p.category !== catFilter) return false;
    return true;
  });

  const sortedTrackers = [...trackers].sort((a, b) => b.post_count - a.post_count || a.name.localeCompare(b.name));
  const cats = [...new Set(trackers.map(t => t.category))];
  const activeTracker = trackerFilter ? trackers.find(t => t.id === trackerFilter) : null;

  const toggleTracker = (id: string) => {
    setTrackerFilter((current) => (current === id ? null : id));
  };

  const signalMeta = loading
    ? "LOADING..."
    : refreshedAt
      ? `${posts.length} SIGNALS · ${new Date(refreshedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
      : `${posts.length} SIGNALS`;

  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
      <div style={{ position: "relative", zIndex: 1 }}>

        <header
          className="ob-tracker-nav intel-page-nav"
          style={{
            height: 44,
            background: "#050c07",
            borderBottom: "1px solid #1a3320",
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 12,
          }}
        >
          <div className="intel-page-nav-start" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
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
          </div>
          <div className="intel-page-nav-divider" style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <Link
            href="/"
            className="intel-page-nav-brand"
            style={{
              fontFamily: RAJ,
              fontSize: 14,
              fontWeight: 700,
              color: "#00ff88",
              letterSpacing: 2,
              textDecoration: "none",
              textShadow: "0 0 14px rgba(0,255,136,0.3)",
              flexShrink: 0,
            }}
          >
            THE THEORIST
          </Link>
          <div className="intel-page-nav-divider" style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          <div className="intel-page-nav-section" style={{ fontFamily: RAJ, fontSize: 11, color: "#5a8068", letterSpacing: 2, flexShrink: 0 }}>
            INSIDER RADAR
          </div>
          <div className="intel-page-nav-menu" style={{ marginLeft: "auto", flexShrink: 0 }}>
            <SiteNav />
          </div>
          <div
            className="ob-nav-time intel-page-nav-meta"
            style={{
              fontSize: 10,
              color: "#5a8068",
              letterSpacing: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: loading ? "#3a5040" : "#00ff88",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            {signalMeta}
          </div>
        </header>

        <div style={pageContentShellStyle()}>

          <div style={{ textAlign: "center", marginBottom: "1.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid #1a3320" }}>
            <div className="insider-hero-kicker" style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 600, letterSpacing: 6, color: "#5a8068", marginBottom: 6, textTransform: "uppercase" }}>
              ■ CACHED INTELLIGENCE SIGNALS ■
            </div>
            <h1 className="insider-page-headline" style={{ fontFamily: RAJ, fontSize: 26, fontWeight: 700, color: "#00ff88", letterSpacing: 2, textTransform: "uppercase", textShadow: "0 0 18px rgba(0,255,136,0.25)", margin: "0 0 8px" }}>Insider Radar</h1>
            <div className="insider-hero-tagline" style={{ fontSize: 11, color: "#5a8068", letterSpacing: 2, lineHeight: 1.6, maxWidth: 720, margin: "0 auto" }}>
              UAP INSIDERS · MEDIA · GEOPOLITICS · COMMENTATORS — CACHE REFRESHED DAILY (09:00 UTC)
            </div>
          </div>

          {sortedTrackers.length > 0 && (
            <div style={{ marginBottom: "1.25rem" }}>
              {!isMobile && (
                <div className="insider-tracker-desktop">
                  <div style={{ fontSize: 10, color: "var(--muted-dim, #7aaa8a)", letterSpacing: 2, textAlign: "center", marginBottom: 8 }}>
                    {trackerFilter
                      ? <>FILTERING: <span style={{ color: activeTracker?.color ?? "#00ff88" }}>{activeTracker?.name ?? "—"}</span> · click again to clear</>
                      : "CLICK A NAME TO FILTER POSTS"}
                  </div>
                  <TrackerChipRow trackers={sortedTrackers} trackerFilter={trackerFilter} onToggle={toggleTracker} />
                </div>
              )}
              {isMobile && (
                <CollapsibleSection
                  title="Filter by insider"
                  count={sortedTrackers.length}
                  accent="#ffaa00"
                  defaultOpen={!!trackerFilter}
                  subtitle={
                    trackerFilter
                      ? `Active: ${activeTracker?.name ?? "—"} · tap to change`
                      : "Tap to browse sources"
                  }
                >
                  <TrackerChipRow trackers={sortedTrackers} trackerFilter={trackerFilter} onToggle={toggleTracker} />
                </CollapsibleSection>
              )}
            </div>
          )}

          <div className="category-filter insider-type-filter" style={{ display: "flex", gap: 8, marginBottom: "1.25rem", flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { key: "all",     label: "ALL" },
              { key: "youtube", label: "▶ YOUTUBE" },
              { key: "twitter", label: "✕ X" },
            ].map(f => (
              <button key={f.key} type="button" onClick={() => setFilter(f.key as typeof filter)}
                style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", padding: "6px 14px", borderRadius: 2, cursor: "pointer", border: `1px solid ${filter === f.key ? "#00bb66" : "#1a3320"}`, background: filter === f.key ? "rgba(0,255,136,0.08)" : "transparent", color: filter === f.key ? "#00ff88" : "#5a8068", flexShrink: 0 }}>
                {f.label}
              </button>
            ))}
            <div className="insider-filter-divider" style={{ width: 1, height: 32, background: "#1a3320", flexShrink: 0 }} />
            {["all", ...cats].map(c => (
              <button key={c} type="button" onClick={() => setCatFilter(c)}
                style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", padding: "6px 14px", borderRadius: 2, cursor: "pointer", border: `1px solid ${catFilter === c ? "#8aa6ff" : "#1a3320"}`, background: catFilter === c ? "rgba(138,166,255,0.08)" : "transparent", color: catFilter === c ? "#8aa6ff" : "#5a8068", flexShrink: 0 }}>
                {c.toUpperCase()}
              </button>
            ))}
          </div>

          {loading && (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "#5a8068", fontSize: 11, letterSpacing: 2 }}>
              <div style={{ marginBottom: 12 }}>[ LOADING INSIDER FEED... ]</div>
              <p style={{ color: "#3a6040", marginBottom: 10, fontSize: 10 }}>
                First visit may take up to 60s while the cache warms (YouTube + X).
              </p>
              {["Reading cache or fetching sources...", "YouTube RSS + X timelines...", "Sorting by relevance..."].map((l, i) => (
                <div key={i} style={{ color: "#3a6040", marginBottom: 5, fontSize: 11 }}>{l}</div>
              ))}
            </div>
          )}

          {!loading && visible.length === 0 && (
            <div style={{ textAlign: "center", padding: "3rem 0", color: "var(--muted, #9ec8ae)", fontSize: 11, letterSpacing: 2, maxWidth: 520, margin: "0 auto", lineHeight: 1.7 }}>
              {trackerFilter
                ? `NO POSTS FOR ${activeTracker?.name?.toUpperCase() ?? "THIS INSIDER"} WITH CURRENT FILTERS`
                : warmError
                  ? `FEED ERROR: ${warmError}`
                  : cacheHint ?? "NO SIGNALS — TRY ADMIN → AUTOMATION → INSIDER RADAR → RUN NOW"}
            </div>
          )}

          {!loading && visible.length > 0 && (
            <div
              className="feed-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))",
                gap: "1.25rem",
              }}
            >
              {visible.map((post, i) => (
                <PostCard key={`${post.tracker_id}-${post.url}-${i}`} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
