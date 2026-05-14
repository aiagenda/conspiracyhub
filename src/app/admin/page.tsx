"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { PAGE_CONTENT_MAX, PAGE_CONTENT_PADDING } from "@/lib/pageShell";
import { humanizeCronUtc } from "@/lib/cronHuman";
import { ANALYTICS_SUPPRESS_LOCAL_STORAGE_KEY } from "@/lib/analyticsExclude";

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
  /** Total page loads (same path, incl. repeat visits). */
  view_count?: number;
  /** Distinct viewers (fingerprint); best signal for “what people open”. */
  unique_viewers?: number;
}

interface AdminBlogPost {
  id: string;
  title: string;
  slug: string;
  published_at: string;
  category: string;
  status: string;
  view_count: number;
  unique_viewers: number;
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
  result: { success?: boolean; article?: { title?: string; url?: string; slug?: string } } | null;
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

  const [blogPosts, setBlogPosts] = useState<AdminBlogPost[]>([]);
  const [blogTotal, setBlogTotal] = useState(0);
  const [blogPage, setBlogPage] = useState(1);
  /** `delete_all` | `sanitize` | generated article id */
  const [blogAdminBusy, setBlogAdminBusy] = useState<string>("");

  const [analyticsViewerId, setAnalyticsViewerId] = useState<string | null>(null);
  const [analyticsClientIp, setAnalyticsClientIp] = useState<string | null>(null);
  const [analyticsSuppress, setAnalyticsSuppress] = useState(false);

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

  const loadBlogPosts = useCallback(async (page = 1) => {
    const res = await fetch(`/api/admin/generated-articles?page=${page}`);
    if (!res.ok) return;
    const d = await res.json() as { posts?: AdminBlogPost[]; total?: number };
    setBlogPosts(d.posts ?? []);
    setBlogTotal(d.total ?? 0);
    setBlogPage(page);
  }, []);

  useEffect(() => {
    loadStats();
    loadMessages();
    loadScrapers();
    loadUsers();
    loadThreads();
    loadArticles();
    void loadBlogPosts(1);
  }, [loadStats, loadMessages, loadScrapers, loadUsers, loadThreads, loadArticles, loadBlogPosts]);

  useEffect(() => {
    try {
      setAnalyticsSuppress(typeof window !== "undefined" && localStorage.getItem(ANALYTICS_SUPPRESS_LOCAL_STORAGE_KEY) === "1");
    } catch {
      /* */
    }
    void fetch("/api/track/viewer-id")
      .then((r) => r.json())
      .then((d: { fingerprint?: string; client_ip?: string }) => {
        if (typeof d.fingerprint === "string") setAnalyticsViewerId(d.fingerprint);
        if (typeof d.client_ip === "string" && d.client_ip !== "unknown") setAnalyticsClientIp(d.client_ip);
        else setAnalyticsClientIp(null);
      })
      .catch(() => {});
  }, []);

  function setAnalyticsSuppressBrowser(next: boolean) {
    try {
      if (next) localStorage.setItem(ANALYTICS_SUPPRESS_LOCAL_STORAGE_KEY, "1");
      else localStorage.removeItem(ANALYTICS_SUPPRESS_LOCAL_STORAGE_KEY);
    } catch {
      /* */
    }
    setAnalyticsSuppress(next);
  }

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

