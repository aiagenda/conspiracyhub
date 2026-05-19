"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

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

function PostCard({ post }: { post: Post }) {
  const isYT = post.tracker_type === "youtube";
  return (
    <a href={post.url} target="_blank" rel="noreferrer" style={{ display: "block", textDecoration: "none" }}>
      <div
        style={{ border: `1px solid ${post.color}22`, borderRadius: 4, background: "#090f0b", overflow: "hidden", transition: "all 0.15s", cursor: "pointer" }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = post.color; (e.currentTarget as HTMLDivElement).style.background = `${post.color}06`; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = `${post.color}22`; (e.currentTarget as HTMLDivElement).style.background = "#090f0b"; }}
      >
        {/* Thumbnail for YouTube */}
        {isYT && post.thumbnail && (
          <div style={{ position: "relative", height: 140, overflow: "hidden" }}>
            <img src={post.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.4) brightness(0.6)", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, #090f0b)" }} />
            <div style={{ position: "absolute", bottom: 8, left: 10, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12 }}>▶</span>
              <span style={{ fontFamily: FONT, fontSize: 9, color: "#ff3333", letterSpacing: 1 }}>YOUTUBE</span>
            </div>
          </div>
        )}

        <div style={{ padding: "10px 12px" }}>
          {/* Author row */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 7 }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{post.avatar}</span>
            <span style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: post.color, letterSpacing: 1 }}>
              {post.tracker_name}
            </span>
            <span style={{ fontSize: 8, color: "#3a5040", border: `1px solid #1a3320`, padding: "1px 5px", borderRadius: 2, letterSpacing: 1, textTransform: "uppercase" }}>
              {post.tracker_type === "youtube" ? "YT" : "X"}
            </span>
            <span style={{ fontSize: 9, color: "#3a5040", marginLeft: "auto", letterSpacing: 1 }}>{timeAgo(post.published)}</span>
          </div>

          {/* Title */}
          <div style={{ fontFamily: FONT, fontSize: 11, color: "#c8e8d0", lineHeight: 1.7, wordBreak: "break-word" }}>
            {post.title.slice(0, 140)}{post.title.length > 140 ? "…" : ""}
          </div>

          <div style={{ marginTop: 8, fontSize: 9, color: post.color, letterSpacing: 1 }}>↗ {isYT ? "WATCH" : "VIEW POST"}</div>
        </div>
      </div>
    </a>
  );
}

export default function InsiderRadar() {
  const [posts, setPosts]       = useState<Post[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<"all" | "youtube" | "twitter">("all");
  const [catFilter, setCatFilter] = useState<string>("all");

  useEffect(() => {
    fetch("/api/insider-radar")
      .then(r => r.json())
      .then(d => { setPosts(d.posts ?? []); setTrackers(d.trackers ?? []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const visible = posts.filter(p => {
    if (filter !== "all" && p.tracker_type !== filter) return false;
    if (catFilter !== "all" && p.category !== catFilter) return false;
    return true;
  });

  const cats = [...new Set(trackers.map(t => t.category))];

  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* NAV */}
        <div style={{ height: 44, background: "#050c07", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", padding: "0 16px", gap: 12, position: "sticky", top: 0, zIndex: 30 }}>
          <Link href="/" style={{ fontSize: 10, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3 }}>← FEED</Link>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>THE THEORIST</div>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontFamily: RAJ, fontSize: 11, color: "#5a8068", letterSpacing: 2 }}>INSIDER RADAR</div>
          <div style={{ marginLeft: "auto", fontSize: 9, color: "#3a5040", letterSpacing: 1, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: loading ? "#3a5040" : "#00ff88", display: "inline-block" }} />
            {loading ? "LOADING..." : `${posts.length} SIGNALS`}
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>

          {/* HEADER */}
          <div style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid #1a3320" }}>
            <div style={{ fontFamily: RAJ, fontSize: 10, letterSpacing: 5, color: "#5a8068", marginBottom: 5, textTransform: "uppercase" }}>■ REAL-TIME INTELLIGENCE SIGNALS ■</div>
            <h1 style={{ fontFamily: RAJ, fontSize: 24, fontWeight: 700, color: "#00ff88", letterSpacing: 2, textTransform: "uppercase", textShadow: "0 0 16px rgba(0,255,136,0.2)", margin: "0 0 4px" }}>Insider Radar</h1>
            <div style={{ fontSize: 9, color: "#3a5040", letterSpacing: 2 }}>LIVE POSTS FROM CREDIBLE UAP RESEARCHERS · WHISTLEBLOWERS · INVESTIGATIVE JOURNALISTS · CONGRESS</div>
          </div>

          {/* TRACKER BADGES */}
          {trackers.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: "1.25rem" }}>
              {trackers.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", border: `1px solid ${t.color}33`, borderRadius: 3, background: `${t.color}08` }}>
                  <span style={{ fontSize: 12 }}>{t.avatar}</span>
                  <span style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, color: t.color, letterSpacing: 1 }}>{t.name}</span>
                  <span style={{ fontSize: 8, color: "#3a5040" }}>{t.post_count}</span>
                </div>
              ))}
            </div>
          )}

          {/* FILTERS */}
          <div style={{ display: "flex", gap: 6, marginBottom: "1rem", flexWrap: "wrap" }}>
            {[
              { key: "all",     label: "ALL" },
              { key: "youtube", label: "▶ YOUTUBE" },
              { key: "twitter", label: "✕ X / TWITTER" },
            ].map(f => (
              <button key={f.key} onClick={() => setFilter(f.key as typeof filter)}
                style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", padding: "5px 12px", borderRadius: 2, cursor: "pointer", border: `1px solid ${filter === f.key ? "#00bb66" : "#1a3320"}`, background: filter === f.key ? "rgba(0,255,136,0.06)" : "transparent", color: filter === f.key ? "#00ff88" : "#5a8068" }}>
                {f.label}
              </button>
            ))}
            <div style={{ width: 1, height: 28, background: "#1a3320" }} />
            {["all", ...cats].map(c => (
              <button key={c} onClick={() => setCatFilter(c)}
                style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", padding: "5px 12px", borderRadius: 2, cursor: "pointer", border: `1px solid ${catFilter === c ? "#8aa6ff" : "#1a3320"}`, background: catFilter === c ? "rgba(138,166,255,0.06)" : "transparent", color: catFilter === c ? "#8aa6ff" : "#5a8068" }}>
                {c.toUpperCase()}
              </button>
            ))}
          </div>

          {/* LOADING */}
          {loading && (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "#3a5040", fontSize: 10, letterSpacing: 2 }}>
              <div style={{ marginBottom: 12 }}>[ SCANNING INSIDER CHANNELS... ]</div>
              {["Connecting to YouTube RSS...", "Fetching Twitter/X feeds...", "Sorting by relevance..."].map((l, i) => (
                <div key={i} style={{ color: "#1a3a20", marginBottom: 5 }}>{l}</div>
              ))}
            </div>
          )}

          {/* NO RESULTS */}
          {!loading && visible.length === 0 && (
            <div style={{ textAlign: "center", padding: "3rem 0", color: "#3a5040", fontSize: 10, letterSpacing: 2 }}>
              NO SIGNALS AVAILABLE — CHANNELS MAY BE RATE LIMITED
            </div>
          )}

          {/* POSTS GRID */}
          {!loading && visible.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
              {visible.map((post, i) => (
                <PostCard key={`${post.tracker_id}-${i}`} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
