"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
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

        <header className="site-header" style={{ height: 48, background: "#050c07", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", padding: "0 20px", gap: 14, position: "sticky", top: 0, zIndex: 30 }}>
          <Link href="/" style={{ fontSize: 11, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "5px 12px", borderRadius: 3 }}>← FEED</Link>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <Link href="/" style={{ fontFamily: RAJ, fontSize: 16, fontWeight: 700, color: "#00ff88", letterSpacing: 2, textDecoration: "none", textShadow: "0 0 14px rgba(0,255,136,0.3)" }}>THE THEORIST</Link>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontFamily: RAJ, fontSize: 12, color: "#5a8068", letterSpacing: 2 }}>INSIDER RADAR</div>
          <div style={{ marginLeft: "auto", fontSize: 11, color: "#5a8068", letterSpacing: 1, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: loading ? "#3a5040" : "#00ff88", display: "inline-block" }} />
            {loading ? "LOADING..." : `${posts.length} SIGNALS`}
          </div>
        </header>

        <div style={pageContentShellStyle()}>

          <div style={{ textAlign: "center", marginBottom: "1.5rem", paddingBottom: "1.5rem", borderBottom: "1px solid #1a3320" }}>
            <div style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 600, letterSpacing: 6, color: "#5a8068", marginBottom: 6, textTransform: "uppercase" }}>
              ■ REAL-TIME INTELLIGENCE SIGNALS ■
            </div>
            <h1 style={{ fontFamily: RAJ, fontSize: 26, fontWeight: 700, color: "#00ff88", letterSpacing: 2, textTransform: "uppercase", textShadow: "0 0 18px rgba(0,255,136,0.25)", margin: "0 0 8px" }}>Insider Radar</h1>
            <div style={{ fontSize: 11, color: "#5a8068", letterSpacing: 2, lineHeight: 1.6, maxWidth: 720, margin: "0 auto" }}>
              LIVE POSTS FROM CREDIBLE UAP RESEARCHERS · WHISTLEBLOWERS · INVESTIGATIVE JOURNALISTS · CONGRESS
            </div>
          </div>

          {trackers.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: "1.25rem", justifyContent: "center" }}>
              {trackers.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", border: `1px solid ${t.color}44`, borderRadius: 3, background: `${t.color}0a` }}>
                  <span style={{ fontSize: 14 }}>{t.avatar}</span>
                  <span style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: t.color, letterSpacing: 1 }}>{t.name}</span>
                  <span style={{ fontSize: 10, color: "#5a8068" }}>{t.post_count}</span>
                </div>
              ))}
            </div>
          )}

          <div className="category-filter" style={{ display: "flex", gap: 8, marginBottom: "1.25rem", flexWrap: "wrap", justifyContent: "center" }}>
            {[
              { key: "all",     label: "ALL" },
              { key: "youtube", label: "▶ YOUTUBE" },
              { key: "twitter", label: "✕ X" },
            ].map(f => (
              <button key={f.key} type="button" onClick={() => setFilter(f.key as typeof filter)}
                style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", padding: "6px 14px", borderRadius: 2, cursor: "pointer", border: `1px solid ${filter === f.key ? "#00bb66" : "#1a3320"}`, background: filter === f.key ? "rgba(0,255,136,0.08)" : "transparent", color: filter === f.key ? "#00ff88" : "#5a8068" }}>
                {f.label}
              </button>
            ))}
            <div style={{ width: 1, height: 32, background: "#1a3320", flexShrink: 0 }} />
            {["all", ...cats].map(c => (
              <button key={c} type="button" onClick={() => setCatFilter(c)}
                style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", padding: "6px 14px", borderRadius: 2, cursor: "pointer", border: `1px solid ${catFilter === c ? "#8aa6ff" : "#1a3320"}`, background: catFilter === c ? "rgba(138,166,255,0.08)" : "transparent", color: catFilter === c ? "#8aa6ff" : "#5a8068" }}>
                {c.toUpperCase()}
              </button>
            ))}
          </div>

          {loading && (
            <div style={{ textAlign: "center", padding: "4rem 0", color: "#5a8068", fontSize: 11, letterSpacing: 2 }}>
              <div style={{ marginBottom: 12 }}>[ SCANNING INSIDER CHANNELS... ]</div>
              {["Connecting to YouTube RSS...", "Fetching X / insider feeds...", "Sorting by relevance..."].map((l, i) => (
                <div key={i} style={{ color: "#3a6040", marginBottom: 5, fontSize: 11 }}>{l}</div>
              ))}
            </div>
          )}

          {!loading && visible.length === 0 && (
            <div style={{ textAlign: "center", padding: "3rem 0", color: "#5a8068", fontSize: 11, letterSpacing: 2 }}>
              NO SIGNALS AVAILABLE — CHANNELS MAY BE RATE LIMITED
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
