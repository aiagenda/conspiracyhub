"use client";
import { useCallback, useEffect, useState, useRef, type CSSProperties } from "react";
import Link from "next/link";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ  = "var(--font-raj), sans-serif";

type Category = "all"|"sighting"|"document"|"theory"|"question"|"tip";

interface Thread {
  id: string; title: string; body: string;
  author_name: string; category: string; status: string;
  location?: string; tags: string[];
  upvotes: number; credibility_score: number;
  oracle_analyzed: boolean; post_count: number;
  created_at: string; updated_at: string;
}

interface Post {
  id: string; thread_id: string;
  author_name: string; author_type: string;
  content: string; attachment_url?: string;
  upvotes: number; created_at: string;
}

const CAT_COLORS: Record<string,string> = {
  sighting: "#00ff88", document: "#ff3333", theory: "#c94dff",
  question: "#ffaa00", tip: "#00bb66",
};
const CAT_LABELS: Record<string,string> = {
  sighting: "👁 SIGHTING", document: "📄 DOCUMENT", theory: "🔮 THEORY",
  question: "❓ QUESTION", tip: "💡 TIP",
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

// ── POST RENDERER ─────────────────────────────────────────────
function PostContent({ content, isOracle }: { content: string; isOracle: boolean }) {
  if (!isOracle) return <div style={{ fontFamily: FONT, fontSize: 11, color: "#c8e8d0", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{content}</div>;

  // Parse Oracle markdown-style response
  const lines = content.split("\n");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {lines.map((line, i) => {
        if (!line.trim()) return null;
        if (line.startsWith("**") && line.endsWith("**")) {
          return <div key={i} style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: "#00ff88", letterSpacing: 1, marginTop: 4 }}>{line.replace(/\*\*/g,"")}</div>;
        }
        if (line.startsWith("▸ ")) return (
          <div key={i} style={{ display: "flex", gap: 7, fontSize: 11, color: "#7aaa8a", lineHeight: 1.6 }}>
            <span style={{ color: "#00bb66", flexShrink: 0 }}>▸</span><span>{line.slice(2)}</span>
          </div>
        );
        if (line.startsWith("→ ")) return (
          <div key={i} style={{ display: "flex", gap: 7, fontSize: 11, color: "#7aaa8a", lineHeight: 1.6 }}>
            <span style={{ color: "#ffaa00", flexShrink: 0 }}>→</span><span>{line.slice(2)}</span>
          </div>
        );
        if (line.startsWith("↗ [")) {
          const match = line.match(/↗ \[([^\]]+)\]\(([^)]+)\)(.*)/);
          if (match) return (
            <a key={i} href={match[2]} target="_blank" rel="noreferrer"
              style={{ display: "flex", gap: 7, color: "#00bb66", fontSize: 10, textDecoration: "none", padding: "5px 8px", border: "1px solid rgba(0,187,102,0.2)", borderRadius: 3, background: "rgba(0,187,102,0.04)" }}>
              <span>↗</span><span style={{ fontWeight: 700 }}>{match[1]}</span>
              {match[3] && <span style={{ color: "#5a8068" }}>{match[3]}</span>}
            </a>
          );
        }
        // Bold inline
        if (line.includes("**")) {
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          return (
            <div key={i} style={{ fontFamily: FONT, fontSize: 11, color: "#c8e8d0", lineHeight: 1.75 }}>
              {parts.map((p, j) => p.startsWith("**") ? <strong key={j} style={{ color: "#00ff88" }}>{p.replace(/\*\*/g,"")}</strong> : p)}
            </div>
          );
        }
        return <div key={i} style={{ fontFamily: FONT, fontSize: 11, color: "#c8e8d0", lineHeight: 1.75 }}>{line}</div>;
      })}
    </div>
  );
}

