"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PAGE_CONTENT_MAX, PAGE_CONTENT_PADDING } from "@/lib/pageShell";

const JSON_HEADERS = { "Content-Type": "application/json" };

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

const border = "1px solid #1a2a22";
const cardBg = "#080c09";
const muted = "#5a8068";

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function MiniBar({ data }: { data: { hour: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div
      className="flex w-full items-end gap-0.5 px-1"
      style={{ height: 112, minHeight: 112 }}
    >
      {data.map((d) => (
        <div
          key={d.hour}
          title={`${d.hour}:00 — ${d.count} views`}
          className="min-w-0 flex-1 rounded-sm transition-[height]"
          style={{
            height: `${Math.max(4, (d.count / max) * 100)}%`,
            background: d.count ? "rgba(0, 187, 102, 0.45)" : "#0f1510",
          }}
        />
      ))}
    </div>
  );
}

function StatTile({
  title,
  value,
  sub,
  danger,
}: {
  title: string;
  value: string | number;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <div
      className="flex min-w-0 flex-col gap-1 rounded-lg p-4"
      style={{ background: cardBg, border }}
    >
      <span className="text-[10px] uppercase tracking-widest" style={{ color: muted }}>
        {title}
      </span>
      <span
        className="font-raj text-2xl font-bold tracking-tight sm:text-3xl"
        style={{ color: danger ? "#ff6666" : "var(--foreground)" }}
      >
        {value}
      </span>
      {sub && <span className="text-xs" style={{ color: muted }}>{sub}</span>}
    </div>
  );
}

function TableShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg" style={{ background: cardBg, border }}>
      <div className="border-b px-4 py-3" style={{ borderColor: "#1a2a22" }}>
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: muted }}>
          {title}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [msgsTab, setMsgsTab] = useState<"unread" | "all">("unread");
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [msgPage, setMsgPage] = useState(1);
  const [msgTotal, setMsgTotal] = useState(0);
  const detailRef = useRef<HTMLDivElement>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/stats");
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      setStats(await res.json());
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (page = 1) => {
    const res = await fetch(`/api/admin/messages?page=${page}`);
    if (!res.ok) return;
    const d = await res.json();
    setMessages(d.messages ?? []);
    setMsgTotal(d.total ?? 0);
    setMsgPage(page);
  }, []);

  useEffect(() => {
    loadStats();
    loadMessages();
  }, [loadStats, loadMessages]);

  async function markRead(id: string, read: boolean) {
    await fetch("/api/admin/messages", {
      method: "PATCH",
      headers: JSON_HEADERS,
      body: JSON.stringify({ id, read }),
    });
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, read } : m)));
    if (selectedMsg?.id === id) setSelectedMsg((m) => (m ? { ...m, read } : m));
    loadStats();
  }

  async function deleteMsg(id: string) {
    if (!confirm("Delete this message?")) return;
    await fetch("/api/admin/messages", {
      method: "DELETE",
      headers: JSON_HEADERS,
      body: JSON.stringify({ id }),
    });
    setMessages((ms) => ms.filter((m) => m.id !== id));
    if (selectedMsg?.id === id) setSelectedMsg(null);
    loadStats();
  }

  const displayed = msgsTab === "unread" ? messages.filter((m) => !m.read) : messages;

  function selectMessage(m: Message) {
    setSelectedMsg(m);
    if (!m.read) void markRead(m.id, true);
    queueMicrotask(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  const navBtn =
    "w-full rounded-md border border-transparent px-3 py-2.5 text-left text-[13px] transition-colors hover:border-[#1a2a22] hover:bg-[#0f1510]";

  return (
    <div
      className="flex min-h-screen w-full flex-col"
      style={{
        background: "var(--background)",
        fontFamily: "var(--font-share-tech-mono), monospace",
      }}
    >
      {/* Top bar — full width */}
      <header
        className="flex w-full flex-wrap items-center justify-between gap-4 border-b py-4"
        style={{
          borderColor: "#1a2a22",
          maxWidth: PAGE_CONTENT_MAX + 280,
          marginInline: "auto",
          paddingInline: "clamp(1rem, 3vw, 2rem)",
        }}
      >
        <div className="min-w-0">
          <p className="mb-0.5 text-[10px] uppercase tracking-[0.2em]" style={{ color: muted }}>
            ConspiracyHub
          </p>
          <h1 className="font-raj text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
            Operations console
          </h1>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          <a
            href="/"
            className="rounded-md border px-3 py-2 text-[12px] no-underline"
            style={{ borderColor: "#1a2a22", color: muted }}
          >
            Feed
          </a>
          <a
            href="/search"
            className="rounded-md border px-3 py-2 text-[12px] no-underline"
            style={{ borderColor: "#1a2a22", color: muted }}
          >
            Search
          </a>
          <a
            href="/community"
            className="rounded-md border px-3 py-2 text-[12px] no-underline"
            style={{ borderColor: "#1a2a22", color: muted }}
          >
            Community
          </a>
          <button
            type="button"
            onClick={() => {
              void loadStats();
              void loadMessages(msgPage);
            }}
            disabled={loading}
            className="rounded-md border px-4 py-2 text-[12px] font-semibold uppercase tracking-wide"
            style={{
              borderColor: "var(--green-dark)",
              color: "var(--green)",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? "Refreshing…" : "↻ Refresh"}
          </button>
        </div>
      </header>

      <div
        className="flex w-full flex-1 flex-col gap-0 lg:flex-row"
        style={{
          maxWidth: PAGE_CONTENT_MAX + 280,
          marginInline: "auto",
          width: "100%",
          padding: PAGE_CONTENT_PADDING,
          boxSizing: "border-box",
        }}
      >
        {/* Sidebar — desktop */}
        <aside
          className="mb-6 flex w-full flex-shrink-0 flex-row flex-wrap gap-2 border-b pb-4 lg:mb-0 lg:w-[220px] lg:flex-col lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6"
          style={{ borderColor: "#1a2a22" }}
        >
          <p className="hidden w-full text-[10px] uppercase tracking-widest lg:block" style={{ color: muted }}>
            Navigate
          </p>
          <button type="button" className={navBtn} style={{ color: "var(--foreground)" }} onClick={() => scrollToId("overview")}>
            Overview
          </button>
          <button type="button" className={navBtn} style={{ color: "var(--foreground)" }} onClick={() => scrollToId("traffic")}>
            Traffic &amp; API
          </button>
          <button type="button" className={navBtn} style={{ color: "var(--foreground)" }} onClick={() => scrollToId("contact")}>
            Inbox
          </button>
          <button type="button" className={navBtn} style={{ color: "var(--foreground)" }} onClick={() => scrollToId("reference")}>
            Reference
          </button>
          <div className="mt-auto hidden w-full border-t pt-4 lg:block" style={{ borderColor: "#1a2a22" }}>
            <p className="mb-2 text-[10px] uppercase tracking-widest" style={{ color: muted }}>
              Public site
            </p>
            <a href="/guide" className="mb-1 block text-[12px]" style={{ color: "var(--green-dim)" }}>
              Guide
            </a>
            <a href="/uap" className="mb-1 block text-[12px]" style={{ color: "var(--green-dim)" }}>
              UAP files
            </a>
            <a href="/outbreaks" className="block text-[12px]" style={{ color: "var(--green-dim)" }}>
              Outbreaks
            </a>
          </div>
        </aside>

        {/* Main column */}
        <main className="min-w-0 flex-1 space-y-8">
          {err && (
            <div
              className="rounded-lg border px-4 py-3 text-[13px]"
              style={{ borderColor: "#4a1a1a", background: "rgba(255,51,51,0.08)", color: "#ff8888" }}
            >
              {err}
            </div>
          )}

          {/* Overview */}
          <section id="overview">
            <h2 className="font-raj mb-4 text-sm font-bold uppercase tracking-[0.15em]" style={{ color: muted }}>
              Overview
            </h2>
            {stats && (
              <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
                <StatTile title="Page views (24h)" value={stats.pageViews.last24h} sub={`7d: ${stats.pageViews.last7d} · 30d: ${stats.pageViews.last30d}`} />
                <StatTile title="API calls (24h)" value={stats.api.calls24h} sub={`avg ${stats.api.avgMs} ms`} />
                <StatTile title="API errors (24h)" value={stats.api.errors24h} danger={stats.api.errors24h > 0} />
                <StatTile title="Articles (index)" value={stats.content.totalArticles} sub="rows in articles" />
                <StatTile title="Unread inbox" value={stats.contact.unread} danger={stats.contact.unread > 0} />
                <StatTile title="Contact rows" value={msgTotal} sub="total messages in inbox table" />
              </div>
            )}
            {!stats && !err && (
              <p className="text-sm" style={{ color: muted }}>Loading metrics…</p>
            )}
          </section>

          {/* Traffic + tables */}
          <section id="traffic" className="space-y-6">
            <h2 className="font-raj text-sm font-bold uppercase tracking-[0.15em]" style={{ color: muted }}>
              Traffic &amp; API
            </h2>
            {stats && (
              <>
                <div className="grid w-full grid-cols-1 gap-4 xl:grid-cols-3">
                  <div className="min-w-0 xl:col-span-2" style={{ background: cardBg, border, borderRadius: 8 }}>
                    <div className="border-b px-4 py-3" style={{ borderColor: "#1a2a22" }}>
                      <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: muted }}>
                        Page views — last 24 hours
                      </span>
                    </div>
                    <div className="p-4">
                      <MiniBar data={stats.charts.viewsHourly} />
                      <div className="mt-2 flex justify-between text-[10px] uppercase" style={{ color: muted }}>
                        <span>24h ago</span>
                        <span>now</span>
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 space-y-3 rounded-lg p-4" style={{ background: cardBg, border }}>
                    <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: muted }}>
                      Health
                    </p>
                    <p className="text-[13px] leading-relaxed" style={{ color: muted }}>
                      API route logs populate when requests are recorded to <code className="text-[var(--green-dim)]">api_request_logs</code>.
                      Page views come from <code className="text-[var(--green-dim)]">/api/track</code> on navigation.
                    </p>
                    <p className="text-[13px] leading-relaxed" style={{ color: muted }}>
                      Error rate (24h):{" "}
                      <strong style={{ color: "var(--foreground)" }}>
                        {stats.api.calls24h
                          ? `${((stats.api.errors24h / stats.api.calls24h) * 100).toFixed(1)}%`
                          : "—"}
                      </strong>
                    </p>
                  </div>
                </div>

                <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2" style={{ minHeight: 280 }}>
                  <TableShell title="Top pages (7 days)">
                    <table className="w-full border-collapse text-left text-[13px]">
                      <thead>
                        <tr className="sticky top-0 z-[1]" style={{ background: "#0a100c" }}>
                          <th className="border-b px-4 py-2 font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>
                            Path
                          </th>
                          <th className="border-b px-4 py-2 text-right font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>
                            Views
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.charts.topPaths.map((p) => (
                          <tr key={p.path} className="hover:bg-[#0f1510]">
                            <td className="max-w-[1px] truncate border-b px-4 py-2.5 font-mono text-[12px]" style={{ borderColor: "#111816", color: "var(--foreground)" }}>
                              {p.path}
                            </td>
                            <td className="border-b px-4 py-2.5 text-right tabular-nums" style={{ borderColor: "#111816", color: "var(--green)" }}>
                              {p.count}
                            </td>
                          </tr>
                        ))}
                        {stats.charts.topPaths.length === 0 && (
                          <tr>
                            <td colSpan={2} className="px-4 py-8 text-center text-[13px]" style={{ color: muted }}>
                              No path data yet
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </TableShell>

                  <TableShell title="Top API routes (24h)">
                    <table className="w-full border-collapse text-left text-[13px]">
                      <thead>
                        <tr className="sticky top-0 z-[1]" style={{ background: "#0a100c" }}>
                          <th className="border-b px-4 py-2 font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>
                            Route
                          </th>
                          <th className="border-b px-4 py-2 text-right font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>
                            Calls
                          </th>
                          <th className="border-b px-4 py-2 text-right font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>
                            Errors
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.charts.topRoutes.map((r) => (
                          <tr key={r.route} className="hover:bg-[#0f1510]">
                            <td className="max-w-[1px] truncate border-b px-4 py-2.5 font-mono text-[12px]" style={{ borderColor: "#111816", color: "var(--foreground)" }}>
                              {r.route}
                            </td>
                            <td className="border-b px-4 py-2.5 text-right tabular-nums" style={{ borderColor: "#111816", color: "var(--green)" }}>
                              {r.total}
                            </td>
                            <td className="border-b px-4 py-2.5 text-right tabular-nums" style={{ borderColor: "#111816", color: r.errors > 0 ? "#ff6666" : muted }}>
                              {r.errors}
                            </td>
                          </tr>
                        ))}
                        {stats.charts.topRoutes.length === 0 && (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-[13px]" style={{ color: muted }}>
                              No API log rows yet (instrument routes to write <code className="text-[var(--green-dim)]">api_request_logs</code>)
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </TableShell>
                </div>

                {stats.contact.recent.length > 0 && (
                  <TableShell title="Latest contact (snapshot)">
                    <table className="w-full border-collapse text-left text-[13px]">
                      <thead>
                        <tr className="sticky top-0 z-[1]" style={{ background: "#0a100c" }}>
                          <th className="border-b px-4 py-2 font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>When</th>
                          <th className="border-b px-4 py-2 font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>From</th>
                          <th className="border-b px-4 py-2 font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>Category</th>
                          <th className="border-b px-4 py-2 font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>Subject</th>
                          <th className="border-b px-4 py-2 font-semibold uppercase tracking-wide" style={{ borderColor: "#1a2a22", color: muted }}>Read</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.contact.recent.map((r) => (
                          <tr key={r.id} className="hover:bg-[#0f1510]">
                            <td className="whitespace-nowrap border-b px-4 py-2.5 text-[12px]" style={{ borderColor: "#111816", color: muted }}>
                              {new Date(r.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                            </td>
                            <td className="max-w-[140px] truncate border-b px-4 py-2.5 text-[12px]" style={{ borderColor: "#111816", color: "var(--foreground)" }}>
                              {r.name}
                            </td>
                            <td className="border-b px-4 py-2.5 text-[12px] uppercase" style={{ borderColor: "#111816", color: muted }}>
                              {r.category}
                            </td>
                            <td className="max-w-[1px] truncate border-b px-4 py-2.5 text-[12px]" style={{ borderColor: "#111816", color: "var(--foreground)" }}>
                              {r.subject}
                            </td>
                            <td className="border-b px-4 py-2.5 text-[12px]" style={{ borderColor: "#111816", color: r.read ? muted : "var(--green)" }}>
                              {r.read ? "yes" : "no"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableShell>
                )}
              </>
            )}
          </section>

          {/* Inbox */}
          <section id="contact">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-raj text-sm font-bold uppercase tracking-[0.15em]" style={{ color: muted }}>
                Inbox
              </h2>
              <div className="flex gap-2">
                {(["unread", "all"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMsgsTab(t)}
                    className="rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      borderColor: msgsTab === t ? "var(--green-dark)" : "#1a2a22",
                      background: msgsTab === t ? "rgba(0,187,102,0.08)" : "transparent",
                      color: msgsTab === t ? "var(--green)" : muted,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
              <div className="min-h-[360px] min-w-0 overflow-hidden rounded-lg" style={{ background: cardBg, border }}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                    <thead>
                      <tr style={{ background: "#0a100c" }}>
                        <th className="border-b px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>
                          Status
                        </th>
                        <th className="border-b px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>
                          Date
                        </th>
                        <th className="border-b px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>
                          Name
                        </th>
                        <th className="border-b px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>
                          Email
                        </th>
                        <th className="border-b px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>
                          Cat
                        </th>
                        <th className="border-b px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>
                          Subject
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayed.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-4 py-12 text-center text-[13px]" style={{ color: muted }}>
                            No messages in this view.
                          </td>
                        </tr>
                      )}
                      {displayed.map((m) => (
                        <tr
                          key={m.id}
                          onClick={() => selectMessage(m)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              selectMessage(m);
                            }
                          }}
                          tabIndex={0}
                          role="button"
                          className="cursor-pointer outline-none hover:bg-[#0f1510] focus-visible:ring-2"
                          style={{
                            background: selectedMsg?.id === m.id ? "rgba(0,187,102,0.06)" : undefined,
                          }}
                        >
                          <td className="border-b px-3 py-2.5" style={{ borderColor: "#111816" }}>
                            {!m.read ? (
                              <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--green)" }} title="Unread" />
                            ) : (
                              <span className="text-[11px]" style={{ color: muted }}>—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap border-b px-3 py-2.5 text-[12px]" style={{ borderColor: "#111816", color: muted }}>
                            {new Date(m.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                          </td>
                          <td className="max-w-[120px] truncate border-b px-3 py-2.5 text-[12px]" style={{ borderColor: "#111816", color: "var(--foreground)" }}>
                            {m.name}
                          </td>
                          <td className="max-w-[180px] truncate border-b px-3 py-2.5 font-mono text-[11px]" style={{ borderColor: "#111816", color: muted }}>
                            {m.email}
                          </td>
                          <td className="whitespace-nowrap border-b px-3 py-2.5 text-[11px] uppercase" style={{ borderColor: "#111816", color: muted }}>
                            {m.category}
                          </td>
                          <td className="max-w-[1px] truncate border-b px-3 py-2.5 text-[12px]" style={{ borderColor: "#111816", color: "var(--foreground)" }}>
                            {m.subject}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {msgsTab === "all" && msgTotal > 30 && (
                  <div className="flex items-center gap-3 border-t px-4 py-3" style={{ borderColor: "#1a2a22" }}>
                    <button
                      type="button"
                      disabled={msgPage <= 1}
                      onClick={() => loadMessages(msgPage - 1)}
                      className="rounded border px-3 py-1.5 text-[11px] disabled:opacity-40"
                      style={{ borderColor: "#1a2a22", color: muted }}
                    >
                      ← Prev
                    </button>
                    <span className="text-[12px]" style={{ color: muted }}>
                      Page {msgPage} / {Math.ceil(msgTotal / 30)}
                    </span>
                    <button
                      type="button"
                      disabled={msgPage * 30 >= msgTotal}
                      onClick={() => loadMessages(msgPage + 1)}
                      className="rounded border px-3 py-1.5 text-[11px] disabled:opacity-40"
                      style={{ borderColor: "#1a2a22", color: muted }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>

              <div
                ref={detailRef}
                className="min-h-[280px] rounded-lg p-5 lg:min-h-[360px]"
                style={{ background: cardBg, border }}
              >
                {selectedMsg ? (
                  <>
                    <div className="mb-4 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-raj mb-1 text-base font-bold text-[var(--foreground)]">{selectedMsg.subject}</h3>
                        <p className="text-[12px] leading-relaxed" style={{ color: muted }}>
                          <strong style={{ color: "var(--foreground)" }}>{selectedMsg.name}</strong>
                          {" "}
                          &lt;{selectedMsg.email}&gt;
                          <br />
                          {selectedMsg.category}
                          {" · "}
                          {new Date(selectedMsg.created_at).toLocaleString("en-GB")}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedMsg(null)}
                        className="flex-shrink-0 rounded border px-2 py-1 text-[11px]"
                        style={{ borderColor: "#1a2a22", color: muted }}
                        aria-label="Close detail"
                      >
                        ✕
                      </button>
                    </div>
                    <pre
                      className="mb-4 max-h-[min(50vh,420px)] overflow-auto whitespace-pre-wrap rounded-md border p-4 text-[13px] leading-relaxed"
                      style={{ borderColor: "#1a2a22", background: "#050805", color: "var(--foreground)" }}
                    >
                      {selectedMsg.message}
                    </pre>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => markRead(selectedMsg.id, !selectedMsg.read)}
                        className="rounded-md border px-3 py-2 text-[12px]"
                        style={{ borderColor: "#1a2a22", color: muted }}
                      >
                        {selectedMsg.read ? "Mark unread" : "Mark read"}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMsg(selectedMsg.id)}
                        className="rounded-md border px-3 py-2 text-[12px]"
                        style={{ borderColor: "#4a1a1a", color: "#ff8888" }}
                      >
                        Delete
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="py-12 text-center text-[13px]" style={{ color: muted }}>
                    Select a row to read the full message.
                  </p>
                )}
              </div>
            </div>
          </section>

          {/* Reference / docs */}
          <section id="reference">
            <h2 className="font-raj mb-3 text-sm font-bold uppercase tracking-[0.15em]" style={{ color: muted }}>
              Data &amp; compliance
            </h2>
            <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-lg p-4 text-[13px] leading-relaxed" style={{ background: cardBg, border, color: muted }}>
                <p className="mb-2 font-semibold uppercase tracking-wide" style={{ color: "var(--foreground)" }}>
                  Tables in use
                </p>
                <ul className="list-inside list-disc space-y-1">
                  <li><code className="text-[var(--green-dim)]">page_views</code> — anonymous path + fingerprint</li>
                  <li><code className="text-[var(--green-dim)]">api_request_logs</code> — optional per-route metrics</li>
                  <li><code className="text-[var(--green-dim)]">contact_messages</code> — form submissions</li>
                  <li><code className="text-[var(--green-dim)]">articles</code> — feed index count</li>
                </ul>
              </div>
              <div className="rounded-lg p-4 text-[13px] leading-relaxed" style={{ background: cardBg, border, color: muted }}>
                <p className="mb-2 font-semibold uppercase tracking-wide" style={{ color: "var(--foreground)" }}>
                  Public pages
                </p>
                <p className="mb-3">Legal and help content for visitors:</p>
                <div className="flex flex-wrap gap-2">
                  <a href="/privacy" className="rounded border px-3 py-1.5 text-[12px] no-underline" style={{ borderColor: "#1a2a22", color: "var(--green-dim)" }}>Privacy</a>
                  <a href="/terms" className="rounded border px-3 py-1.5 text-[12px] no-underline" style={{ borderColor: "#1a2a22", color: "var(--green-dim)" }}>Terms</a>
                  <a href="/faq" className="rounded border px-3 py-1.5 text-[12px] no-underline" style={{ borderColor: "#1a2a22", color: "var(--green-dim)" }}>FAQ</a>
                  <a href="/contact" className="rounded border px-3 py-1.5 text-[12px] no-underline" style={{ borderColor: "#1a2a22", color: "var(--green-dim)" }}>Contact form</a>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
