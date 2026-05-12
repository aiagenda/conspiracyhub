"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PAGE_CONTENT_MAX, PAGE_CONTENT_PADDING } from "@/lib/pageShell";
import { humanizeCronUtc } from "@/lib/cronHuman";

const JSON_HEADERS = { "Content-Type": "application/json" };

interface Stats {
  pageViews: { last24h: number; last7d: number; last30d: number };
  api: { calls24h: number; errors24h: number; avgMs: number };
  content: { totalArticles: number; oracleAnalyses: number; threads: number };
  contact: {
    unread: number;
    recent: {
      id: string; name: string; email: string;
      category: string; subject: string; created_at: string; read: boolean;
    }[];
  };
  subscribers: { pro: number; free: number; newLast7d: number; mrr: number };
  charts: {
    viewsHourly: { hour: string; count: number }[];
    topPaths: { path: string; count: number }[];
    topRoutes: { route: string; total: number; errors: number }[];
  };
}

interface AdminUser {
  id: string;
  email: string;
  plan: "free" | "pro";
  subscription_status: string | null;
  subscription_current_period_end: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

interface AdminThread {
  id: string;
  title: string;
  body: string;
  author_name: string;
  category: string;
  status: string;
  post_count: number;
  credibility_score: number | null;
  oracle_analyzed: boolean;
  created_at: string;
}

interface AdminArticle {
  id: string;
  title: string;
  url: string;
  score: number;
  section: string;
  date: string;
  source: string | null;
  has_oracle: boolean;
}

interface Message {
  id: string; name: string; email: string; category: string;
  subject: string; message: string; created_at: string; read: boolean; ip_hash?: string;
}

interface ScraperRun {
  id: string;
  trigger: string;
  status: "running" | "success" | "failed" | "skipped";
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  http_status: number | null;
  error_text: string | null;
}

interface ScraperJob {
  id: string;
  job_key: string;
  name: string;
  target: string;
  schedule_cron: string;
  enabled: boolean;
  config: Record<string, unknown> | null;
  last_run: ScraperRun | null;
  runs: ScraperRun[];
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
  const [scrapers, setScrapers] = useState<ScraperJob[]>([]);
  const [scraperBusy, setScraperBusy] = useState<string>("");

  // Subscribers
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userPlanFilter, setUserPlanFilter] = useState<"all" | "pro" | "free">("all");
  const [userSummary, setUserSummary] = useState<{ totalPro: number; totalFree: number; mrr: number } | null>(null);
  const [userBusy, setUserBusy] = useState<string>("");

  // Community
  const [threads, setThreads] = useState<AdminThread[]>([]);
  const [threadTotal, setThreadTotal] = useState(0);
  const [threadPage, setThreadPage] = useState(1);
  const [threadSummary, setThreadSummary] = useState<{ total: number; removed: number; oracleAnalyzed: number } | null>(null);
  const [threadBusy, setThreadBusy] = useState<string>("");

  // Content
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [articleTotal, setArticleTotal] = useState(0);
  const [articlePage, setArticlePage] = useState(1);
  const [articleSummary, setArticleSummary] = useState<{ totalArticles: number; highThreat: number; oracleAnalyses: number } | null>(null);
  const [articleBusy, setArticleBusy] = useState<string>("");
  const [articleScoreFilter, setArticleScoreFilter] = useState(0);

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

  const loadScrapers = useCallback(async () => {
    const res = await fetch("/api/admin/scrapers");
    if (!res.ok) return;
    const d = await res.json() as { jobs?: ScraperJob[] };
    setScrapers(d.jobs ?? []);
  }, []);

  const loadUsers = useCallback(async (page = 1, planFilter: string = "all") => {
    const params = new URLSearchParams({ page: String(page) });
    if (planFilter !== "all") params.set("plan", planFilter);
    const res = await fetch(`/api/admin/users?${params}`);
    if (!res.ok) return;
    const d = await res.json();
    setUsers(d.users ?? []);
    setUserTotal(d.total ?? 0);
    setUserPage(page);
    if (d.summary) setUserSummary(d.summary);
  }, []);