  async function deleteBlogPost(id: string, title: string) {
    const short = title.length > 90 ? `${title.slice(0, 90)}…` : title;
    if (!confirm(`Delete investigation report:\n“${short}”?`)) return;
    setBlogAdminBusy(id);
    setErr("");
    try {
      const res = await fetch("/api/admin/generated-articles", {
        method: "DELETE",
        headers: JSON_HEADERS,
        body: JSON.stringify({ id }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setErr(d.error ?? res.statusText);
        return;
      }
      await loadBlogPosts(blogPage);
      await loadStats();
    } finally {
      setBlogAdminBusy("");
    }
  }

  async function deleteAllPublishedReports() {
    if (
      !confirm(
        "Delete ALL published investigation reports on /blog? Cannot be undone. Linked votes and Oracle analyses for those reports are removed.",
      )
    ) {
      return;
    }
    setBlogAdminBusy("delete_all");
    setErr("");
    try {
      const res = await fetch("/api/admin/generated-articles", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "delete_all_published" }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; deleted?: number };
      if (!res.ok) {
        setErr(d.error ?? res.statusText);
        return;
      }
      setBlogPage(1);
      await loadBlogPosts(1);
      await loadStats();
    } finally {
      setBlogAdminBusy("");
    }
  }

  async function sanitizeAllReportSources() {
    if (
      !confirm(
        "Strip non-whitelisted URLs from every generated article’s sources (titles & descriptions stay)? Safe to run more than once.",
      )
    ) {
      return;
    }
    setBlogAdminBusy("sanitize");
    setErr("");
    try {
      const res = await fetch("/api/admin/generated-articles", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "sanitize_all_sources" }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; rowsTouched?: number };
      if (!res.ok) {
        setErr(d.error ?? res.statusText);
        return;
      }
      await loadBlogPosts(blogPage);
    } finally {
      setBlogAdminBusy("");
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

  const feedScraperJobs = useMemo(
    () => scrapers.filter((j) => j.target === "news_scraper" || j.target === "uap_scraper"),
    [scrapers],
  );
  const writerScraperJobs = useMemo(
    () => scrapers.filter((j) => j.target === "article_writer"),
    [scrapers],
  );

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

  function scraperJobCard(job: ScraperJob) {
    const running = scraperBusy === job.id;
    const last = job.last_run;
    const statusColor =
      !last ? muted : last.status === "success" ? "var(--green)" : last.status === "running" ? "#ffaa66" : "#ff8888";

    return (
      <div
        key={job.id}
        className="overflow-hidden rounded-[10px]"
        style={{
          background: "linear-gradient(165deg, rgba(0, 255, 136, 0.06) 0%, transparent 42%), #080c09",
          border: "1px solid #2a3830",
          boxShadow: "0 10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div
          aria-hidden
          style={{
            height: 3,
            background: "linear-gradient(90deg, transparent 0%, rgba(0, 255, 136, 0.45) 35%, rgba(0, 187, 102, 0.25) 65%, transparent 100%)",
          }}
        />
        <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b pb-4" style={{ borderColor: "#1a2620" }}>
            <div className="min-w-0 flex-1">
              <div className="font-raj text-[17px] font-bold leading-tight tracking-wide text-[var(--foreground)]">{job.name}</div>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 font-mono text-[11px] leading-relaxed" style={{ color: muted }}>
                <span className="inline-block rounded-md px-3 py-2 leading-normal" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid #1a2620" }}>
                  {job.job_key}
                </span>
                <span className="opacity-50">·</span>
                <span className="inline-block rounded-md px-3 py-2 leading-normal" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid #1a2620" }}>
                  {job.target}
                </span>
              </div>
            </div>
            <span
              className="shrink-0 rounded-full px-4 py-2 text-[10px] font-semibold uppercase tracking-widest"
              style={{
                border: job.enabled ? "1px solid rgba(0,187,102,0.45)" : "1px solid #1a2620",
                color: job.enabled ? "var(--green)" : muted,
                background: job.enabled ? "rgba(0,187,102,0.12)" : "rgba(0,0,0,0.2)",
                boxShadow: job.enabled ? "0 0 20px rgba(0,255,136,0.08)" : "none",
              }}
            >
              {job.enabled ? "Enabled" : "Disabled"}
            </span>
          </div>

          <div className="mb-5 rounded-lg p-5 sm:p-6" style={{ background: "#0a100c", border: "1px solid #1a2620" }}>
            <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--green-dim)" }}>
              Cron (UTC)
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
              <div className="min-w-0 flex-1 sm:min-w-[220px]">
                <input
                  key={`${job.id}-${job.schedule_cron}`}
                  defaultValue={job.schedule_cron}
                  onBlur={(e) => {
                    const next = e.currentTarget.value.trim();
                    if (next && next !== job.schedule_cron) {
                      void updateScraper(job, { schedule_cron: next });
                    }
                  }}
                  className="box-border w-full min-h-[48px] rounded-md border px-4 py-3.5 font-mono text-[13px] leading-normal outline-none transition-[border-color,box-shadow] focus:border-[rgba(0,187,102,0.5)] focus:shadow-[0_0_0_1px_rgba(0,187,102,0.25)]"
                  style={{ borderColor: "#24322c", background: "#050805", color: "var(--foreground)" }}
                  aria-label={`Cron schedule for ${job.name}`}
                />
                <div className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--green-dim)" }}>
                  {humanizeCronUtc(job.schedule_cron)}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <button
                  type="button"
                  disabled={running}
                  onClick={() => void updateScraper(job, { enabled: !job.enabled })}
                  className="rounded-md border px-4 py-3 text-[11px] font-semibold uppercase tracking-wider transition-colors hover:bg-[#0f1812] disabled:opacity-50"
                  style={{ borderColor: "#2a3830", color: muted }}
                >
                  {job.enabled ? "Disable" : "Enable"}
                </button>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => void runScraperNow(job)}
                  className="rounded-md border px-4 py-3 text-[11px] font-semibold uppercase tracking-wider transition-[background,box-shadow] disabled:opacity-50"
                  style={{
                    borderColor: "var(--green-dark)",
                    color: "var(--green)",
                    background: "rgba(0,187,102,0.1)",
                    boxShadow: "inset 0 1px 0 rgba(0,255,136,0.12)",
                  }}
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
                    className="rounded-md border px-4 py-3 text-[11px] font-semibold uppercase tracking-wider transition-colors hover:bg-[#0f1812] disabled:opacity-50"
                    style={{ borderColor: "#2a3830", color: muted }}
                  >
                    Set max_new
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg px-5 py-4 sm:px-6 sm:py-5" style={{ background: "#060a08", border: "1px solid #1a221c" }}>
            <div className="grid grid-cols-1 gap-4 text-[12px] sm:grid-cols-3 sm:gap-6">
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: muted }}>
                  Last run
                </div>
                <div className="font-mono text-[13px]" style={{ color: "var(--foreground)" }}>
                  {last ? new Date(last.started_at).toLocaleString("en-GB") : "—"}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: muted }}>
                  Status
                </div>
                <div className="font-mono text-[13px] font-semibold uppercase" style={{ color: statusColor }}>
                  {last?.status ?? "n/a"}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: muted }}>
                  Duration
                </div>
                <div className="font-mono text-[13px]" style={{ color: "var(--foreground)" }}>
                  {last?.duration_ms != null ? `${Math.round(last.duration_ms / 1000)}s` : "—"}
                </div>
              </div>
            </div>
          </div>

          {last?.error_text && (
            <div
              className="mt-4 rounded-lg border px-5 py-4 text-[12px] leading-relaxed"
              style={{ borderColor: "#4a1a1a", color: "#ff9b9b", background: "rgba(255,51,51,0.08)" }}
            >
              {last.error_text}
            </div>
          )}
          {job.target === "article_writer" && last?.status === "success" && last.result?.article && (
            <div
              className="mt-4 rounded-lg border px-5 py-4 text-[12px] sm:py-5"
              style={{ borderColor: "#1a3320", background: "rgba(0,187,102,0.06)" }}
            >
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--green-dim)" }}>
                Last article
              </div>
              <a
                href={last.result.article.url ?? `/blog/${last.result.article.slug ?? ""}`}
                target="_blank"
                rel="noreferrer"
                className="inline-block font-raj text-[13px] font-semibold leading-snug underline decoration-[rgba(0,255,136,0.35)] underline-offset-2 transition-colors hover:text-[#7dffbc]"
                style={{ color: "var(--green)" }}
              >
                {last.result.article.title ?? last.result.article.slug ?? "View article"}
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  function selectMessage(m: Message) {
    setSelectedMsg(m);
    if (!m.read) void markRead(m.id, true);
    queueMicrotask(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  const navBtn =
    "w-full rounded-md border border-transparent px-4 py-3.5 text-left text-[13px] transition-colors hover:border-[#1a2a22] hover:bg-[#0f1510]";

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
              void loadBlogPosts(blogPage);
              void loadScrapers();
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
          <button type="button" className={navBtn} style={{ color: "var(--foreground)" }} onClick={() => scrollToId("scrapers-feed")}>
            Feed scrapers
          </button>
          <button type="button" className={navBtn} style={{ color: "var(--foreground)" }} onClick={() => scrollToId("scrapers-writers")}>
            Investigation writers
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
                        <th key={h} className="border-b px-4 py-4 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-[13px]" style={{ color: muted }}>No users found.</td></tr>
                    )}
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-[#0f1510]">
                        <td className="max-w-[180px] truncate border-b px-4 py-4 font-mono text-[11px]" style={{ borderColor: "#111816", color: "var(--foreground)" }}>{u.email}</td>
                        <td className="whitespace-nowrap border-b px-4 py-4" style={{ borderColor: "#111816" }}>
                          <span className="rounded px-2 py-0.5 text-[10px] uppercase tracking-wider" style={{
                            border: `1px solid ${u.plan === "pro" ? "var(--green-dark)" : "#1a2a22"}`,
                            color: u.plan === "pro" ? "var(--green)" : muted,
                            background: u.plan === "pro" ? "rgba(0,187,102,0.10)" : "transparent",
                          }}>{u.plan}</span>
                        </td>
                        <td className="whitespace-nowrap border-b px-4 py-4 text-[11px]" style={{ borderColor: "#111816", color: u.subscription_status === "active" ? "var(--green)" : u.subscription_status === "canceled" ? "#ff8888" : muted }}>
                          {u.subscription_status ?? "—"}
                        </td>
                        <td className="whitespace-nowrap border-b px-4 py-4 text-[12px]" style={{ borderColor: "#111816", color: muted }}>
                          {u.subscription_current_period_end ? new Date(u.subscription_current_period_end).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td className="border-b px-4 py-4 font-mono text-[10px]" style={{ borderColor: "#111816", color: muted }}>
                          {u.stripe_subscription_id ? (
                            <a href={`https://dashboard.stripe.com/subscriptions/${u.stripe_subscription_id}`} target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--green-dim)" }}>
                              {u.stripe_subscription_id.slice(0, 14)}…
                            </a>
                          ) : "—"}
                        </td>
                        <td className="whitespace-nowrap border-b px-4 py-4 text-[12px]" style={{ borderColor: "#111816", color: muted }}>
                          {new Date(u.created_at).toLocaleDateString("en-GB")}
                        </td>
                        <td className="whitespace-nowrap border-b px-4 py-4 text-[12px]" style={{ borderColor: "#111816", color: muted }}>
                          {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("en-GB") : "—"}
                        </td>
                        <td className="border-b px-4 py-4" style={{ borderColor: "#111816" }}>
                          <div className="flex gap-1.5">
                            {u.plan === "free" ? (
                              <button
                                type="button"
                                disabled={userBusy === u.id}
                                onClick={() => void changeUserPlan(u.id, "pro")}
                                className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide disabled:opacity-40"
                                style={{ borderColor: "var(--green-dark)", color: "var(--green)" }}
                              >→ PRO</button>
                            ) : (
                              <button
                                type="button"
                                disabled={userBusy === u.id}
                                onClick={() => void changeUserPlan(u.id, "free")}
                                className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide disabled:opacity-40"
                                style={{ borderColor: "#4a1a1a", color: "#ff8888" }}
                              >→ Free</button>
                            )}
                            {u.stripe_customer_id && (
                              <a
                                href={`https://dashboard.stripe.com/customers/${u.stripe_customer_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide no-underline"
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
                    <div className="border-t pt-3" style={{ borderColor: "#1a2a22" }}>
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest" style={{ color: muted }}>
                        Exclude your traffic
                      </p>
                      <label className="flex cursor-pointer items-start gap-2 text-[13px] leading-relaxed" style={{ color: muted }}>
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={analyticsSuppress}
                          onChange={(e) => setAnalyticsSuppressBrowser(e.target.checked)}
                        />
                        <span>Do not send page views from this browser (local only).</span>
                      </label>
                      {analyticsViewerId ? (
                        <p className="mt-2 break-all font-mono text-[11px] leading-snug" style={{ color: muted }}>
                          Viewer id — add to server env{" "}
                          <code className="text-[var(--green-dim)]">ANALYTICS_EXCLUDE_FINGERPRINTS</code> to drop past rows from stats:{" "}
                          <span style={{ color: "var(--foreground)" }}>{analyticsViewerId}</span>{" "}
                          <button
                            type="button"
                            className="text-[var(--green)] underline decoration-dotted underline-offset-2"
                            onClick={() => void navigator.clipboard.writeText(analyticsViewerId).catch(() => {})}
                          >
                            Copy
                          </button>
                        </p>
                      ) : null}
                      <p className="mt-2 text-[11px] leading-relaxed" style={{ color: muted }}>
                        Env <code className="text-[var(--green-dim)]">ANALYTICS_EXCLUDE_IPS</code> (comma-separated, same IP the edge sees) excludes that traffic from inserts and from these aggregates everywhere.
                      </p>
                      {analyticsViewerId ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="rounded border px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide"
                            style={{ borderColor: "#1a2a22", color: "var(--green)" }}
                            onClick={() =>
                              void navigator.clipboard
                                .writeText(`ANALYTICS_EXCLUDE_FINGERPRINTS=${analyticsViewerId}`)
                                .catch(() => {})
                            }
                          >
                            Copy exclude-fingerprint line
                          </button>
                          {analyticsClientIp ? (
                            <button
                              type="button"
                              className="rounded border px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-wide"
                              style={{ borderColor: "#1a2a22", color: "var(--green)" }}
                              onClick={() =>
                                void navigator.clipboard
                                  .writeText(`ANALYTICS_EXCLUDE_IPS=${analyticsClientIp}`)
                                  .catch(() => {})
                              }
                            >
                              Copy exclude-IP line
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                      <p className="mt-3 text-[10px] leading-relaxed" style={{ color: muted }}>
                        To wipe all page view rows: apply migration <code className="text-[var(--green-dim)]">20260514120000_reset_page_views</code>{" "}
                        (<code className="text-[var(--green-dim)]">supabase db push</code> or run{" "}
                        <code className="text-[var(--green-dim)]">truncate public.page_views restart identity</code> in the SQL editor), then refresh stats.
                      </p>
                    </div>
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
                            <td className="max-w-[1px] truncate border-b px-4 py-4 font-mono text-[12px]" style={{ borderColor: "#111816", color: "var(--foreground)" }}>
                              {p.path}
                            </td>
                            <td className="border-b px-4 py-4 text-right tabular-nums" style={{ borderColor: "#111816", color: "var(--green)" }}>
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
                            <td className="max-w-[1px] truncate border-b px-4 py-4 font-mono text-[12px]" style={{ borderColor: "#111816", color: "var(--foreground)" }}>
                              {r.route}
                            </td>
                            <td className="border-b px-4 py-4 text-right tabular-nums" style={{ borderColor: "#111816", color: "var(--green)" }}>
                              {r.total}
                            </td>
                            <td className="border-b px-4 py-4 text-right tabular-nums" style={{ borderColor: "#111816", color: r.errors > 0 ? "#ff6666" : muted }}>
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
                            <td className="whitespace-nowrap border-b px-4 py-4 text-[12px]" style={{ borderColor: "#111816", color: muted }}>
                              {new Date(r.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                            </td>
                            <td className="max-w-[140px] truncate border-b px-4 py-4 text-[12px]" style={{ borderColor: "#111816", color: "var(--foreground)" }}>
                              {r.name}
                            </td>
                            <td className="border-b px-4 py-4 text-[12px] uppercase" style={{ borderColor: "#111816", color: muted }}>
                              {r.category}
                            </td>
                            <td className="max-w-[1px] truncate border-b px-4 py-4 text-[12px]" style={{ borderColor: "#111816", color: "var(--foreground)" }}>
                              {r.subject}
                            </td>
                            <td className="border-b px-4 py-4 text-[12px]" style={{ borderColor: "#111816", color: r.read ? muted : "var(--green)" }}>
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
                        <th key={h} className="border-b px-4 py-4 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {threads.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-[13px]" style={{ color: muted }}>No threads found.</td></tr>
                    )}
                    {threads.map((t) => (
                      <tr key={t.id} className="hover:bg-[#0f1510]">
                        <td className="max-w-[200px] border-b px-4 py-4" style={{ borderColor: "#111816" }}>
                          <a href={`/community?thread=${t.id}`} target="_blank" rel="noreferrer" className="text-[12px] no-underline hover:underline line-clamp-1" style={{ color: "var(--foreground)" }}>
                            {t.title}
                          </a>
                        </td>
                        <td className="max-w-[100px] truncate border-b px-4 py-4 text-[11px]" style={{ borderColor: "#111816", color: muted }}>{t.author_name}</td>
                        <td className="whitespace-nowrap border-b px-4 py-4 text-[11px] uppercase" style={{ borderColor: "#111816", color: muted }}>{t.category}</td>
                        <td className="border-b px-4 py-4 text-center text-[12px] tabular-nums" style={{ borderColor: "#111816", color: "var(--foreground)" }}>{t.post_count ?? 0}</td>
                        <td className="border-b px-4 py-4 text-center text-[12px] tabular-nums" style={{ borderColor: "#111816", color: t.credibility_score && t.credibility_score >= 60 ? "var(--green)" : muted }}>
                          {t.credibility_score != null ? `${t.credibility_score}%` : "—"}
                        </td>
                        <td className="border-b px-4 py-4 text-center text-[11px]" style={{ borderColor: "#111816", color: t.oracle_analyzed ? "var(--green)" : muted }}>
                          {t.oracle_analyzed ? "✓" : "—"}
                        </td>
                        <td className="whitespace-nowrap border-b px-4 py-4 text-[11px]" style={{ borderColor: "#111816", color: muted }}>
                          {new Date(t.created_at).toLocaleDateString("en-GB")}
                        </td>
                        <td className="border-b px-4 py-4" style={{ borderColor: "#111816" }}>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              disabled={threadBusy === t.id}
                              onClick={() => void removeThread(t.id, false)}
                              className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide disabled:opacity-40"
                              style={{ borderColor: "#4a2a1a", color: "#ffaa66" }}
                            >Hide</button>
                            <button
                              type="button"
                              disabled={threadBusy === t.id}
                              onClick={() => void removeThread(t.id, true)}
                              className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide disabled:opacity-40"
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

            <p className="text-[11px] leading-relaxed" style={{ color: muted }}>
              <strong style={{ color: "var(--foreground)" }}>Readers</strong> = approx. distinct visitors (fingerprint) on{" "}
              <code className="text-[var(--green-dim)]">/article/&lt;id&gt;</code>. Parenthesised number is total loads when higher. Tracking runs from the site layout (
              <code className="text-[var(--green-dim)]">/api/track</code>
              ); opt-out lives under Traffic.
            </p>

            <div className="overflow-hidden rounded-lg" style={{ background: cardBg, border }}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-left text-[13px]">
                  <thead>
                    <tr style={{ background: "#0a100c" }}>
                      {["Title", "Section", "Score", "Readers", "Oracle", "Source", "Date", "Actions"].map((h) => (
                        <th key={h} className="border-b px-4 py-4 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {articles.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-[13px]" style={{ color: muted }}>No articles found.</td></tr>
                    )}
                    {articles.map((a) => (
                      <tr key={a.id} className="hover:bg-[#0f1510]">
                        <td className="max-w-[280px] border-b px-4 py-4" style={{ borderColor: "#111816" }}>
                          <a href={`/article/${a.id}`} target="_blank" rel="noreferrer" className="text-[12px] no-underline hover:underline line-clamp-2" style={{ color: "var(--foreground)" }}>
                            {a.title}
                          </a>
                        </td>
                        <td className="whitespace-nowrap border-b px-4 py-4 text-[11px] uppercase" style={{ borderColor: "#111816", color: muted }}>{a.section}</td>
                        <td className="whitespace-nowrap border-b px-4 py-4 text-center" style={{ borderColor: "#111816" }}>
                          <span className="font-raj text-[13px] font-bold" style={{ color: a.score >= 75 ? "#ff6666" : a.score >= 50 ? "#ffaa00" : "var(--green)" }}>
                            {a.score}%
                          </span>
                        </td>
                        <td
                          className="whitespace-nowrap border-b px-4 py-4 text-center"
                          style={{ borderColor: "#111816" }}
                          title={
                            typeof a.view_count === "number" && a.view_count > (a.unique_viewers ?? 0)
                              ? `Total page loads (incl. repeats): ${a.view_count}`
                              : "Distinct viewers (browser fingerprint; excludes opted-out traffic)"
                          }
                        >
                          <span className="font-raj text-[13px] font-bold tabular-nums" style={{ color: "var(--green)" }}>
                            {a.unique_viewers ?? a.view_count ?? 0}
                          </span>
                          {typeof a.view_count === "number" &&
                            typeof a.unique_viewers === "number" &&
                            a.view_count > a.unique_viewers && (
                              <span className="ml-1 text-[10px] tabular-nums" style={{ color: muted }}>
                                ({a.view_count})
                              </span>
                            )}
                        </td>
                        <td className="border-b px-4 py-4 text-center text-[11px]" style={{ borderColor: "#111816", color: a.has_oracle ? "var(--green)" : muted }}>
                          {a.has_oracle ? "✓" : "—"}
                        </td>
                        <td className="max-w-[100px] truncate border-b px-4 py-4 text-[11px]" style={{ borderColor: "#111816", color: muted }}>
                          {a.source ?? "—"}
                        </td>
                        <td className="whitespace-nowrap border-b px-4 py-4 text-[11px]" style={{ borderColor: "#111816", color: muted }}>
                          {new Date(a.date).toLocaleDateString("en-GB")}
                        </td>
                        <td className="border-b px-4 py-4" style={{ borderColor: "#111816" }}>
                          <div className="flex gap-1.5">
                            <a href={`/board/${a.id}`} target="_blank" rel="noreferrer" className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide no-underline" style={{ borderColor: "var(--green-dark)", color: "var(--green-dim)" }}>Board ↗</a>
                            <button
                              type="button"
                              disabled={articleBusy === a.id}
                              onClick={() => void deleteArticle(a.id, a.title)}
                              className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide disabled:opacity-40"
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

            <div className="mt-8 space-y-3">
              <h3 className="font-raj text-xs font-bold uppercase tracking-[0.12em]" style={{ color: muted }}>
                Analysis articles (blog)
              </h3>
              <p className="text-[11px] leading-relaxed" style={{ color: muted }}>
                <strong style={{ color: "var(--foreground)" }}>Readers</strong> = distinct fingerprints on{" "}
                <code className="text-[var(--green-dim)]">/blog/&lt;slug&gt;</code> (who opened the page at least once). Number in parentheses is total loads
                when repeat visits exist. Same exclusions as Traffic. Apply migration{" "}
                <code className="text-[var(--green-dim)]">20260514210000</code> for the readers column; older DBs only show totals.
              </p>
              <div className="rounded-lg border p-5 sm:p-6" style={{ background: "rgba(255,100,0,0.04)", borderColor: "#4a3010" }}>
                <div className="font-raj text-[12px] font-bold uppercase tracking-wider" style={{ color: "#ffaa66" }}>
                  Blog maintenance
                </div>
                <p className="mt-3 text-[12px] leading-relaxed" style={{ color: muted }}>
                  Sanitize strips non-whitelisted source URLs in every stored report (titles stay). Delete all removes every published /blog post (votes and Oracle rows for those reports follow DB cascades).
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={blogAdminBusy !== ""}
                    onClick={() => void sanitizeAllReportSources()}
                    className="rounded-md border px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider disabled:opacity-40"
                    style={{ borderColor: "#1a3320", color: "var(--green-dim)" }}
                  >
                    {blogAdminBusy === "sanitize" ? "Sanitizing…" : "Sanitize all source URLs"}
                  </button>
                  <button
                    type="button"
                    disabled={blogAdminBusy !== ""}
                    onClick={() => void deleteAllPublishedReports()}
                    className="rounded-md border px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider disabled:opacity-40"
                    style={{ borderColor: "#4a1a1a", color: "#ff8888" }}
                  >
                    {blogAdminBusy === "delete_all" ? "Deleting…" : "Delete all published reports"}
                  </button>
                </div>
              </div>
              <div className="overflow-hidden rounded-lg" style={{ background: cardBg, border }}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
                    <thead>
                      <tr style={{ background: "#0a100c" }}>
                        {["Title", "Category", "Published", "Readers", "Open", "Actions"].map((h) => (
                          <th key={h} className="border-b px-4 py-4 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {blogPosts.length === 0 && (
                        <tr><td colSpan={6} className="px-4 py-8 text-center text-[13px]" style={{ color: muted }}>No published analysis posts yet.</td></tr>
                      )}
                      {blogPosts.map((p) => (
                        <tr key={p.id} className="hover:bg-[#0f1510]">
                          <td className="max-w-[320px] border-b px-4 py-4" style={{ borderColor: "#111816" }}>
                            <span className="text-[12px] line-clamp-2" style={{ color: "var(--foreground)" }}>{p.title}</span>
                          </td>
                          <td className="whitespace-nowrap border-b px-4 py-4 text-[11px] uppercase" style={{ borderColor: "#111816", color: muted }}>{p.category}</td>
                          <td className="whitespace-nowrap border-b px-4 py-4 text-[11px]" style={{ borderColor: "#111816", color: muted }}>
                            {new Date(p.published_at).toLocaleDateString("en-GB")}
                          </td>
                          <td
                            className="whitespace-nowrap border-b px-4 py-4 text-center"
                            style={{ borderColor: "#111816" }}
                            title={
                              p.view_count > p.unique_viewers
                                ? `Total page loads (incl. repeats): ${p.view_count}`
                                : "Distinct viewers (browser fingerprint; excludes opted-out traffic)"
                            }
                          >
                            <span className="font-raj text-[13px] font-bold tabular-nums" style={{ color: "var(--green)" }}>
                              {p.unique_viewers ?? p.view_count}
                            </span>
                            {p.view_count > p.unique_viewers && (
                              <span className="ml-1 text-[10px] tabular-nums" style={{ color: muted }}>
                                ({p.view_count})
                              </span>
                            )}
                          </td>
                          <td className="border-b px-4 py-4" style={{ borderColor: "#111816" }}>
                            <div className="flex flex-wrap gap-2">
                              <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide no-underline" style={{ borderColor: "var(--green-dark)", color: "var(--green-dim)" }}>View ↗</a>
                              <a href={`/board/${p.id}`} target="_blank" rel="noreferrer" className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide no-underline" style={{ borderColor: "var(--green-dark)", color: "var(--green-dim)" }}>Board ↗</a>
                            </div>
                          </td>
                          <td className="border-b px-4 py-4" style={{ borderColor: "#111816" }}>
                            <button
                              type="button"
                              disabled={blogAdminBusy !== ""}
                              onClick={() => void deleteBlogPost(p.id, p.title)}
                              className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide disabled:opacity-40"
                              style={{ borderColor: "#4a1a1a", color: "#ff8888" }}
                            >
                              {blogAdminBusy === p.id ? "…" : "Delete"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {blogTotal > 30 && (
                  <div className="flex items-center gap-3 border-t px-4 py-3" style={{ borderColor: "#1a2a22" }}>
                    <button type="button" disabled={blogPage <= 1} onClick={() => void loadBlogPosts(blogPage - 1)} className="rounded border px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ borderColor: "#1a2a22", color: muted }}>← Prev</button>
                    <span className="text-[12px]" style={{ color: muted }}>Page {blogPage} · {blogTotal} total</span>
                    <button type="button" disabled={blogPage * 30 >= blogTotal} onClick={() => void loadBlogPosts(blogPage + 1)} className="rounded border px-3 py-1.5 text-[11px] disabled:opacity-40" style={{ borderColor: "#1a2a22", color: muted }}>Next →</button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* ── FEED SCRAPERS (ingest) — separate from investigation writers ── */}
          <section id="scrapers-feed" className="space-y-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-raj text-sm font-bold uppercase tracking-[0.15em]" style={{ color: muted }}>
                Feed scrapers & ingest
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
            <div className="rounded-xl p-5 text-[12px] leading-relaxed sm:p-6 sm:px-7" style={{ background: cardBg, border: "1px solid #24322c", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)", color: muted }}>
              <strong style={{ color: "var(--foreground)" }}>Main news</strong> and <strong style={{ color: "var(--foreground)" }}>NUFORC UAP</strong> jobs only — they pull raw rows into <code className="text-[var(--green-dim)]">news_items</code> /{" "}
              <code className="text-[var(--green-dim)]">uap_sightings</code>. Not the same as the investigation article writers below.
              <span className="mt-2 block text-[11px]" style={{ color: muted }}>
                Vercel cron hits <code className="text-[var(--green-dim)]">/api/scheduler/tick</code> (09:00 UTC on Hobby). Needs{" "}
                <code className="text-[var(--green-dim)]">CRON_SECRET</code>, <code className="text-[var(--green-dim)]">SCRAPER_SECRET</code>, and{" "}
                <code className="text-[var(--green-dim)]">OPENAI_API_KEY</code> for news scoring.
              </span>
            </div>
            <div className="space-y-5">
              {feedScraperJobs.map(scraperJobCard)}
              {scrapers.length === 0 && (
                <div className="rounded-lg px-4 py-8 text-center text-[13px]" style={{ background: cardBg, border, color: muted }}>
                  No scraper jobs found. Apply latest migration first.
                </div>
              )}
              {scrapers.length > 0 && feedScraperJobs.length === 0 && (
                <div className="rounded-lg px-4 py-6 text-center text-[12px]" style={{ background: cardBg, border, color: muted }}>
                  No feed ingest jobs in this database snapshot.
                </div>
              )}
            </div>
          </section>

          {/* ── INVESTIGATION ARTICLE WRITERS (OpenAI → /blog) ── */}
          <section id="scrapers-writers" className="mt-10 space-y-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-raj text-sm font-bold uppercase tracking-[0.15em]" style={{ color: muted }}>
                Investigation article writers
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
            <div className="rounded-xl p-5 text-[12px] leading-relaxed sm:p-6 sm:px-7" style={{ background: cardBg, border: "1px solid #24322c", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)", color: muted }}>
              These jobs call OpenAI and publish long-form reports to <code className="text-[var(--green-dim)]">/blog/&lt;slug&gt;</code>. They are{" "}
              <strong style={{ color: "var(--foreground)" }}>not</strong> the Guardian/GNews/Reddit ingest or the NUFORC scrape — schedule them separately if you want different cadence.
            </div>
            <div className="space-y-5">
              {writerScraperJobs.map(scraperJobCard)}
              {scrapers.length > 0 && writerScraperJobs.length === 0 && (
                <div className="rounded-lg px-4 py-6 text-center text-[12px]" style={{ background: cardBg, border, color: muted }}>
                  No article_writer jobs found.
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
                        <th className="border-b px-4 py-4 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>
                          Status
                        </th>
                        <th className="border-b px-4 py-4 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>
                          Date
                        </th>
                        <th className="border-b px-4 py-4 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>
                          Name
                        </th>
                        <th className="border-b px-4 py-4 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>
                          Email
                        </th>
                        <th className="border-b px-4 py-4 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>
                          Cat
                        </th>
                        <th className="border-b px-4 py-4 text-[10px] font-semibold uppercase tracking-widest" style={{ borderColor: "#1a2a22", color: muted }}>
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
                          <td className="border-b px-4 py-4" style={{ borderColor: "#111816" }}>
                            {!m.read ? (
                              <span className="inline-block h-2 w-2 rounded-full" style={{ background: "var(--green)" }} title="Unread" />
                            ) : (
                              <span className="text-[11px]" style={{ color: muted }}>—</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap border-b px-4 py-4 text-[12px]" style={{ borderColor: "#111816", color: muted }}>
                            {new Date(m.created_at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" })}
                          </td>
                          <td className="max-w-[120px] truncate border-b px-4 py-4 text-[12px]" style={{ borderColor: "#111816", color: "var(--foreground)" }}>
                            {m.name}
                          </td>
                          <td className="max-w-[180px] truncate border-b px-4 py-4 font-mono text-[11px]" style={{ borderColor: "#111816", color: muted }}>
                            {m.email}
                          </td>
                          <td className="whitespace-nowrap border-b px-4 py-4 text-[11px] uppercase" style={{ borderColor: "#111816", color: muted }}>
                            {m.category}
                          </td>
                          <td className="max-w-[1px] truncate border-b px-4 py-4 text-[12px]" style={{ borderColor: "#111816", color: "var(--foreground)" }}>
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
                className="min-h-[280px] rounded-lg p-6 lg:min-h-[360px]"
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
                        className="flex-shrink-0 rounded border px-3 py-2 text-[11px]"
                        style={{ borderColor: "#1a2a22", color: muted }}
                        aria-label="Close detail"
                      >
                        ✕
                      </button>
                    </div>
                    <pre
                      className="mb-4 max-h-[min(50vh,420px)] overflow-auto whitespace-pre-wrap rounded-md border p-5 text-[13px] leading-relaxed"
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
                  <li><code className="text-[var(--green-dim)]">page_views</code> — path + IP-derived fingerprint; omit via env or browser opt-out in Traffic</li>
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
