"use client";

import { useState, useEffect, useCallback } from "react";

const ADMIN_SECRET =
  typeof window !== "undefined"
    ? (localStorage.getItem("admin_secret") ?? "")
    : "";

interface Stats {
  pageViews: { last24h: number; last7d: number; last30d: number };
  api: { calls24h: number; errors24h: number; avgMs: number };
  content: { totalArticles: number };
  contact: {
    unread: number;
    recent: {
      id: string; name: string; email: string;
      category: string; subject: string; created_at: string; read: boolean;
    }[];
  };
  charts: {
    viewsHourly: { hour: string; count: number }[];
    topPaths: { path: string; count: number }[];
    topRoutes: { route: string; total: number; errors: number }[];
  };
}

interface Message {
  id: string; name: string; email: string; category: string;
  subject: string; message: string; created_at: string; read: boolean; ip_hash?: string;
}

// ── tiny helpers ──────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 10,
  padding: "20px 24px",
};

const label: React.CSSProperties = {
  fontSize: 10, letterSpacing: "0.1em", color: "#444", textTransform: "uppercase",
  marginBottom: 6, display: "block",
};

function StatCard({ title, value, sub, accent }: { title: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div style={{ ...card, display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={label}>{title}</span>
      <span style={{ fontSize: 28, fontWeight: 700, color: accent ? "#e06060" : "#e8e8e8", letterSpacing: "-0.02em" }}>
        {value}
      </span>
      {sub && <span style={{ fontSize: 11, color: "#444" }}>{sub}</span>}
    </div>
  );
}

function MiniBar({ data }: { data: { hour: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 52, padding: "0 2px" }}>
      {data.map((d) => (
        <div
          key={d.hour}
          title={`${d.hour}:00 — ${d.count} views`}
          style={{
            flex: 1, background: d.count ? "rgba(107,196,107,0.5)" : "#1a1a1a",
            borderRadius: 2,
            height: `${Math.max(3, (d.count / max) * 100)}%`,
            transition: "height 0.3s",
          }}
        />
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [secret, setSecret] = useState(ADMIN_SECRET);
  const [savedSecret, setSavedSecret] = useState(ADMIN_SECRET);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [msgsTab, setMsgsTab] = useState<"unread" | "all">("unread");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [msgPage, setMsgPage] = useState(1);
  const [msgTotal, setMsgTotal] = useState(0);

  const hdrs = useCallback(
    () => ({ "Content-Type": "application/json", "x-admin-secret": savedSecret }),
    [savedSecret],
  );

  const loadStats = useCallback(async () => {
    if (!savedSecret) return;
    setLoading(true); setErr("");
    try {
      const res = await fetch("/api/admin/stats", { headers: hdrs() });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      setStats(await res.json());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [savedSecret, hdrs]);

  const loadMessages = useCallback(async (page = 1) => {
    if (!savedSecret) return;
    const res = await fetch(`/api/admin/messages?page=${page}`, { headers: hdrs() });
    if (!res.ok) return;
    const d = await res.json();
    setMessages(d.messages ?? []);
    setMsgTotal(d.total ?? 0);
    setMsgPage(page);
  }, [savedSecret, hdrs]);

  useEffect(() => { if (savedSecret) { loadStats(); loadMessages(); } }, [savedSecret, loadStats, loadMessages]);

  async function markRead(id: string, read: boolean) {
    await fetch("/api/admin/messages", {
      method: "PATCH", headers: hdrs(),
      body: JSON.stringify({ id, read }),
    });
    setMessages((ms) => ms.map((m) => m.id === id ? { ...m, read } : m));
    if (selectedMsg?.id === id) setSelectedMsg((m) => m ? { ...m, read } : m);
    loadStats();
  }

  async function deleteMsg(id: string) {
    if (!confirm("Delete this message?")) return;
    await fetch("/api/admin/messages", {
      method: "DELETE", headers: hdrs(),
      body: JSON.stringify({ id }),
    });
    setMessages((ms) => ms.filter((m) => m.id !== id));
    if (selectedMsg?.id === id) setSelectedMsg(null);
    loadStats();
  }

  function saveSecret() {
    localStorage.setItem("admin_secret", secret);
    setSavedSecret(secret);
  }

  const displayed = msgsTab === "unread" ? messages.filter((m) => !m.read) : messages;

  // ── Login screen ─────────────────────────────────────────────────────────
  if (!savedSecret) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ ...card, width: 360 }}>
          <h2 style={{ margin: "0 0 20px", fontSize: 18, color: "#e8e8e8" }}>Admin Access</h2>
          <input
            type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveSecret()}
            placeholder="Admin secret…"
            style={{
              width: "100%", boxSizing: "border-box",
              background: "#0a0a0a", border: "1px solid #2a2a2a",
              borderRadius: 6, padding: "10px 14px", color: "#e8e8e8", fontSize: 14,
            }}
          />
          <button onClick={saveSecret} style={{
            marginTop: 14, width: "100%", padding: "10px", background: "#1e3a1e",
            border: "1px solid #2a5a2a", borderRadius: 7, color: "#6bc46b",
            fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
            Unlock
          </button>
        </div>
      </div>
    );
  }

  // ── Main dashboard ────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1400, margin: "0 auto", padding: "2rem clamp(1rem,3vw,2rem) 4rem" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32, flexWrap: "wrap", gap: 12 }}>
        <div>
          <p style={{ margin: "0 0 4px", fontSize: 10, letterSpacing: "0.12em", color: "#444", textTransform: "uppercase" }}>ConspiracyHub</p>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#e8e8e8" }}>Admin Dashboard</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={loadStats} disabled={loading} style={{
            padding: "8px 16px", background: "transparent", border: "1px solid #2a2a2a",
            borderRadius: 6, color: "#666", fontSize: 11, cursor: "pointer",
          }}>
            {loading ? "Refreshing…" : "↻ Refresh"}
          </button>
          <button onClick={() => { setSavedSecret(""); localStorage.removeItem("admin_secret"); }} style={{
            padding: "8px 16px", background: "transparent", border: "1px solid #3a1a1a",
            borderRadius: 6, color: "#664", fontSize: 11, cursor: "pointer",
          }}>
            Log out
          </button>
        </div>
      </div>

      {err && (
        <div style={{ padding: "12px 16px", background: "rgba(180,60,60,0.1)", border: "1px solid #4a1a1a", borderRadius: 8, color: "#e06060", fontSize: 13, marginBottom: 24 }}>
          {err}
        </div>
      )}

      {stats && (
        <>
          {/* ── Stat cards ─────────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 14, marginBottom: 28 }}>
            <StatCard title="Page views (24h)" value={stats.pageViews.last24h} sub={`7d: ${stats.pageViews.last7d} · 30d: ${stats.pageViews.last30d}`} />
            <StatCard title="API calls (24h)" value={stats.api.calls24h} sub={`avg ${stats.api.avgMs}ms`} />
            <StatCard title="API errors (24h)" value={stats.api.errors24h} accent={stats.api.errors24h > 0} />
            <StatCard title="Total articles" value={stats.content.totalArticles} />
            <StatCard title="Unread messages" value={stats.contact.unread} accent={stats.contact.unread > 0} />
          </div>

          {/* ── Hourly chart ───────────────────────────────────────── */}
          <div style={{ ...card, marginBottom: 24 }}>
            <span style={label}>Page views — last 24 hours</span>
            <MiniBar data={stats.charts.viewsHourly} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9, color: "#333" }}>
              <span>24h ago</span>
              <span>now</span>
            </div>
          </div>

          {/* ── Top paths + routes ─────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
            <div style={card}>
              <span style={label}>Top pages (7d)</span>
              {stats.charts.topPaths.map((p) => (
                <div key={p.path} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #111", fontSize: 12 }}>
                  <span style={{ color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%" }}>{p.path}</span>
                  <span style={{ color: "#4a4", flexShrink: 0 }}>{p.count}</span>
                </div>
              ))}
              {stats.charts.topPaths.length === 0 && <p style={{ fontSize: 12, color: "#333" }}>No data yet</p>}
            </div>
            <div style={card}>
              <span style={label}>Top API routes (24h)</span>
              {stats.charts.topRoutes.map((r) => (
                <div key={r.route} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid #111", fontSize: 12 }}>
                  <span style={{ color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "65%" }}>{r.route}</span>
                  <span style={{ color: r.errors > 0 ? "#e06060" : "#4a4", flexShrink: 0 }}>
                    {r.total}{r.errors > 0 ? ` (${r.errors} err)` : ""}
                  </span>
                </div>
              ))}
              {stats.charts.topRoutes.length === 0 && <p style={{ fontSize: 12, color: "#333" }}>No data yet</p>}
            </div>
          </div>
        </>
      )}

      {/* ── Contact messages ─────────────────────────────────────────────── */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#d0d0d0" }}>
            Contact Messages
            {stats && stats.contact.unread > 0 && (
              <span style={{ marginLeft: 8, padding: "2px 7px", background: "#3a1a1a", border: "1px solid #5a2a2a", borderRadius: 10, fontSize: 10, color: "#e06060" }}>
                {stats.contact.unread} unread
              </span>
            )}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            {(["unread", "all"] as const).map((t) => (
              <button
                key={t} onClick={() => setMsgsTab(t)}
                style={{
                  padding: "5px 12px", fontSize: 10, cursor: "pointer",
                  background: msgsTab === t ? "#1a2a1a" : "transparent",
                  border: `1px solid ${msgsTab === t ? "#2a5a2a" : "#222"}`,
                  borderRadius: 5, color: msgsTab === t ? "#6bc46b" : "#444",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: selectedMsg ? "1fr 1fr" : "1fr", gap: 16 }}>
          {/* Message list */}
          <div>
            {displayed.length === 0 && (
              <p style={{ fontSize: 12, color: "#333" }}>No messages to show.</p>
            )}
            {displayed.map((m) => (
              <div
                key={m.id}
                onClick={() => { setSelectedMsg(m); if (!m.read) markRead(m.id, true); }}
                style={{
                  padding: "12px 14px", borderRadius: 8, marginBottom: 6, cursor: "pointer",
                  background: selectedMsg?.id === m.id ? "#111" : "transparent",
                  border: `1px solid ${selectedMsg?.id === m.id ? "#2a2a2a" : "#161616"}`,
                  opacity: m.read ? 0.6 : 1,
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: m.read ? 400 : 600, color: "#d0d0d0" }}>{m.name}</span>
                  <span style={{ fontSize: 10, color: "#444" }}>
                    {new Date(m.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "#555", marginBottom: 3 }}>
                  [{m.category}] {m.subject}
                </div>
                {!m.read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#6bc46b", display: "inline-block" }} />}
              </div>
            ))}

            {/* Pagination for "all" tab */}
            {msgsTab === "all" && msgTotal > 30 && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button disabled={msgPage <= 1} onClick={() => loadMessages(msgPage - 1)} style={{ padding: "5px 10px", background: "#111", border: "1px solid #222", borderRadius: 5, color: "#666", fontSize: 11, cursor: "pointer" }}>← Prev</button>
                <span style={{ fontSize: 11, color: "#444", padding: "5px 0" }}>{msgPage} / {Math.ceil(msgTotal / 30)}</span>
                <button disabled={msgPage * 30 >= msgTotal} onClick={() => loadMessages(msgPage + 1)} style={{ padding: "5px 10px", background: "#111", border: "1px solid #222", borderRadius: 5, color: "#666", fontSize: 11, cursor: "pointer" }}>Next →</button>
              </div>
            )}
          </div>

          {/* Message detail */}
          {selectedMsg && (
            <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8, padding: "18px 20px", position: "relative" }}>
              <button onClick={() => setSelectedMsg(null)} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#444", fontSize: 16, cursor: "pointer" }}>✕</button>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#e8e8e8", marginBottom: 4 }}>{selectedMsg.subject}</div>
                <div style={{ fontSize: 11, color: "#555" }}>
                  <strong style={{ color: "#888" }}>{selectedMsg.name}</strong> &lt;{selectedMsg.email}&gt;
                  {" · "}{selectedMsg.category}
                  {" · "}{new Date(selectedMsg.created_at).toLocaleString("en-GB")}
                </div>
              </div>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: "0 0 18px" }}>
                {selectedMsg.message}
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => markRead(selectedMsg.id, !selectedMsg.read)}
                  style={{ padding: "6px 12px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 5, color: "#666", fontSize: 11, cursor: "pointer" }}
                >
                  {selectedMsg.read ? "Mark unread" : "Mark read"}
                </button>
                <button
                  onClick={() => deleteMsg(selectedMsg.id)}
                  style={{ padding: "6px 12px", background: "transparent", border: "1px solid #3a1a1a", borderRadius: 5, color: "#844", fontSize: 11, cursor: "pointer" }}
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