// ── THREAD DETAIL ─────────────────────────────────────────────
function ThreadDetail({ thread, onBack }: { thread: Thread; onBack: () => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [name, setName] = useState("Anonymous");
  const [posting, setPosting] = useState(false);
  const [oracleTyping, setOracleTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/threads?id=${thread.id}`)
      .then(r => r.json())
      .then(d => setPosts(d.posts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [thread.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [posts]);

  async function submit() {
    if (!reply.trim() || posting) return;
    const mentionsOracle = /@oracle\b/i.test(reply);
    setPosting(true);
    if (mentionsOracle) setOracleTyping(true);
    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_post", thread_id: thread.id, content: reply, author_name: name }),
      });
      if (!res.ok) await res.json().catch(() => null);
      // Refetch posts to get Oracle response too
      const r2 = await fetch(`/api/threads?id=${thread.id}`);
      const d2 = await r2.json();
      setPosts(d2.posts ?? []);
      setReply("");
    } catch {}
    setPosting(false);
    setOracleTyping(false);
  }

  const col = CAT_COLORS[thread.category] ?? "#00ff88";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Thread header */}
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a3320", background: "#050c07" }}>
        <button onClick={onBack} style={{ background: "transparent", border: "none", color: "#5a8068", fontFamily: FONT, fontSize: 10, cursor: "pointer", letterSpacing: 2, marginBottom: 8, padding: 0 }}>
          ← BACK TO THREADS
        </button>
        <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 9, color: col, border: `1px solid ${col}`, padding: "1px 7px", borderRadius: 2, letterSpacing: 1 }}>{CAT_LABELS[thread.category]}</span>
          {thread.oracle_analyzed && <span style={{ fontSize: 9, color: "#00ff88", border: "1px solid #00bb66", padding: "1px 7px", borderRadius: 2, letterSpacing: 1 }}>◈ ORACLE ANALYZED</span>}
          {thread.location && <span style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1 }}>📍 {thread.location}</span>}
          <span style={{ fontSize: 9, color: "#3a5040", letterSpacing: 1, marginLeft: "auto" }}>{timeAgo(thread.created_at)}</span>
        </div>
        <div style={{ fontFamily: RAJ, fontSize: 15, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.3, marginBottom: 4 }}>{thread.title}</div>
        <div style={{ display: "flex", gap: 12, fontSize: 9, color: "#3a5040" }}>
          <span>by {thread.author_name}</span>
          <span>{thread.post_count} posts</span>
          <span>Credibility: <span style={{ color: thread.credibility_score >= 60 ? "#ff3333" : thread.credibility_score >= 40 ? "#ffaa00" : "#00bb66" }}>{thread.credibility_score}%</span></span>
        </div>
      </div>

      {/* Posts */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {loading ? (
          <div style={{ textAlign: "center", color: "#3a5040", fontSize: 10, padding: "2rem 0", letterSpacing: 2 }}>LOADING POSTS...</div>
        ) : posts.map(post => {
          const isOracle = post.author_type === "oracle";
          return (
            <div key={post.id} style={{ border: `1px solid ${isOracle ? "rgba(0,255,136,0.3)" : "#1a3320"}`, borderRadius: 4, padding: "10px 12px", background: isOracle ? "rgba(0,255,136,0.03)" : "#090f0b" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {isOracle && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", display: "inline-block" }} />}
                  <span style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: isOracle ? "#00ff88" : "#c8e8d0", letterSpacing: 1 }}>{post.author_name}</span>
                  {isOracle && <span style={{ fontSize: 8, color: "#00bb66", border: "1px solid #00bb66", padding: "1px 5px", borderRadius: 2, letterSpacing: 1 }}>AI</span>}
                </div>
                <span style={{ fontSize: 9, color: "#3a5040" }}>{timeAgo(post.created_at)}</span>
              </div>
              <PostContent content={post.content} isOracle={isOracle} />
            </div>
          );
        })}
        {oracleTyping && (
          <div style={{ border: "1px solid rgba(0,255,136,0.3)", borderRadius: 4, padding: "10px 12px", background: "rgba(0,255,136,0.02)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", animation: "bannerDot 0.5s step-end infinite", display: "inline-block" }} />
              <span style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: "#00ff88" }}>Oracle AI</span>
              <span style={{ fontSize: 8, color: "#00bb66", border: "1px solid #00bb66", padding: "1px 5px", borderRadius: 2 }}>AI</span>
            </div>
            <div style={{ fontFamily: FONT, fontSize: 10, color: "#3a6040", letterSpacing: 1 }}>[ ANALYZING THREAD... ]</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #1a3320", background: "#050c07" }}>
        <div style={{ fontSize: 9, color: "#3a5040", letterSpacing: 2, marginBottom: 8 }}>
          TIP: TYPE <span style={{ color: "#00bb66" }}>@oracle</span> TO INVOKE AI ANALYSIS
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="Your name"
            style={{ width: 120, background: "#090f0b", border: "1px solid #1a3320", borderRadius: 3, padding: "6px 10px", color: "#c8e8d0", fontFamily: FONT, fontSize: 10, outline: "none" }} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <textarea value={reply} onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(); }}
            placeholder="Share what you know... (Ctrl+Enter to post)"
            rows={2}
            style={{ flex: 1, background: "#090f0b", border: "1px solid #1a3320", borderRadius: 3, padding: "8px 10px", color: "#c8e8d0", fontFamily: FONT, fontSize: 11, outline: "none", resize: "none" }} />
          <button onClick={submit} disabled={!reply.trim() || posting}
            style={{ alignSelf: "flex-end", padding: "8px 14px", background: "transparent", border: "1px solid #00bb66", color: "#00ff88", fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 2, borderRadius: 3, cursor: "pointer", opacity: (!reply.trim() || posting) ? 0.4 : 1 }}>
            {posting ? "..." : "POST ▶"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── NEW THREAD FORM ───────────────────────────────────────────
function NewThreadForm({ onCreated }: { onCreated: (t: Thread) => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>("sighting");
  const [name, setName] = useState("Anonymous");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!title.trim() || !body.trim()) { setError("Title and description required."); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_thread", title, content: body, category, author_name: name, location }),
      });
      const d = await res.json();
      if (d.error) { setError(d.error); setSubmitting(false); return; }
      onCreated(d.thread);
    } catch {
      setError("Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  }

  const inp: CSSProperties = { background: "#090f0b", border: "1px solid #1a3320", borderRadius: 3, padding: "8px 12px", color: "#c8e8d0", fontFamily: FONT, fontSize: 12, outline: "none", width: "100%", transition: "border-color 0.2s" };

  return (
    <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", overflow: "hidden" }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #1a3320", background: "#050c07" }}>
        <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>◈ SUBMIT INTELLIGENCE</div>
        <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1, marginTop: 3 }}>Report a sighting, share a document, or start an investigation</div>
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>

        {/* Category */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {Object.entries(CAT_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setCategory(key)}
              style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "4px 10px", borderRadius: 2, cursor: "pointer",
                border: `1px solid ${category===key?CAT_COLORS[key]:"#1a3320"}`,
                background: category===key?`${CAT_COLORS[key]}14`:"transparent",
                color: category===key?CAT_COLORS[key]:"#5a8068" }}>
              {label}
            </button>
          ))}
        </div>

        <div>
          <label style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, display: "block", marginBottom: 4 }}>TITLE *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What did you see / find?" style={inp}
            onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "#00bb66"; }}
            onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "#1a3320"; }} />
        </div>

        <div>
          <label style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, display: "block", marginBottom: 4 }}>DESCRIPTION *</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Describe in detail. Include dates, locations, links, anything relevant..." rows={4}
            style={{ ...inp, resize: "vertical" }}
            onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = "#00bb66"; }}
            onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = "#1a3320"; }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <label style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, display: "block", marginBottom: 4 }}>YOUR NAME</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Anonymous" style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, display: "block", marginBottom: 4 }}>LOCATION (optional)</label>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" style={inp} />
          </div>
        </div>

        {error && <div style={{ fontSize: 11, color: "#ff3333", padding: "6px 10px", border: "1px solid rgba(255,51,51,0.3)", borderRadius: 3 }}>[ERROR] {error}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 9, color: "#3a5040", letterSpacing: 1 }}>
            After posting, type <span style={{ color: "#00bb66" }}>@oracle</span> in the thread to invoke AI analysis
          </div>
          <button onClick={submit} disabled={submitting || !title.trim() || !body.trim()}
            style={{ padding: "9px 20px", background: "transparent", border: "1px solid #00bb66", color: "#00ff88", fontFamily: RAJ, fontSize: 12, fontWeight: 700, letterSpacing: 2, borderRadius: 3, cursor: "pointer", opacity: (submitting || !title.trim() || !body.trim()) ? 0.4 : 1 }}>
            {submitting ? "SUBMITTING..." : "SUBMIT ▶"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMMUNITY PAGE ───────────────────────────────────────
export default function CommunityBoard() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category>("all");
  const [sort, setSort] = useState("latest");
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [showNew, setShowNew] = useState(false);

  const fetchThreadList = useCallback(() => {
    const params = new URLSearchParams({ sort });
    if (category !== "all") params.set("category", category);
    return fetch(`/api/threads?${params}`).then((r) => r.json() as Promise<{ threads?: Thread[] }>);
  }, [category, sort]);

  const refreshThreads = useCallback(() => {
    void fetchThreadList().then((d) => setThreads(d.threads ?? []));
  }, [fetchThreadList]);

  useEffect(() => {
    let cancelled = false;
    void fetchThreadList()
      .then((d) => {
        if (!cancelled) {
          setThreads(d.threads ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchThreadList]);

  const visible = threads;

  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
      <style>{`@keyframes bannerDot{0%,100%{opacity:1}50%{opacity:0.2}}`}</style>
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* NAV */}
        <div style={{ height: 44, background: "#050c07", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
          <Link href="/" style={{ fontSize: 10, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3 }}>← FEED</Link>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>THE THEORIST</div>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontFamily: RAJ, fontSize: 11, color: "#5a8068", letterSpacing: 2 }}>COMMUNITY INTELLIGENCE</div>
          <div style={{ marginLeft: "auto" }}>
            <button onClick={() => setShowNew(s => !s)}
              style={{ padding: "6px 16px", background: showNew ? "rgba(0,255,136,0.08)" : "transparent", border: "1px solid #00bb66", color: "#00ff88", fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 2, borderRadius: 3, cursor: "pointer" }}>
              {showNew ? "✕ CANCEL" : "+ SUBMIT INTELLIGENCE"}
            </button>
          </div>
        </div>

        <div style={{ maxWidth: 1520, margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>

          {/* HEADER */}
          <div style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid #1a3320" }}>
            <div style={{ fontFamily: RAJ, fontSize: 10, letterSpacing: 5, color: "#5a8068", marginBottom: 5, textTransform: "uppercase" }}>■ OPEN SOURCE INTELLIGENCE ■</div>
            <h1 style={{ fontFamily: RAJ, fontSize: 24, fontWeight: 700, color: "#00ff88", letterSpacing: 2, textTransform: "uppercase", textShadow: "0 0 16px rgba(0,255,136,0.2)", margin: "0 0 4px" }}>Community Intelligence</h1>
            <div style={{ fontSize: 9, color: "#3a5040", letterSpacing: 2 }}>REPORT SIGHTINGS · SHARE DOCUMENTS · INVOKE ORACLE AI · INVESTIGATE TOGETHER</div>
          </div>

          {/* New thread form */}
          {showNew && (
            <div style={{ marginBottom: "1.5rem" }}>
              <NewThreadForm onCreated={t => { setShowNew(false); setSelectedThread(t); refreshThreads(); }} />
            </div>
          )}

          {/* Thread detail or list */}
          {selectedThread ? (
            <div style={{ height: "calc(100vh - 200px)", border: "1px solid #1a3320", borderRadius: 4, overflow: "hidden", background: "#090f0b" }}>
              <ThreadDetail thread={selectedThread} onBack={() => { setSelectedThread(null); refreshThreads(); }} />
            </div>
          ) : (
            <>
              {/* Filters */}
              <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 5 }}>
                  {(["all","sighting","document","theory","question","tip"] as Category[]).map(cat => (
                    <button key={cat} onClick={() => setCategory(cat)}
                      style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", padding: "4px 10px", borderRadius: 2, cursor: "pointer",
                        border: `1px solid ${category===cat?(CAT_COLORS[cat]??"#00bb66"):"#1a3320"}`,
                        background: category===cat?`${(CAT_COLORS[cat]??"#00bb66")}14`:"transparent",
                        color: category===cat?(CAT_COLORS[cat]??"#00ff88"):"#5a8068" }}>
                      {cat === "all" ? "ALL" : cat.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {[["latest","LATEST"],["hot","HOT"],["credibility","TOP CRED"]].map(([key,label]) => (
                    <button key={key} onClick={() => setSort(key)}
                      style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "4px 10px", borderRadius: 2, cursor: "pointer",
                        border: `1px solid ${sort===key?"#ffaa00":"#1a3320"}`,
                        background: sort===key?"rgba(255,170,0,0.08)":"transparent",
                        color: sort===key?"#ffaa00":"#5a8068" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 10, marginBottom: "1rem" }}>
                {[
                  { label: "TOTAL THREADS", value: threads.length, col: "#00ff88" },
                  { label: "ORACLE ANALYZED", value: threads.filter(t => t.oracle_analyzed).length, col: "#00bb66" },
                  { label: "SIGHTINGS", value: threads.filter(t => t.category === "sighting").length, col: "#ffaa00" },
                ].map(({ label, value, col }) => (
                  <div key={label} style={{ border: "1px solid #1a3320", borderRadius: 3, padding: "6px 12px", background: "#090f0b" }}>
                    <div style={{ fontSize: 8, color: "#3a5040", letterSpacing: 2, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: RAJ, fontSize: 18, fontWeight: 700, color: col, lineHeight: 1 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Empty state */}
              {!loading && threads.length === 0 && (
                <div style={{ textAlign: "center", padding: "4rem 0", color: "#3a5040", fontSize: 10, letterSpacing: 2 }}>
                  NO THREADS YET — BE THE FIRST TO SUBMIT INTELLIGENCE
                  <div style={{ marginTop: 12 }}>
                    <button onClick={() => setShowNew(true)} style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: "#00ff88", background: "transparent", border: "1px solid #00bb66", padding: "7px 18px", borderRadius: 3, cursor: "pointer", letterSpacing: 2 }}>
                      + SUBMIT FIRST REPORT
                    </button>
                  </div>
                </div>
              )}

              {/* Thread list */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {visible.map(t => {
                  const col = CAT_COLORS[t.category] ?? "#00ff88";
                  return (
                    <div key={t.id} onClick={() => setSelectedThread(t)}
                      style={{ border: "1px solid #1a3320", borderRadius: 4, padding: "12px 14px", background: "#090f0b", cursor: "pointer", transition: "all 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = col; (e.currentTarget as HTMLDivElement).style.background = `${col}08`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1a3320"; (e.currentTarget as HTMLDivElement).style.background = "#090f0b"; }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 9, color: col, border: `1px solid ${col}`, padding: "1px 6px", borderRadius: 2, letterSpacing: 1 }}>{CAT_LABELS[t.category]}</span>
                        {t.oracle_analyzed && <span style={{ fontSize: 8, color: "#00ff88", border: "1px solid #00bb66", padding: "1px 5px", borderRadius: 2, letterSpacing: 1 }}>◈ AI</span>}
                        {t.status === "featured" && <span style={{ fontSize: 8, color: "#ffaa00", border: "1px solid #ffaa00", padding: "1px 5px", borderRadius: 2, letterSpacing: 1 }}>★ FEATURED</span>}
                        {t.location && <span style={{ fontSize: 9, color: "#5a8068" }}>📍 {t.location}</span>}
                        <span style={{ fontSize: 9, color: "#3a5040", letterSpacing: 1, marginLeft: "auto" }}>{timeAgo(t.created_at)}</span>
                      </div>
                      <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.3, marginBottom: 5 }}>{t.title}</div>
                      <div style={{ fontSize: 10, color: "#5a8068", lineHeight: 1.6, marginBottom: 8 }}>{t.body.slice(0, 120)}{t.body.length > 120 ? "..." : ""}</div>
                      <div style={{ display: "flex", gap: 14, fontSize: 9, color: "#3a5040" }}>
                        <span>by {t.author_name}</span>
                        <span>💬 {t.post_count} posts</span>
                        <span>Credibility: <span style={{ color: t.credibility_score >= 60 ? "#ff3333" : t.credibility_score >= 40 ? "#ffaa00" : "#00bb66" }}>{t.credibility_score}%</span></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
