"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

interface ChatMessage {
  id: string;
  author_name: string;
  author_type: string;
  content: string;
  gif_url?: string | null;
  created_at: string;
}

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

interface Props {
  articleId: string;
  articleTitle: string;
  onClose: () => void;
}

export default function LiveChat({ articleId, articleTitle, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [name, setName] = useState(() =>
    typeof window !== "undefined" ? localStorage.getItem("chat_name") || "Anonymous" : "Anonymous"
  );
  const [online, setOnline] = useState(1);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("chat_name", name);
  }, [name]);

  const initThread = useCallback(async () => {
    const res = await fetch(`/api/threads?article_id=${encodeURIComponent(articleId)}`);
    const d = (await res.json()) as { threads?: { id: string }[]; error?: string };

    let tid: string | undefined;
    if (d.threads?.length) {
      tid = d.threads[0].id;
    } else {
      const cr = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_thread",
          title: articleTitle,
          content: `Live discussion: ${articleTitle}`,
          category: "theory",
          author_name: "TheTheorist",
          linked_article_id: articleId,
        }),
      });
      const cd = (await cr.json()) as { thread?: { id: string }; error?: string };
      tid = cd.thread?.id;
    }

    if (!tid) {
      setLoading(false);
      return;
    }
    setThreadId(tid);

    const pr = await fetch(`/api/threads?id=${encodeURIComponent(tid)}`);
    const pd = (await pr.json()) as { posts?: ChatMessage[] };
    setMessages(pd.posts ?? []);
    setLoading(false);
  }, [articleId, articleTitle]);

  useEffect(() => {
    void initThread();
  }, [initThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!threadId || !isSupabaseBrowserConfigured()) return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`chat:${threadId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "thread_posts",
          filter: `thread_id=eq.${threadId}`,
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnline(Math.max(1, Object.keys(state).length));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user: name, online_at: new Date().toISOString() });
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [threadId, name]);

  async function send() {
    if (!text.trim() || !threadId || sending) return;
    setSending(true);
    const content = text.trim();
    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      author_name: name,
      author_type: "human",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((p) => [...p, optimistic]);
    setText("");
    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_post",
          thread_id: threadId,
          content,
          author_name: name,
        }),
      });
      const json = (await res.json()) as { post?: ChatMessage; error?: string };
      if (!res.ok) throw new Error(json.error ?? "send failed");
      if (json.post) {
        setMessages((prev) => {
          const noTmp = prev.filter((m) => !String(m.id).startsWith("tmp-"));
          if (noTmp.some((m) => m.id === json.post!.id)) return noTmp;
          return [...noTmp, json.post!];
        });
      } else {
        setMessages((prev) => prev.filter((m) => !String(m.id).startsWith("tmp-")));
      }
    } catch {
      setMessages((prev) => prev.filter((m) => !String(m.id).startsWith("tmp-")));
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#090f0b", fontFamily: FONT }}>
      <style>{`@keyframes chatFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}.chat-msg{animation:chatFade 0.2s ease}`}</style>

      <div style={{ padding: "12px 14px", borderBottom: "1px solid #1a3320", background: "#050c07", flexShrink: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#00ff88",
                  display: "inline-block",
                  boxShadow: "0 0 6px #00ff88",
                }}
              />
              <span style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>LIVE CHAT</span>
              <span style={{ fontSize: 9, color: "#3a5040", letterSpacing: 1 }}>{online} online</span>
            </div>
            <div style={{ fontSize: 10, color: "#5a8068", lineHeight: 1.4 }}>
              {articleTitle.slice(0, 55)}
              {articleTitle.length > 55 ? "…" : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#3a5040",
              cursor: "pointer",
              fontSize: 16,
              padding: "0 0 0 8px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        {loading && (
          <div style={{ textAlign: "center", color: "#2a4a30", fontSize: 10, padding: "2rem 0", letterSpacing: 2 }}>
            CONNECTING...
          </div>
        )}

        {!loading && messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem 0" }}>
            <div style={{ fontSize: 10, color: "#2a4a30", letterSpacing: 2, marginBottom: 8 }}>NO MESSAGES YET</div>
            <div style={{ fontSize: 9, color: "#1a3a20", letterSpacing: 1 }}>Be the first to share a theory</div>
          </div>
        )}

        {messages.map((msg, i) => {
          const isOracle = msg.author_type === "oracle";
          const isMe = msg.author_name === name;
          return (
            <div
              key={msg.id}
              className="chat-msg"
              style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}
            >
              {(i === 0 || messages[i - 1].author_name !== msg.author_name) && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    marginBottom: 3,
                    paddingLeft: isMe ? 0 : 2,
                    paddingRight: isMe ? 2 : 0,
                  }}
                >
                  {isOracle && (
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: "#00ff88",
                        display: "inline-block",
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: 9,
                      color: isOracle ? "#00bb66" : isMe ? "#5a8068" : "#3a5040",
                      letterSpacing: 1,
                    }}
                  >
                    {isOracle ? "Oracle AI" : msg.author_name}
                  </span>
                  <span style={{ fontSize: 8, color: "#1a3a20" }}>{timeAgo(msg.created_at)}</span>
                </div>
              )}

              <div
                style={{
                  maxWidth: "82%",
                  padding: "7px 11px",
                  borderRadius: isMe ? "8px 8px 2px 8px" : "8px 8px 8px 2px",
                  background: isOracle ? "rgba(0,255,136,0.06)" : isMe ? "rgba(0,187,102,0.12)" : "#111",
                  border: isOracle
                    ? "1px solid rgba(0,255,136,0.2)"
                    : isMe
                      ? "1px solid rgba(0,187,102,0.25)"
                      : "1px solid #1a1a1a",
                  fontSize: 12,
                  color: "#c8e8d0",
                  lineHeight: 1.65,
                  fontFamily: FONT,
                  wordBreak: "break-word",
                }}
              >
                {msg.content}
              </div>

              {msg.gif_url ? (
                <img
                  src={msg.gif_url}
                  alt="gif"
                  style={{ maxWidth: 180, borderRadius: 6, marginTop: 4, border: "1px solid #1a3320" }}
                />
              ) : null}
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "10px 14px", borderTop: "1px solid #1a3320", background: "#050c07", flexShrink: 0 }}>
        <div style={{ marginBottom: 7 }}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            style={{
              background: "transparent",
              border: "none",
              borderBottom: "1px solid #1a3320",
              color: "#5a8068",
              fontFamily: FONT,
              fontSize: 10,
              outline: "none",
              padding: "2px 0",
              width: 120,
              letterSpacing: 1,
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Share a theory... (Enter to send)"
            style={{
              flex: 1,
              background: "#0a0f0a",
              border: "1px solid #1a3320",
              borderRadius: 4,
              padding: "8px 10px",
              color: "#c8e8d0",
              fontFamily: FONT,
              fontSize: 11,
              outline: "none",
            }}
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={!text.trim() || sending}
            style={{
              padding: "8px 14px",
              background: text.trim() ? "#00ff88" : "transparent",
              border: `1px solid ${text.trim() ? "#00ff88" : "#1a3320"}`,
              color: text.trim() ? "#050c07" : "#3a5040",
              fontFamily: RAJ,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              borderRadius: 4,
              cursor: text.trim() ? "pointer" : "default",
              transition: "all 0.15s",
            }}
          >
            ▶
          </button>
        </div>

        <div style={{ fontSize: 8, color: "#1a3a20", letterSpacing: 1, marginTop: 5 }}>
          Type <span style={{ color: "#2a5a30" }}>@oracle</span> to invoke AI analysis
        </div>
      </div>
    </div>
  );
}