  const loadThreads = useCallback(async (page = 1) => {
    const res = await fetch(`/api/admin/community?page=${page}`);
    if (!res.ok) return;
    const d = await res.json();
    setThreads(d.threads ?? []);
    setThreadTotal(d.total ?? 0);
    setThreadPage(page);
    if (d.summary) setThreadSummary(d.summary);
  }, []);

  const loadArticles = useCallback(async (page = 1, minScore = 0) => {
    const params = new URLSearchParams({ page: String(page) });
    if (minScore > 0) params.set("min_score", String(minScore));
    const res = await fetch(`/api/admin/content?${params}`);
    if (!res.ok) return;
    const d = await res.json();
    setArticles(d.articles ?? []);
    setArticleTotal(d.total ?? 0);
    setArticlePage(page);
    if (d.summary) setArticleSummary(d.summary);
  }, []);

  useEffect(() => {
    loadStats();
    loadMessages();
    loadScrapers();
    loadUsers();
    loadThreads();
    loadArticles();
  }, [loadStats, loadMessages, loadScrapers, loadUsers, loadThreads, loadArticles]);

  async function changeUserPlan(id: string, plan: "free" | "pro") {
    if (!confirm(`Set user plan to ${plan.toUpperCase()}?`)) return;
    setUserBusy(id);
    try {
      await fetch("/api/admin/users", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ id, plan }),
      });
      await loadUsers(userPage, userPlanFilter);
      await loadStats();
    } finally {
      setUserBusy("");
    }
  }

  async function removeThread(id: string, permanent = false) {
    if (!confirm(permanent ? "Permanently delete this thread and all its posts?" : "Remove this thread from public view?")) return;
    setThreadBusy(id);
    try {
      if (permanent) {
        await fetch("/api/admin/community", {
          method: "DELETE",
          headers: JSON_HEADERS,
          body: JSON.stringify({ id }),
        });
      } else {
        await fetch("/api/admin/community", {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ id, status: "removed" }),
        });
      }
      await loadThreads(threadPage);
    } finally {
      setThreadBusy("");
    }
  }

  async function deleteArticle(id: string, title: string) {
    if (!confirm(`Delete article "${title.slice(0, 60)}…"?\nThis also removes its Oracle analysis.`)) return;
    setArticleBusy(id);
    try {
      await fetch("/api/admin/content", {
        method: "DELETE",
        headers: JSON_HEADERS,
        body: JSON.stringify({ id }),
      });
      await loadArticles(articlePage, articleScoreFilter);
      await loadStats();
    } finally {
      setArticleBusy("");
    }
  }

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

  async function updateScraper(job: ScraperJob, patch: Partial<Pick<ScraperJob, "enabled" | "schedule_cron" | "config">>) {
    setScraperBusy(job.id);
    try {
      await fetch("/api/admin/scrapers", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ id: job.id, ...patch }),
      });
      await loadScrapers();
    } finally {
      setScraperBusy("");
    }
  }

  async function runScraperNow(job: ScraperJob) {
    setScraperBusy(job.id);
    try {
      await fetch("/api/admin/scrapers", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "run", id: job.id }),
      });
      await loadScrapers();
      await loadStats();
    } finally {
      setScraperBusy("");
    }
  }

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
              void loadUsers(userPage, userPlanFilter);
              void loadThreads(threadPage);
              void loadArticles(articlePage, articleScoreFilter);
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
          <button type="button" className={navBtn} style={{ color: "var(--foreground)" }} onClick={() => scrollToId("subscribers")}>
            <span style={{ color: "var(--green)" }}>◈</span> Subscribers
            {stats?.subscribers?.pro ? <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px]" style={{ background: "rgba(0,187,102,0.15)", color: "var(--green)" }}>{stats.subscribers.pro} PRO</span> : null}
          </button>
          <button type="button" className={navBtn} style={{ color: "var(--foreground)" }} onClick={() => scrollToId("traffic")}>
            Traffic &amp; API
          </button>
          <button type="button" className={navBtn} style={{ color: "var(--foreground)" }} onClick={() => scrollToId("community")}>
            Community
          </button>
          <button type="button" className={navBtn} style={{ color: "var(--foreground)" }} onClick={() => scrollToId("content")}>
            Content
          </button>
          <button type="button" className={navBtn} style={{ color: "var(--foreground)" }} onClick={() => scrollToId("contact")}>
            Inbox
            {stats?.contact?.unread ? <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px]" style={{ background: "rgba(255,100,100,0.15)", color: "#ff8888" }}>{stats.contact.unread}</span> : null}
          </button>
          <button type="button" className={navBtn} style={{ color: "var(--foreground)" }} onClick={() => scrollToId("scrapers")}>
            Scrapers
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
              <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 mb-4">
                <StatTile title="PRO subscribers" value={stats.subscribers?.pro ?? 0} sub={`MRR: $${stats.subscribers?.mrr ?? 0}`} />
                <StatTile title="Free users" value={stats.subscribers?.free ?? 0} sub={`+${stats.subscribers?.newLast7d ?? 0} last 7d`} />
                <StatTile title="Page views (24h)" value={stats.pageViews.last24h} sub={`7d: ${stats.pageViews.last7d}`} />
                <StatTile title="Articles indexed" value={stats.content.totalArticles} sub={`${stats.content.oracleAnalyses} oracle · ${stats.content.threads} threads`} />
                <StatTile title="API errors (24h)" value={stats.api.errors24h} danger={stats.api.errors24h > 0} sub={`of ${stats.api.calls24h} calls · avg ${stats.api.avgMs}ms`} />
                <StatTile title="Unread inbox" value={stats.contact.unread} danger={stats.contact.unread > 0} />
              </div>
            )}
            {!stats && !err && (
              <p className="text-sm" style={{ color: muted }}>Loading metrics…</p>
            )}
          </section>

          {/* ── SUBSCRIBERS ── */}
          <section id="subscribers" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-raj text-sm font-bold uppercase tracking-[0.15em]" style={{ color: muted }}>
                ◈ Subscribers
              </h2>
              <div className="flex flex-wrap gap-2">
                {(["all", "pro", "free"] as const).map((f) => (
                  <button key={f} type="button"
                    onClick={() => { setUserPlanFilter(f); void loadUsers(1, f); }}
                    className="rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      borderColor: userPlanFilter === f ? "var(--green-dark)" : "#1a2a22",
                      background: userPlanFilter === f ? "rgba(0,187,102,0.08)" : "transparent",
                      color: userPlanFilter === f ? "var(--green)" : muted,
                    }}
                  >{f}</button>
                ))}
              </div>
            </div>

            {/* Revenue tiles */}
            {userSummary && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-lg p-4" style={{ background: cardBg, border }}>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: muted }}>MRR</div>
                  <div className="font-raj text-3xl font-bold" style={{ color: "var(--green)" }}>${userSummary.mrr}</div>
                  <div className="text-[11px] mt-1" style={{ color: muted }}>$7 × {userSummary.totalPro} PRO</div>
                </div>
                <div className="rounded-lg p-4" style={{ background: cardBg, border }}>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: muted }}>ARR (projected)</div>
                  <div className="font-raj text-3xl font-bold" style={{ color: "#00ff88" }}>${userSummary.mrr * 12}</div>
                  <div className="text-[11px] mt-1" style={{ color: muted }}>annualized</div>
                </div>
                <div className="rounded-lg p-4" style={{ background: cardBg, border }}>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: muted }}>PRO subscribers</div>
                  <div className="font-raj text-3xl font-bold" style={{ color: "var(--foreground)" }}>{userSummary.totalPro}</div>
                  <div className="text-[11px] mt-1" style={{ color: muted }}>active</div>
                </div>
                <div className="rounded-lg p-4" style={{ background: cardBg, border }}>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: muted }}>Free users</div>
                  <div className="font-raj text-3xl font-bold" style={{ color: "var(--foreground)" }}>{userSummary.totalFree}</div>
                  <div className="text-[11px] mt-1" style={{ color: muted }}>conversion pool</div>
                </div>
              </div>
            )}

            {/* User table */}
            <div className="overflow-hidden rounded-lg" style={{ background: cardBg, border }}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] border-collapse text-left text-[13px]">
                  <thead>
                    <tr style={{ background: "#0a100c" }}>
                      {["Email", "Plan", "Status", "Period end", "Stripe sub", "Registered", "Last login", "Actions"].map((h) => (
                        <th key={h} className="border-b px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-[13px]" style={{ color: muted }}>No users found.</td></tr>
                    )}
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-[#0f1510]">
                        <td className="max-w-[180px] truncate border-b px-3 py-2.5 font-mono text-[11px]" style={{ borderColor: "#111816", color: "var(--foreground)" }}>{u.email}</td>
                        <td className="whitespace-nowrap border-b px-3 py-2.5" style={{ borderColor: "#111816" }}>
                          <span className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wider" style={{
                            border: `1px solid ${u.plan === "pro" ? "var(--green-dark)" : "#1a2a22"}`,
                            color: u.plan === "pro" ? "var(--green)" : muted,
                            background: u.plan === "pro" ? "rgba(0,187,102,0.10)" : "transparent",
                          }}>{u.plan}</span>
                        </td>
                        <td className="whitespace-nowrap border-b px-3 py-2.5 text-[11px]" style={{ borderColor: "#111816", color: u.subscription_status === "active" ? "var(--green)" : u.subscription_status === "canceled" ? "#ff8888" : muted }}>
                          {u.subscription_status ?? "—"}
                        </td>
                        <td className="whitespace-nowrap border-b px-3 py-2.5 text-[12px]" style={{ borderColor: "#111816", color: muted }}>
                          {u.subscription_current_period_end ? new Date(u.subscription_current_period_end).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td className="border-b px-3 py-2.5 font-mono text-[10px]" style={{ borderColor: "#111816", color: muted }}>
                          {u.stripe_subscription_id ? (
                            <a href={`https://dashboard.stripe.com/subscriptions/${u.stripe_subscription_id}`} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--green-dim)" }}>
                              {u.stripe_subscription_id.slice(0, 14)}…
                            </a>
                          ) : "—"}
                        </td>
                        <td className="whitespace-nowrap border-b px-3 py-2.5 text-[12px]" style={{ borderColor: "#111816", color: muted }}>
                          {new Date(u.created_at).toLocaleDateString("en-GB")}
                        </td>
                        <td className="whitespace-nowrap border-b px-3 py-2.5 text-[12px]" style={{ borderColor: "#111816", color: muted }}>
                          {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td className="border-b px-3 py-2.5" style={{ borderColor: "#111816" }}>
                          <div className="flex gap-1.5">
                            {u.plan === "free" ? (
                              <button
                                type="button"
                                disabled={userBusy === u.id}
                                onClick={() => void changeUserPlan(u.id, "pro")}
                                className="rounded border px-2 py-1 text-[10px] uppercase tracking-wide disabled:opacity-40"
                                style={{ borderColor: "var(--green-dark)", color: "var(--green)" }}
                              >→ PRO</button>
                            ) : (
                              <button
                                type="button"
                                disabled={userBusy === u.id}
                                onClick={() => void changeUserPlan(u.id, "free")}
                                className="rounded border px-2 py-1 text-[10px] uppercase tracking-wide disabled:opacity-40"
                                style={{ borderColor: "#4a1a1a", color: "#ff8888" }}
                              >→ Free</button>
                            )}
                            {u.stripe_customer_id && (
                              <a
                                href={`https://dashboard.stripe.com/customers/${u.stripe_customer_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded border px-2 py-1 text-[10px] uppercase tracking-wide no-underline"
                                style={{ borderColor: "#1a2a22", color: muted }}
                              >Stripe ↗</a>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {userTotal > 50 && (
                <div className="flex items-center gap-3 border-t px-4 py-3" style={{ borderColor: "#1a2a22" }}>
                  <button type="button" disabled={userPage <= 1} onClick={() => { const p = userPage - 1; void loadUsers(p, userPlanFilter); }} className="rounded border px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ borderColor: "#1a2a22", color: muted }}>← Prev</button>
                  <span className="text-[12px]" style={{ color: muted }}>Page {userPage} · {userTotal} total</span>
                  <button type="button" disabled={userPage * 50 >= userTotal} onClick={() => { const p = userPage + 1; void loadUsers(p, userPlanFilter); }} className="rounded border px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ borderColor: "#1a2a22", color: muted }}>Next →</button>
                </div>
              )}
            </div>
          </section>

          {/* ── TRAFFIC ── */}
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

          {/* ── COMMUNITY ── */}
          <section id="community" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-raj text-sm font-bold uppercase tracking-[0.15em]" style={{ color: muted }}>
                Community threads
              </h2>
              <button type="button" onClick={() => void loadThreads(threadPage)} className="rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ borderColor: "#1a2a22", color: muted }}>
                Refresh
              </button>
            </div>

            {threadSummary && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg p-4" style={{ background: cardBg, border }}>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: muted }}>Total threads</div>
                  <div className="font-raj text-2xl font-bold" style={{ color: "var(--foreground)" }}>{threadSummary.total}</div>
                </div>
                <div className="rounded-lg p-4" style={{ background: cardBg, border }}>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: muted }}>Oracle analyzed</div>
                  <div className="font-raj text-2xl font-bold" style={{ color: "var(--green)" }}>{threadSummary.oracleAnalyzed}</div>
                </div>
                <div className="rounded-lg p-4" style={{ background: cardBg, border }}>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: muted }}>Removed</div>
                  <div className="font-raj text-2xl font-bold" style={{ color: threadSummary.removed > 0 ? "#ffaa66" : muted }}>{threadSummary.removed}</div>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-lg" style={{ background: cardBg, border }}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-left text-[13px]">
                  <thead>
                    <tr style={{ background: "#0a100c" }}>
                      {["Title", "Author", "Category", "Posts", "Credibility", "Oracle", "Date", "Actions"].map((h) => (
                        <th key={h} className="border-b px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {threads.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-[13px]" style={{ color: muted }}>No threads found.</td></tr>
                    )}
                    {threads.map((t) => (
                      <tr key={t.id} className="hover:bg-[#0f1510]">
                        <td className="max-w-[200px] border-b px-3 py-2.5" style={{ borderColor: "#111816" }}>
                          <a href={`/community?thread=${t.id}`} target="_blank" rel="noreferrer" className="text-[12px] no-underline hover:underline line-clamp-1" style={{ color: "var(--foreground)" }}>
                            {t.title}
                          </a>
                        </td>
                        <td className="max-w-[100px] truncate border-b px-3 py-2.5 text-[11px]" style={{ borderColor: "#111816", color: muted }}>{t.author_name}</td>
                        <td className="whitespace-nowrap border-b px-3 py-2.5 text-[11px] uppercase" style={{ borderColor: "#111816", color: muted }}>{t.category}</td>
                        <td className="border-b px-3 py-2.5 text-center text-[12px] tabular-nums" style={{ borderColor: "#111816", color: "var(--foreground)" }}>{t.post_count ?? 0}</td>
                        <td className="border-b px-3 py-2.5 text-center text-[12px] tabular-nums" style={{ borderColor: "#111816", color: t.credibility_score && t.credibility_score >= 60 ? "var(--green)" : muted }}>
                          {t.credibility_score != null ? `${t.credibility_score}%` : "—"}
                        </td>
                        <td className="border-b px-3 py-2.5 text-center text-[11px]" style={{ borderColor: "#111816", color: t.oracle_analyzed ? "var(--green)" : muted }}>
                          {t.oracle_analyzed ? "✓" : "—"}
                        </td>
                        <td className="whitespace-nowrap border-b px-3 py-2.5 text-[11px]" style={{ borderColor: "#111816", color: muted }}>
                          {new Date(t.created_at).toLocaleDateString("en-GB")}
                        </td>
                        <td className="border-b px-3 py-2.5" style={{ borderColor: "#111816" }}>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={threadBusy === t.id}
                              onClick={() => void removeThread(t.id, false)}
                              className="rounded border px-2 py-1 text-[10px] uppercase tracking-wide disabled:opacity-40"
                              style={{ borderColor: "#4a2a1a", color: "#ffaa66" }}
                            >Hide</button>
                            <button
                              type="button"
                              disabled={threadBusy === t.id}
                              onClick={() => void removeThread(t.id, true)}
                              className="rounded border px-2 py-1 text-[10px] uppercase tracking-wide disabled:opacity-40"
                              style={{ borderColor: "#4a1a1a", color: "#ff8888" }}
                            >Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {threadTotal > 40 && (
                <div className="flex items-center gap-3 border-t px-4 py-3" style={{ borderColor: "#1a2a22" }}>
                  <button type="button" disabled={threadPage <= 1} onClick={() => void loadThreads(threadPage - 1)} className="rounded border px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ borderColor: "#1a2a22", color: muted }}>← Prev</button>
                  <span className="text-[12px]" style={{ color: muted }}>Page {threadPage} · {threadTotal} total</span>
                  <button type="button" disabled={threadPage * 40 >= threadTotal} onClick={() => void loadThreads(threadPage + 1)} className="rounded border px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ borderColor: "#1a2a22", color: muted }}>Next →</button>
                </div>
              )}
            </div>
          </section>

          {/* ── CONTENT ── */}
          <section id="content" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-raj text-sm font-bold uppercase tracking-[0.15em]" style={{ color: muted }}>
                Content — Articles
              </h2>
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[11px]" style={{ color: muted }}>Min threat score:</span>
                {[0, 50, 75, 90].map((s) => (
                  <button key={s} type="button"
                    onClick={() => { setArticleScoreFilter(s); void loadArticles(1, s); }}
                    className="rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
                    style={{
                      borderColor: articleScoreFilter === s ? "var(--green-dark)" : "#1a2a22",
                      background: articleScoreFilter === s ? "rgba(0,187,102,0.08)" : "transparent",
                      color: articleScoreFilter === s ? "var(--green)" : muted,
                    }}
                  >{s === 0 ? "All" : `${s}%+`}</button>
                ))}
              </div>
            </div>

            {articleSummary && (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg p-4" style={{ background: cardBg, border }}>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: muted }}>Total articles</div>
                  <div className="font-raj text-2xl font-bold" style={{ color: "var(--foreground)" }}>{articleSummary.totalArticles}</div>
                </div>
                <div className="rounded-lg p-4" style={{ background: cardBg, border }}>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: muted }}>High threat (75%+)</div>
                  <div className="font-raj text-2xl font-bold" style={{ color: "#ff6666" }}>{articleSummary.highThreat}</div>
                </div>
                <div className="rounded-lg p-4" style={{ background: cardBg, border }}>
                  <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: muted }}>Oracle analyses</div>
                  <div className="font-raj text-2xl font-bold" style={{ color: "var(--green)" }}>{articleSummary.oracleAnalyses}</div>
                </div>
              </div>
            )}

            <div className="overflow-hidden rounded-lg" style={{ background: cardBg, border }}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-left text-[13px]">
                  <thead>
                    <tr style={{ background: "#0a100c" }}>
                      {["Title", "Section", "Score", "Oracle", "Source", "Date", "Actions"].map((h) => (
                        <th key={h} className="border-b px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {articles.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-8 text-center text-[13px]" style={{ color: muted }}>No articles found.</td></tr>
                    )}
                    {articles.map((a) => (
                      <tr key={a.id} className="hover:bg-[#0f1510]">
                        <td className="max-w-[280px] border-b px-3 py-2.5" style={{ borderColor: "#111816" }}>
                          <a href={`/article/${a.id}`} target="_blank" rel="noreferrer" className="text-[12px] no-underline hover:underline line-clamp-2" style={{ color: "var(--foreground)" }}>
                            {a.title}
                          </a>
                        </td>
                        <td className="whitespace-nowrap border-b px-3 py-2.5 text-[11px] uppercase" style={{ borderColor: "#111816", color: muted }}>{a.section}</td>
                        <td className="whitespace-nowrap border-b px-3 py-2.5 text-center" style={{ borderColor: "#111816" }}>
                          <span className="font-raj text-[13px] font-bold" style={{ color: a.score >= 75 ? "#ff6666" : a.score >= 50 ? "#ffaa00" : "var(--green)" }}>
                            {a.score}%
                          </span>
                        </td>
                        <td className="border-b px-3 py-2.5 text-center text-[11px]" style={{ borderColor: "#111816", color: a.has_oracle ? "var(--green)" : muted }}>
                          {a.has_oracle ? "✓" : "—"}
                        </td>
                        <td className="max-w-[100px] truncate border-b px-3 py-2.5 text-[11px]" style={{ borderColor: "#111816", color: muted }}>
                          {a.source ?? "—"}
                        </td>
                        <td className="whitespace-nowrap border-b px-3 py-2.5 text-[11px]" style={{ borderColor: "#111816", color: muted }}>
                          {new Date(a.date).toLocaleDateString("en-GB")}
                        </td>
                        <td className="border-b px-3 py-2.5" style={{ borderColor: "#111816" }}>
                          <div className="flex gap-1.5">
                            <a href={`/board/${a.id}`} target="_blank" rel="noreferrer" className="rounded border px-2 py-1 text-[10px] uppercase tracking-wide no-underline" style={{ borderColor: "var(--green-dark)", color: "var(--green-dim)" }}>Board ↗</a>
                            <button
                              type="button"
                              disabled={articleBusy === a.id}
                              onClick={() => void deleteArticle(a.id, a.title)}
                              className="rounded border px-2 py-1 text-[10px] uppercase tracking-wide disabled:opacity-40"
                              style={{ borderColor: "#4a1a1a", color: "#ff8888" }}
                            >Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {articleTotal > 40 && (
                <div className="flex items-center gap-3 border-t px-4 py-3" style={{ borderColor: "#1a2a22" }}>
                  <button type="button" disabled={articlePage <= 1} onClick={() => void loadArticles(articlePage - 1, articleScoreFilter)} className="rounded border px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ borderColor: "#1a2a22", color: muted }}>← Prev</button>
                  <span className="text-[12px]" style={{ color: muted }}>Page {articlePage} · {articleTotal} total</span>
                  <button type="button" disabled={articlePage * 40 >= articleTotal} onClick={() => void loadArticles(articlePage + 1, articleScoreFilter)} className="rounded border px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ borderColor: "#1a2a22", color: muted }}>Next →</button>
                </div>
              )}
            </div>
          </section>

          {/* ── SCRAPERS ── */}
          <section id="scrapers" className="space-y-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-raj text-sm font-bold uppercase tracking-[0.15em]" style={{ color: muted }}>
                Scrapers
              </h2>
              <button
                type="button"
                onClick={() => void loadScrapers()}
                className="rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
                style={{ borderColor: "#1a2a22", color: muted }}
              >
                Refresh jobs
              </button>
            </div>
            <div className="rounded-lg p-3 text-[12px]" style={{ background: cardBg, border, color: muted }}>
              Vercel cron pings <code className="text-[var(--green-dim)]">/api/scheduler/tick</code> once daily (09:00 UTC on Hobby).
              Each job’s cron should use the same minute and hour so both can run in that tick; use Run now anytime. Schedules are matched in{" "}
              <strong style={{ color: "var(--foreground)" }}>UTC</strong>; under each field you’ll see a plain-English summary.
              <span className="mt-2 block text-[11px]" style={{ color: muted }}>
                Runs need <code style={{ color: "var(--green-dim)" }}>CRON_SECRET</code> (news) and{" "}
                <code style={{ color: "var(--green-dim)" }}>SCRAPER_SECRET</code> (UAP) on Vercel, plus{" "}
                <code style={{ color: "var(--green-dim)" }}>OPENAI_API_KEY</code> for news scoring.
              </span>
            </div>
            <div className="space-y-3">
              {scrapers.map((job) => {
                const running = scraperBusy === job.id;
                const last = job.last_run;
                return (
                  <div key={job.id} className="rounded-lg p-4" style={{ background: cardBg, border }}>
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-raj text-base font-bold text-[var(--foreground)]">{job.name}</div>
                        <div className="text-[11px]" style={{ color: muted }}>
                          {job.job_key} · {job.target}
                        </div>
                      </div>
                      <span
                        className="rounded px-2 py-1 text-[10px] uppercase tracking-wider"
                        style={{
                          border: "1px solid #1a2a22",
                          color: job.enabled ? "var(--green)" : muted,
                          background: job.enabled ? "rgba(0,187,102,0.08)" : "transparent",
                        }}
                      >
                        {job.enabled ? "enabled" : "disabled"}
                      </span>
                    </div>
                    <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto] sm:items-start">
                      <div className="min-w-0">
                        <input
                          key={`${job.id}-${job.schedule_cron}`}
                          defaultValue={job.schedule_cron}
                          onBlur={(e) => {
                            const next = e.currentTarget.value.trim();
                            if (next && next !== job.schedule_cron) {
                              void updateScraper(job, { schedule_cron: next });
                            }
                          }}
                          className="w-full rounded border px-3 py-2 font-mono text-[12px]"
                          style={{ borderColor: "#1a2a22", background: "#050805", color: "var(--foreground)" }}
                          aria-label={`Cron schedule for ${job.name}`}
                        />
                        <div className="mt-1.5 text-[11px] leading-snug" style={{ color: "var(--green-dim)" }}>
                          {humanizeCronUtc(job.schedule_cron)}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={running}
                        onClick={() => void updateScraper(job, { enabled: !job.enabled })}
                        className="rounded border px-3 py-2 text-[11px] uppercase tracking-wider disabled:opacity-50"
                        style={{ borderColor: "#1a2a22", color: muted }}
                      >
                        {job.enabled ? "Disable" : "Enable"}
                      </button>
                      <button
                        type="button"
                        disabled={running}
                        onClick={() => void runScraperNow(job)}
                        className="rounded border px-3 py-2 text-[11px] uppercase tracking-wider disabled:opacity-50"
                        style={{ borderColor: "var(--green-dark)", color: "var(--green)" }}
                      >
                        {running ? "Running…" : "Run now"}
                      </button>
                      {job.target === "uap_scraper" && (
                        <button
                          type="button"
                          disabled={running}
                          onClick={() => {
                            const current = Number(job.config?.max_new ?? 70) || 70;
                            const raw = prompt("UAP max_new (1-120):", String(current));
                            if (!raw) return;
                            const val = Math.min(Math.max(parseInt(raw, 10) || 70, 1), 120);
                            void updateScraper(job, { config: { ...(job.config ?? {}), max_new: val } });
                          }}
                          className="rounded border px-3 py-2 text-[11px] uppercase tracking-wider disabled:opacity-50"
                          style={{ borderColor: "#1a2a22", color: muted }}
                        >
                          Set max_new
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-2 text-[12px] sm:grid-cols-3">
                      <div style={{ color: muted }}>
                        Last run:{" "}
                        <span style={{ color: "var(--foreground)" }}>
                          {last ? new Date(last.started_at).toLocaleString("en-GB") : "never"}
                        </span>
                      </div>
                      <div style={{ color: muted }}>
                        Status:{" "}
                        <span
                          style={{
                            color:
                              !last ? muted : last.status === "success" ? "var(--green)" : last.status === "running" ? "#ffaa66" : "#ff8888",
                          }}
                        >
                          {last?.status ?? "n/a"}
                        </span>
                      </div>
                      <div style={{ color: muted }}>
                        Duration:{" "}
                        <span style={{ color: "var(--foreground)" }}>
                          {last?.duration_ms != null ? `${Math.round(last.duration_ms / 1000)}s` : "n/a"}
                        </span>
                      </div>
                    </div>
                    {last?.error_text && (
                      <div className="mt-2 rounded border px-3 py-2 text-[11px]" style={{ borderColor: "#4a1a1a", color: "#ff9b9b", background: "rgba(255,51,51,0.08)" }}>
                        {last.error_text}
                      </div>
                    )}
                  </div>
                );
              })}
              {scrapers.length === 0 && (
                <div className="rounded-lg px-4 py-8 text-center text-[13px]" style={{ background: cardBg, border, color: muted }}>
                  No scraper jobs found. Apply latest migration first.
                </div>
              )}
            </div>
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
                  <li><code className="text-[var(--green-dim)]">news_items</code> — feed index count</li>
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
