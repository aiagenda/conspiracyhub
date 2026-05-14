"use client";
import { useCallback, useEffect, useMemo, useState, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import RegisteredOnlyGate from "@/components/RegisteredOnlyGate";
import { fetchWithSupabaseAuth } from "@/lib/authFetch";
import { ARTICLE_THREAD_STARTER_FP } from "@/lib/articleThreadStarters";
import { pageContentShellStyle } from "@/lib/pageShell";
import { getSupabaseBrowserClient } from "@/lib/supabase";

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
  linked_article_id?: string | null;
  linked_generated_article_id?: string | null;
}

interface Post {
  id: string; thread_id: string;
  author_name: string; author_type: string;
  author_fingerprint?: string;
  content: string; attachment_url?: string;
  upvotes: number; created_at: string;
  parent_post_id?: string | null;
  likes: number; dislikes: number;
}

interface GifResult { id: string; url: string; preview: string; }

const CAT_COLORS: Record<string, string> = {
  sighting: "#00ff88", document: "#ff3333", theory: "#c94dff",
  question: "#ffaa00", tip: "#00bb66",
};
const CAT_LABELS: Record<string, string> = {
  sighting: "👁 SIGHTING", document: "📄 DOCUMENT", theory: "🔮 THEORY",
  question: "❓ QUESTION", tip: "💡 TIP",
};

const ARTICLE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isArticleUuid(s: string) {
  return ARTICLE_UUID_RE.test(s);
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── GIF PICKER ─────────────────────────────────────────────────
function GifPicker({ onSelect, onClose }: { onSelect: (url: string) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<GifResult[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q.trim()) { setGifs([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/gif-search?q=${encodeURIComponent(q)}`);
        const d = await r.json() as { gifs?: GifResult[] };
        setGifs(d.gifs ?? []);
      } catch { setGifs([]); }
      setLoading(false);
    }, 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  return (
    <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#060e08", padding: 10, marginTop: 6 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center" }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search GIFs…" autoFocus
          style={{ flex: 1, background: "#090f0b", border: "1px solid #1a3320", borderRadius: 3, padding: "5px 10px", color: "#c8e8d0", fontFamily: FONT, fontSize: 11, outline: "none" }} />
        <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#5a8068", fontFamily: FONT, fontSize: 13, cursor: "pointer", lineHeight: 1 }}>✕</button>
      </div>
      {loading && <div style={{ textAlign: "center", color: "#3a5040", fontSize: 9, letterSpacing: 2, padding: "8px 0" }}>SEARCHING...</div>}
      {!loading && gifs.length === 0 && q.trim() && <div style={{ textAlign: "center", color: "#3a5040", fontSize: 9, padding: "8px 0" }}>No results</div>}
      {!q.trim() && <div style={{ textAlign: "center", color: "#3a5040", fontSize: 9, padding: "8px 0" }}>Type to search Tenor GIFs</div>}
      <div className="community-gif-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
        {gifs.map(gif => (
          <button key={gif.id} onClick={() => onSelect(gif.url)}
            style={{ padding: 0, border: "1px solid #1a3320", borderRadius: 3, cursor: "pointer", overflow: "hidden", background: "#090f0b", transition: "border-color 0.15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#00bb66"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a3320"; }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={gif.preview} alt="gif" style={{ width: "100%", display: "block", aspectRatio: "16/9", objectFit: "cover" }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── POST CONTENT RENDERER ──────────────────────────────────────
function PostContent({ content, isOracle }: { content: string; isOracle: boolean }) {
  if (!isOracle) return <div style={{ fontFamily: FONT, fontSize: 11, color: "#c8e8d0", lineHeight: 1.75, whiteSpace: "pre-wrap" }}>{content}</div>;
  const lines = content.split("\n");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {lines.map((line, i) => {
        if (!line.trim()) return null;
        if (line.startsWith("**") && line.endsWith("**"))
          return <div key={i} style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: "#00ff88", letterSpacing: 1, marginTop: 4 }}>{line.replace(/\*\*/g, "")}</div>;
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
        if (line.includes("**")) {
          const parts = line.split(/(\*\*[^*]+\*\*)/g);
          return (
            <div key={i} style={{ fontFamily: FONT, fontSize: 11, color: "#c8e8d0", lineHeight: 1.75 }}>
              {parts.map((p, j) => p.startsWith("**") ? <strong key={j} style={{ color: "#00ff88" }}>{p.replace(/\*\*/g, "")}</strong> : p)}
            </div>
          );
        }
        return <div key={i} style={{ fontFamily: FONT, fontSize: 11, color: "#c8e8d0", lineHeight: 1.75 }}>{line}</div>;
      })}
    </div>
  );
}

// ── REACTION BUTTON ────────────────────────────────────────────
function ReactionBtn({ type, count, active, onClick }: { type: "like" | "dislike"; count: number; active: boolean; onClick: () => void }) {
  const col = type === "like" ? "#00ff88" : "#ff3333";
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 4, background: active ? `${col}12` : "transparent",
      border: `1px solid ${active ? col : "#1a3320"}`, borderRadius: 3, padding: "3px 9px",
      color: active ? col : "#3a5040", fontFamily: FONT, fontSize: 9, cursor: "pointer", transition: "all 0.15s",
    }}
    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.borderColor = col; (e.currentTarget as HTMLButtonElement).style.color = col; }}}
    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a3320"; (e.currentTarget as HTMLButtonElement).style.color = "#3a5040"; }}}>
      {type === "like" ? "↑" : "↓"} {count}
    </button>
  );
}

// ── THREAD DETAIL ──────────────────────────────────────────────
function ThreadDetail({ thread, onBack }: { thread: Thread; onBack: () => void }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [name, setName] = useState("Anonymous");
  const [posting, setPosting] = useState(false);
  const [oracleTyping, setOracleTyping] = useState(false);
  // Reactions stored in localStorage {postId: "like"|"dislike"}
  const [reactions, setReactions] = useState<Record<string, "like" | "dislike">>({});
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [mainGif, setMainGif] = useState<string | null>(null);
  const [replyGif, setReplyGif] = useState<string | null>(null);
  const [gifPickerFor, setGifPickerFor] = useState<string | null>(null); // "main" | post_id
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("theorist-reactions");
      if (stored) setReactions(JSON.parse(stored) as Record<string, "like" | "dislike">);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchWithSupabaseAuth(`/api/threads?id=${thread.id}`)
      .then((r) => r.json())
      .then(async (d: { posts?: Post[] }) => {
        let list = d.posts ?? [];
        if (
          (thread.linked_article_id || thread.linked_generated_article_id) &&
          !list.some((p) => p.author_fingerprint === ARTICLE_THREAD_STARTER_FP)
        ) {
          try {
            await fetchWithSupabaseAuth("/api/threads", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "ensure_article_thread_starters", thread_id: thread.id }),
            });
            const r2 = await fetchWithSupabaseAuth(`/api/threads?id=${thread.id}`);
            const d2 = (await r2.json()) as { posts?: Post[] };
            list = d2.posts ?? list;
          } catch {
            /* keep list */
          }
        }
        if (!cancelled) setPosts(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [thread.id, thread.linked_article_id, thread.linked_generated_article_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [posts]);

  const refreshPosts = useCallback(async () => {
    try {
      const r = await fetchWithSupabaseAuth(`/api/threads?id=${thread.id}`);
      const d = await r.json() as { posts?: Post[] };
      setPosts(d.posts ?? []);
    } catch {}
  }, [thread.id]);

  const topLevelPosts = useMemo(() => posts.filter(p => !p.parent_post_id), [posts]);
  const repliesByParent = useMemo(() => {
    const map: Record<string, Post[]> = {};
    for (const p of posts) {
      if (p.parent_post_id) {
        if (!map[p.parent_post_id]) map[p.parent_post_id] = [];
        map[p.parent_post_id].push(p);
      }
    }
    return map;
  }, [posts]);

  function react(postId: string, reaction: "like" | "dislike") {
    if (reactions[postId] === reaction) return; // already voted this way
    const prev = reactions[postId];
    const next = { ...reactions, [postId]: reaction };
    setReactions(next);
    try { localStorage.setItem("theorist-reactions", JSON.stringify(next)); } catch {}
    // Optimistic UI
    setPosts(ps => ps.map(p => p.id !== postId ? p : {
      ...p,
      likes: reaction === "like" ? p.likes + 1 : (prev === "like" ? Math.max(0, p.likes - 1) : p.likes),
      dislikes: reaction === "dislike" ? p.dislikes + 1 : (prev === "dislike" ? Math.max(0, p.dislikes - 1) : p.dislikes),
    }));
    fetchWithSupabaseAuth("/api/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "react_post", post_id: postId, reaction }),
    }).catch(() => {});
  }

  async function submit(parentId?: string) {
    const text = parentId ? replyText : reply;
    const gif = parentId ? replyGif : mainGif;
    if ((!text.trim() && !gif) || posting) return;
    const mentionsOracle = /@oracle\b/i.test(text);
    setPosting(true);
    if (mentionsOracle) setOracleTyping(true);
    try {
      await fetchWithSupabaseAuth("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_post",
          thread_id: thread.id,
          content: text.trim() || "🎞",
          author_name: name,
          parent_post_id: parentId ?? null,
          attachment_url: gif ?? null,
        }),
      });
      await refreshPosts();
      if (parentId) { setReplyText(""); setReplyGif(null); setReplyingTo(null); }
      else { setReply(""); setMainGif(null); }
    } catch {}
    setPosting(false);
    setOracleTyping(false);
  }

  const col = CAT_COLORS[thread.category] ?? "#00ff88";

  function renderPost(post: Post, depth = 0): React.ReactNode {
    const isOracle = post.author_type === "oracle";
    const isSystem = post.author_type === "system";
    const myReaction = reactions[post.id];
    const postReplies = repliesByParent[post.id] ?? [];
    const isReplying = replyingTo === post.id;

    return (
      <div key={post.id} style={{ marginLeft: depth > 0 ? 18 : 0 }}>
        <div style={{
          border: `1px solid ${
            isOracle ? "rgba(0,255,136,0.3)" : isSystem ? "rgba(201,162,39,0.35)" : depth > 0 ? "#0f1e13" : "#1a3320"
          }`,
          borderLeft: depth > 0 ? "2px solid #1a5025" : undefined,
          borderRadius: 4, padding: "10px 12px",
          background: isOracle ? "rgba(0,255,136,0.03)" : isSystem ? "rgba(201,162,39,0.04)" : "#090f0b",
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isOracle && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", display: "inline-block" }} />}
              {isSystem && (
                <span style={{ fontSize: 7, color: "#c9a227", border: "1px solid rgba(201,162,39,0.5)", padding: "1px 5px", borderRadius: 2, letterSpacing: 1 }}>
                  STARTER
                </span>
              )}
              <span style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: isOracle ? "#00ff88" : isSystem ? "#d4b85c" : "#c8e8d0", letterSpacing: 1 }}>{post.author_name}</span>
              {isOracle && <span style={{ fontSize: 8, color: "#00bb66", border: "1px solid #00bb66", padding: "1px 5px", borderRadius: 2, letterSpacing: 1 }}>AI</span>}
              {depth > 0 && <span style={{ fontSize: 8, color: "#2a4030", letterSpacing: 1 }}>↩</span>}
            </div>
            <span style={{ fontSize: 9, color: "#3a5040" }}>{timeAgo(post.created_at)}</span>
          </div>

          {/* Content */}
          <PostContent content={post.content} isOracle={isOracle} />

          {/* GIF attachment */}
          {post.attachment_url && (
            <div style={{ marginTop: 8 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.attachment_url} alt="gif" style={{ maxWidth: "100%", maxHeight: 220, borderRadius: 3, display: "block" }} />
            </div>
          )}

          {/* Actions row */}
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "center" }}>
            <ReactionBtn type="like" count={post.likes} active={myReaction === "like"} onClick={() => react(post.id, "like")} />
            <ReactionBtn type="dislike" count={post.dislikes} active={myReaction === "dislike"} onClick={() => react(post.id, "dislike")} />
            {!isOracle && (
              <button onClick={() => { setReplyingTo(isReplying ? null : post.id); setReplyText(""); setReplyGif(null); setGifPickerFor(null); }}
                style={{ background: isReplying ? "rgba(0,187,102,0.08)" : "transparent", border: `1px solid ${isReplying ? "#00bb66" : "#1a3320"}`, borderRadius: 3, padding: "3px 9px", color: isReplying ? "#00bb66" : "#3a5040", fontFamily: FONT, fontSize: 9, cursor: "pointer", transition: "all 0.15s" }}>
                ↩ REPLY{postReplies.length > 0 ? ` (${postReplies.length})` : ""}
              </button>
            )}
          </div>

          {/* Inline reply form */}
          {isReplying && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1a3320" }}>
              {replyGif && (
                <div style={{ marginBottom: 6, position: "relative", display: "inline-block" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={replyGif} alt="gif" style={{ maxHeight: 110, borderRadius: 3 }} />
                  <button onClick={() => setReplyGif(null)} style={{ position: "absolute", top: 2, right: 2, background: "rgba(5,12,7,0.85)", border: "none", color: "#ff3333", cursor: "pointer", fontSize: 10, padding: "1px 5px", borderRadius: 2 }}>✕</button>
                </div>
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit(post.id); }}
                  placeholder={`Replying to ${post.author_name}… (Ctrl+Enter)`}
                  rows={2}
                  style={{ flex: 1, background: "#060e08", border: "1px solid #1a3320", borderRadius: 3, padding: "7px 10px", color: "#c8e8d0", fontFamily: FONT, fontSize: 11, outline: "none", resize: "none" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 4, alignSelf: "flex-end" }}>
                  <button onClick={() => setGifPickerFor(gifPickerFor === post.id ? null : post.id)}
                    style={{ padding: "4px 8px", background: gifPickerFor === post.id ? "rgba(0,187,102,0.1)" : "transparent", border: `1px solid ${gifPickerFor === post.id ? "#00bb66" : "#1a3320"}`, borderRadius: 3, color: "#5a8068", fontFamily: FONT, fontSize: 9, cursor: "pointer" }}>
                    🎞 GIF
                  </button>
                  <button onClick={() => { setReplyingTo(null); setReplyText(""); setReplyGif(null); }}
                    style={{ padding: "4px 8px", background: "transparent", border: "1px solid #1a3320", borderRadius: 3, color: "#5a8068", fontFamily: FONT, fontSize: 9, cursor: "pointer" }}>
                    CANCEL
                  </button>
                  <button onClick={() => void submit(post.id)} disabled={!replyText.trim() && !replyGif}
                    style={{ padding: "4px 10px", background: "transparent", border: "1px solid #00bb66", color: "#00ff88", fontFamily: RAJ, fontSize: 10, fontWeight: 700, letterSpacing: 2, borderRadius: 3, cursor: "pointer", opacity: (!replyText.trim() && !replyGif) ? 0.4 : 1 }}>
                    POST ▶
                  </button>
                </div>
              </div>
              {gifPickerFor === post.id && (
                <GifPicker onSelect={url => { setReplyGif(url); setGifPickerFor(null); }} onClose={() => setGifPickerFor(null)} />
              )}
            </div>
          )}
        </div>

        {/* Nested replies */}
        {postReplies.length > 0 && (
          <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 4 }}>
            {postReplies.map(r => renderPost(r, depth + 1))}
          </div>
        )}
      </div>
    );
  }

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
        ) : topLevelPosts.map(post => renderPost(post))}
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

      {/* Main compose box */}
      <div style={{ padding: "12px 16px", borderTop: "1px solid #1a3320", background: "#050c07" }}>
        <div style={{ fontSize: 9, color: "#3a5040", letterSpacing: 2, marginBottom: 8 }}>
          TIP: TYPE <span style={{ color: "#00bb66" }}>@oracle</span> TO INVOKE AI ANALYSIS
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
            style={{ width: 120, background: "#090f0b", border: "1px solid #1a3320", borderRadius: 3, padding: "6px 10px", color: "#c8e8d0", fontFamily: FONT, fontSize: 10, outline: "none" }} />
        </div>
        {mainGif && (
          <div style={{ marginBottom: 6, position: "relative", display: "inline-block" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mainGif} alt="gif" style={{ maxHeight: 120, borderRadius: 3 }} />
            <button onClick={() => setMainGif(null)} style={{ position: "absolute", top: 2, right: 2, background: "rgba(5,12,7,0.85)", border: "none", color: "#ff3333", cursor: "pointer", fontSize: 11, padding: "1px 5px", borderRadius: 2 }}>✕</button>
          </div>
        )}
        <div style={{ display: "flex", gap: 6 }}>
          <textarea value={reply} onChange={e => setReply(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit(); }}
            placeholder="Share what you know… (Ctrl+Enter to post)"
            rows={2}
            style={{ flex: 1, background: "#090f0b", border: "1px solid #1a3320", borderRadius: 3, padding: "8px 10px", color: "#c8e8d0", fontFamily: FONT, fontSize: 11, outline: "none", resize: "none" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 4, alignSelf: "flex-end" }}>
            <button onClick={() => setGifPickerFor(gifPickerFor === "main" ? null : "main")}
              style={{ padding: "6px 10px", background: gifPickerFor === "main" ? "rgba(0,187,102,0.1)" : "transparent", border: `1px solid ${gifPickerFor === "main" ? "#00bb66" : "#1a3320"}`, borderRadius: 3, color: gifPickerFor === "main" ? "#00bb66" : "#5a8068", fontFamily: FONT, fontSize: 10, cursor: "pointer" }}>
              🎞 GIF
            </button>
            <button onClick={() => void submit()} disabled={(!reply.trim() && !mainGif) || posting}
              style={{ padding: "6px 14px", background: "transparent", border: "1px solid #00bb66", color: "#00ff88", fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 2, borderRadius: 3, cursor: "pointer", opacity: ((!reply.trim() && !mainGif) || posting) ? 0.4 : 1 }}>
            {posting ? "..." : "POST ▶"}
          </button>
          </div>
        </div>
        {gifPickerFor === "main" && (
          <GifPicker onSelect={url => { setMainGif(url); setGifPickerFor(null); }} onClose={() => setGifPickerFor(null)} />
        )}
      </div>
    </div>
  );
}

// ── NEW THREAD FORM ────────────────────────────────────────────
function NewThreadForm({
  onCreated,
  linkedArticleId,
  linkedGeneratedArticleId,
  defaultTitle = "",
  defaultBody = "",
  defaultCategory,
}: {
  onCreated: (t: Thread) => void;
  linkedArticleId?: string | null;
  linkedGeneratedArticleId?: string | null;
  defaultTitle?: string;
  defaultBody?: string;
  defaultCategory?: string;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [body, setBody] = useState(defaultBody);
  const [category, setCategory] = useState<string>(
    defaultCategory ?? (linkedArticleId || linkedGeneratedArticleId ? "theory" : "sighting"),
  );
  const [name, setName] = useState("Anonymous");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setTitle(defaultTitle);
    setBody(defaultBody);
    if (defaultCategory) setCategory(defaultCategory);
  }, [defaultTitle, defaultBody, defaultCategory]);

  async function submit() {
    if (!title.trim() || !body.trim()) { setError("Title and description required."); return; }
    setSubmitting(true); setError("");
    try {
      const res = await fetchWithSupabaseAuth("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_thread",
          title,
          content: body,
          category,
          author_name: name,
          location,
          ...(linkedArticleId ? { linked_article_id: linkedArticleId } : {}),
          ...(linkedGeneratedArticleId ? { linked_generated_article_id: linkedGeneratedArticleId } : {}),
        }),
      });
      const d = await res.json() as { error?: string; thread?: Thread };
      if (d.error) { setError(d.error); return; }
      if (d.thread) onCreated(d.thread);
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
        <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>
          {linkedArticleId || linkedGeneratedArticleId ? "◈ START ARTICLE DISCUSSION" : "◈ SUBMIT INTELLIGENCE"}
        </div>
        <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1, marginTop: 3 }}>
          {linkedArticleId || linkedGeneratedArticleId
            ? "This thread is linked to an investigation. One discussion thread per article."
            : "Report a sighting, share a document, or start an investigation"}
        </div>
      </div>
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {Object.entries(CAT_LABELS).map(([key, label]) => (
            <button key={key} onClick={() => setCategory(key)}
              style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "4px 10px", borderRadius: 2, cursor: "pointer",
                border: `1px solid ${category === key ? CAT_COLORS[key] : "#1a3320"}`,
                background: category === key ? `${CAT_COLORS[key]}14` : "transparent",
                color: category === key ? CAT_COLORS[key] : "#5a8068" }}>
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
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Describe in detail. Include dates, locations, links, anything relevant…" rows={4}
            style={{ ...inp, resize: "vertical" }}
            onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = "#00bb66"; }}
            onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = "#1a3320"; }} />
        </div>
        <div className="community-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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
          <button onClick={() => void submit()} disabled={submitting || !title.trim() || !body.trim()}
            style={{ padding: "9px 20px", background: "transparent", border: "1px solid #00bb66", color: "#00ff88", fontFamily: RAJ, fontSize: 12, fontWeight: 700, letterSpacing: 2, borderRadius: 3, cursor: "pointer", opacity: (submitting || !title.trim() || !body.trim()) ? 0.4 : 1 }}>
            {submitting ? "SUBMITTING..." : "SUBMIT ▶"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN COMMUNITY BOARD ───────────────────────────────────────
export default function CommunityBoard() {
  const searchParams = useSearchParams();
  const articleParam = searchParams.get("article");
  const generatedParam = searchParams.get("generated_article");
  const articleFromUrl = articleParam && isArticleUuid(articleParam) ? articleParam : null;
  const generatedFromUrl =
    !articleFromUrl && generatedParam && isArticleUuid(generatedParam) ? generatedParam : null;
  const articleBundleId = articleFromUrl ?? generatedFromUrl;
  const articleBundleKind = articleFromUrl ? ("news" as const) : generatedFromUrl ? ("generated" as const) : null;

  const [authReady, setAuthReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<Category>("all");
  const [sort, setSort] = useState("latest");
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [articleTitle, setArticleTitle] = useState<string | null>(null);
  const [articleSlug, setArticleSlug] = useState<string | null>(null);
  const [articleThreads, setArticleThreads] = useState<Thread[]>([]);
  const [articleBundleLoading, setArticleBundleLoading] = useState(false);

  const fetchThreadList = useCallback(() => {
    const params = new URLSearchParams({ sort });
    if (category !== "all") params.set("category", category);
    return fetchWithSupabaseAuth(`/api/threads?${params}`).then(
      (r) => r.json() as Promise<{ threads?: Thread[] }>
    );
  }, [category, sort]);

  const refreshThreads = useCallback(() => {
    void fetchThreadList().then(d => setThreads(d.threads ?? []));
  }, [fetchThreadList]);

  const loadArticleBundle = useCallback(async (id: string, kind: "news" | "generated") => {
    setArticleBundleLoading(true);
    try {
      const threadsUrl =
        kind === "news"
          ? `/api/threads?article_id=${encodeURIComponent(id)}`
          : `/api/threads?generated_article_id=${encodeURIComponent(id)}`;
      if (kind === "news") {
        const [threadsJson, newsRow] = await Promise.all([
          fetchWithSupabaseAuth(threadsUrl).then((r) => r.json() as Promise<{ threads?: Thread[] }>),
          getSupabaseBrowserClient().from("news_items").select("title").eq("id", id).maybeSingle(),
        ]);
        setArticleThreads(threadsJson.threads ?? []);
        setArticleTitle(typeof newsRow.data?.title === "string" ? newsRow.data.title : "News item");
        setArticleSlug(null);
      } else {
        const [threadsJson, genRow] = await Promise.all([
          fetchWithSupabaseAuth(threadsUrl).then((r) => r.json() as Promise<{ threads?: Thread[] }>),
          getSupabaseBrowserClient()
            .from("generated_articles")
            .select("title,slug")
            .eq("id", id)
            .eq("status", "published")
            .maybeSingle(),
        ]);
        setArticleThreads(threadsJson.threads ?? []);
        setArticleTitle(typeof genRow.data?.title === "string" ? genRow.data.title : "Investigation report");
        setArticleSlug(typeof genRow.data?.slug === "string" ? genRow.data.slug : null);
      }
    } catch {
      setArticleThreads([]);
      setArticleTitle(kind === "news" ? "News item" : "Investigation report");
      setArticleSlug(null);
    } finally {
      setArticleBundleLoading(false);
    }
  }, []);

  useEffect(() => {
    const sb = getSupabaseBrowserClient();
    void sb.auth.getSession().then(({ data }) => {
      setSignedIn(Boolean(data.session?.access_token));
      setAuthReady(true);
    });
    const {
      data: { subscription },
    } = sb.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session?.access_token));
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady || !signedIn) return;
    if (articleBundleId && articleBundleKind) {
      setLoading(false);
      setShowNew(false);
      void loadArticleBundle(articleBundleId, articleBundleKind);
      return;
    }
    setArticleTitle(null);
    setArticleSlug(null);
    setArticleThreads([]);
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
  }, [authReady, signedIn, articleBundleId, articleBundleKind, fetchThreadList, loadArticleBundle]);

  const discussionSeedTitle = articleTitle
    ? `Discussion: ${articleTitle}`.slice(0, 120)
    : "";
  const discussionSeedBody = articleTitle
    ? articleBundleKind === "generated"
      ? `Thread about this investigation report:\n"${articleTitle.slice(0, 400)}"\n\nWhat stands out? Sources, skepticism, or connections?`
      : `Thread about this feed item:\n"${articleTitle.slice(0, 400)}"\n\nWhat stands out? Sources, skepticism, or connections?`
    : "";

  function onLeaveThreadDetail() {
    setSelectedThread(null);
    if (articleBundleId && articleBundleKind) void loadArticleBundle(articleBundleId, articleBundleKind);
    else refreshThreads();
  }

  if (!authReady) {
    return (
      <div style={{ minHeight: "100vh", background: "#050c07", color: "#3a5040", fontFamily: FONT }}>
        <div className="scanline" />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "50vh",
            letterSpacing: 3,
            fontSize: 10,
          }}
        >
          VERIFYING SESSION…
        </div>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <div style={{ minHeight: "100vh", background: "#050c07" }}>
        <div className="scanline" />
        <RegisteredOnlyGate
          variant="fullscreen"
          title="COMMUNITY — SIGN IN REQUIRED"
          subtitle="Threads, replies, and @oracle on the community board are for registered members only."
        />
      </div>
    );
  }

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
            {!articleBundleId && (
            <button onClick={() => setShowNew(s => !s)}
              style={{ padding: "6px 16px", background: showNew ? "rgba(0,255,136,0.08)" : "transparent", border: "1px solid #00bb66", color: "#00ff88", fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 2, borderRadius: 3, cursor: "pointer" }}>
              {showNew ? "✕ CANCEL" : "+ SUBMIT INTELLIGENCE"}
            </button>
            )}
          </div>
        </div>

        <div style={pageContentShellStyle()}>

          {/* HEADER */}
          <div style={{ marginBottom: "1.25rem", paddingBottom: "1rem", borderBottom: "1px solid #1a3320" }}>
            <div style={{ fontFamily: RAJ, fontSize: 10, letterSpacing: 5, color: "#5a8068", marginBottom: 5, textTransform: "uppercase" }}>■ OPEN SOURCE INTELLIGENCE ■</div>
            <h1 style={{ fontFamily: RAJ, fontSize: 24, fontWeight: 700, color: "#00ff88", letterSpacing: 2, textTransform: "uppercase", textShadow: "0 0 16px rgba(0,255,136,0.2)", margin: "0 0 4px" }}>Community Intelligence</h1>
            <div style={{ fontSize: 9, color: "#3a5040", letterSpacing: 2 }}>REPORT SIGHTINGS · SHARE DOCUMENTS · INVOKE ORACLE AI · INVESTIGATE TOGETHER</div>
          </div>

          {showNew && !articleBundleId && (
            <div style={{ marginBottom: "1.5rem" }}>
              <NewThreadForm onCreated={t => { setShowNew(false); setSelectedThread(t); refreshThreads(); }} />
            </div>
          )}

          {articleBundleId && !selectedThread && (
            <div style={{ marginBottom: "1.25rem", border: "1px solid #1a3320", borderRadius: 4, padding: "14px 16px", background: "#080c09" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 12 }}>
                <Link href="/community" style={{ fontSize: 10, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3 }}>
                  ← ALL THREADS
                </Link>
                {articleFromUrl ? (
                  <Link href={`/article/${articleFromUrl}`} style={{ fontSize: 10, color: "#00bb66", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3 }}>
                    OPEN ARTICLE ↗
                  </Link>
                ) : articleSlug ? (
                  <Link href={`/blog/${articleSlug}`} style={{ fontSize: 10, color: "#00bb66", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3 }}>
                    OPEN REPORT ↗
                  </Link>
                ) : null}
              </div>
              <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 8 }}>ARTICLE DISCUSSION</div>
              {articleBundleLoading ? (
                <div style={{ fontSize: 11, color: "#3a5040", letterSpacing: 1, padding: "12px 0" }}>Loading discussion…</div>
              ) : (
                <>
                  <div style={{ fontFamily: RAJ, fontSize: 16, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.35, marginBottom: 14 }}>{articleTitle}</div>
                  {articleThreads.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {articleThreads.map(t => {
                        const c = CAT_COLORS[t.category] ?? "#00ff88";
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => setSelectedThread(t)}
                            style={{
                              textAlign: "left", border: "1px solid #1a3320", borderRadius: 4, padding: "12px 14px",
                              background: "#090f0b", cursor: "pointer", color: "#c8e8d0", fontFamily: FONT, fontSize: 12,
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = c; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a3320"; }}
                          >
                            <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#00ff88", marginBottom: 6 }}>◈ OPEN DISCUSSION</div>
                            <div style={{ fontSize: 11, color: "#9ec8ae", lineHeight: 1.4 }}>{t.title}</div>
                            <div style={{ fontSize: 9, color: "#3a5040", marginTop: 8 }}>💬 {t.post_count} posts · {timeAgo(t.created_at)}</div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <NewThreadForm
                      linkedArticleId={articleFromUrl ?? undefined}
                      linkedGeneratedArticleId={generatedFromUrl ?? undefined}
                      defaultTitle={discussionSeedTitle}
                      defaultBody={discussionSeedBody}
                      defaultCategory="theory"
                      onCreated={t => {
                        setSelectedThread(t);
                        if (articleBundleId && articleBundleKind) void loadArticleBundle(articleBundleId, articleBundleKind);
                      }}
                    />
                  )}
                </>
              )}
            </div>
          )}

          {selectedThread ? (
            <div style={{ height: "calc(100vh - 200px)", border: "1px solid #1a3320", borderRadius: 4, overflow: "hidden", background: "#090f0b" }}>
              <ThreadDetail thread={selectedThread} onBack={onLeaveThreadDetail} />
            </div>
          ) : !articleBundleId ? (
            <>
              {/* Filters */}
              <div style={{ display: "flex", gap: 8, marginBottom: "1rem", flexWrap: "wrap", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {(["all", "sighting", "document", "theory", "question", "tip"] as Category[]).map(cat => (
                    <button key={cat} onClick={() => setCategory(cat)}
                      style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", padding: "4px 10px", borderRadius: 2, cursor: "pointer",
                        border: `1px solid ${category === cat ? (CAT_COLORS[cat] ?? "#00bb66") : "#1a3320"}`,
                        background: category === cat ? `${(CAT_COLORS[cat] ?? "#00bb66")}14` : "transparent",
                        color: category === cat ? (CAT_COLORS[cat] ?? "#00ff88") : "#5a8068" }}>
                      {cat === "all" ? "ALL" : cat.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 5 }}>
                  {[["latest", "LATEST"], ["hot", "HOT"], ["credibility", "TOP CRED"]].map(([key, label]) => (
                    <button key={key} onClick={() => setSort(key)}
                      style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, letterSpacing: 1, padding: "4px 10px", borderRadius: 2, cursor: "pointer",
                        border: `1px solid ${sort === key ? "#ffaa00" : "#1a3320"}`,
                        background: sort === key ? "rgba(255,170,0,0.08)" : "transparent",
                        color: sort === key ? "#ffaa00" : "#5a8068" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: "flex", gap: 10, marginBottom: "1rem", flexWrap: "wrap" }}>
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
                {threads.map(t => {
                  const c = CAT_COLORS[t.category] ?? "#00ff88";
                  return (
                    <div key={t.id} onClick={() => setSelectedThread(t)}
                      style={{ border: "1px solid #1a3320", borderRadius: 4, padding: "12px 14px", background: "#090f0b", cursor: "pointer", transition: "all 0.15s" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = c; (e.currentTarget as HTMLDivElement).style.background = `${c}08`; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1a3320"; (e.currentTarget as HTMLDivElement).style.background = "#090f0b"; }}>
                      <div style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ fontSize: 9, color: c, border: `1px solid ${c}`, padding: "1px 6px", borderRadius: 2, letterSpacing: 1 }}>{CAT_LABELS[t.category]}</span>
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
