"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { PAGE_CONTENT_MAX, PAGE_CONTENT_PADDING } from "@/lib/pageShell";
import { humanizeCronUtc } from "@/lib/cronHuman";
import { ANALYTICS_SUPPRESS_LOCAL_STORAGE_KEY } from "@/lib/analyticsExclude";
import { getSupabaseBrowserClient, isSupabaseBrowserConfigured } from "@/lib/supabase";

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
  angle?: string;
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
  has_oracle?: boolean;
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
  /** news_scraper: runScraper() payload; article_writer: { article, success } */
  result: Record<string, unknown> | null;
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
  /** Short summary after manual news ingest (Guardian + GNews + Reddit + RSS). */
  const [newsIngestHint, setNewsIngestHint] = useState<string | null>(null);
  /** Visible on the NUFORC scraper card after “AI briefs”. */
  const [uapBriefHint, setUapBriefHint] = useState<{
    text: string;
    variant: "success" | "error" | "info";
  } | null>(null);

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
  const [rescoreBusyId, setRescoreBusyId] = useState<string>("");
  const [braveBusyId, setBraveBusyId] = useState<string>("");
  const [articleScoreFilter, setArticleScoreFilter] = useState(0);

  const [blogPosts, setBlogPosts] = useState<AdminBlogPost[]>([]);
  const [blogTotal, setBlogTotal] = useState(0);
  const [blogPage, setBlogPage] = useState(1);
  /** `delete_all` | `sanitize` | generated article id */
  const [blogAdminBusy, setBlogAdminBusy] = useState<string>("");
  /** `news:<id>` | `gen:<id>` while Oracle re-run in flight */
  const [oracleRerunBusyKey, setOracleRerunBusyKey] = useState<string>("");
  /** Non-empty label while Oracle RESET ALL (bulk) is running */
  const [bulkOracleBusy, setBulkOracleBusy] = useState<string>("");

  // Lore Dossier Writer
  const [loreTopic, setLoreTopic] = useState("");
  const [loreAngle, setLoreAngle] = useState("");
  const [loreSeedUrls, setLoreSeedUrls] = useState("");
  const [loreGenerating, setLoreGenerating] = useState(false);
  const [loreResult, setLoreResult] = useState<{ ok: boolean; message: string; url?: string } | null>(null);

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

  async function generateLoreDossier() {
    if (!loreTopic.trim()) return;
    setLoreGenerating(true);
    setLoreResult(null);
    try {
      const seedUrls = loreSeedUrls
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u.startsWith("http"));
      const res = await fetch("/api/admin/generate-lore", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ topic: loreTopic.trim(), angle: loreAngle.trim() || undefined, seedUrls }),
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; article?: { url?: string; title?: string }; error?: string };
      if (data.success && data.article) {
        setLoreResult({ ok: true, message: `Published: "${data.article.title}"`, url: data.article.url });
        setLoreTopic("");
        setLoreAngle("");
        setLoreSeedUrls("");
      } else {
        setLoreResult({ ok: false, message: data.error ?? "Unknown error" });
      }
    } catch (e) {
      setLoreResult({ ok: false, message: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoreGenerating(false);
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

  async function adminRescore(id: string) {
    if (!isSupabaseBrowserConfigured()) {
      setErr("Supabase browser client is not configured.");
      return;
    }
    setRescoreBusyId(id);
    setErr("");
    try {
      const {
        data: { session },
      } = await getSupabaseBrowserClient().auth.getSession();
      if (!session?.access_token) {
        setErr("Sign in to this site in this browser (admin account) so the request can be authorized.");
        return;
      }
      const res = await fetch("/api/admin/rescore", {
        method: "POST",
        headers: { ...JSON_HEADERS, Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ newsId: id }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; message?: string; score?: number; angle?: string };
      if (!res.ok) {
        if (res.status === 403 && d.error === "admin_only") {
          setErr("Forbidden: set is_admin = true on your user in user_profiles.");
        } else {
          setErr([d.message, d.error].filter(Boolean).join(" — ") || res.statusText);
        }
        return;
      }
      await loadArticles(articlePage, articleScoreFilter);
    } finally {
      setRescoreBusyId("");
    }
  }

  async function adminBraveRefresh(opts: { newsId?: string; generatedArticleId?: string }) {
    if (!isSupabaseBrowserConfigured()) {
      setErr("Supabase browser client is not configured.");
      return;
    }
    const busyId = opts.newsId ?? opts.generatedArticleId ?? "";
    setBraveBusyId(busyId);
    setErr("");
    try {
      const {
        data: { session },
      } = await getSupabaseBrowserClient().auth.getSession();
      if (!session?.access_token) {
        setErr("Sign in to this site in this browser (admin account) so the request can be authorized.");
        return;
      }
      const res = await fetch("/api/admin/oracle-brave-refresh", {
        method: "POST",
        headers: { ...JSON_HEADERS, Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(opts),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; message?: string; enriched?: number; total?: number };
      if (!res.ok) {
        if (res.status === 403 && d.error === "admin_only") {
          setErr("Forbidden: set is_admin = true on your user in user_profiles.");
        } else if (res.status === 404) {
          setErr("No Oracle analysis yet for this item — run Oracle ↻ first, then Brave ↺.");
        } else {
          setErr([d.message, d.error].filter(Boolean).join(" — ") || res.statusText);
        }
        return;
      }
    } finally {
      setBraveBusyId("");
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

  async function adminOracleRerun(opts: { newsId?: string; generatedArticleId?: string }) {
    if (bulkOracleBusy !== "") return;
    if (!isSupabaseBrowserConfigured()) {
      setErr("Supabase browser client is not configured.");
      return;
    }
    const busyKey = opts.newsId ? `news:${opts.newsId}` : `gen:${opts.generatedArticleId}`;
    if (!confirm("Run a fresh Oracle analysis? (~30–90s, new saved graph). Admin + signed-in session required.")) return;
    setOracleRerunBusyKey(busyKey);
    setErr("");
    try {
      const {
        data: { session },
      } = await getSupabaseBrowserClient().auth.getSession();
      if (!session?.access_token) {
        setErr("Sign in to this site in this browser (admin account) so the request can be authorized.");
        return;
      }
      const res = await fetch("/api/admin/oracle-rerun", {
        method: "POST",
        headers: {
          ...JSON_HEADERS,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(opts),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
      if (!res.ok) {
        if (res.status === 403 && d.error === "admin_only") {
          setErr("Forbidden: set is_admin = true on your user in user_profiles (Supabase SQL).");
        } else {
          setErr([d.message, d.error].filter(Boolean).join(" — ") || res.statusText);
        }
        return;
      }
      if (opts.newsId) await loadArticles(articlePage, articleScoreFilter);
      else await loadBlogPosts(blogPage);
      await loadStats();
    } finally {
      setOracleRerunBusyKey("");
    }
  }

  async function oracleBulkResetAll(scope: "feed" | "analysis") {
    const label = scope === "feed" ? "minden feed cikk (news_items)" : "minden publikált /blog riport";
    if (
      !confirm(
        `Oracle RESET ALL — ${label}\n\nEz TÖRLI az összes meglévő Oracle elemzést ehhez a hatókörhöz.\nA board-ok üresek lesznek — új elemzést majd manuálisan kell indítani.\n\nNEM futtat automatikusan új elemzést. Folytatod?`,
      )
    ) {
      return;
    }
    if (!isSupabaseBrowserConfigured()) {
      setErr("Supabase browser client is not configured.");
      return;
    }
    setErr("");
    setBulkOracleBusy(scope);
    try {
      const {
        data: { session },
      } = await getSupabaseBrowserClient().auth.getSession();
      if (!session?.access_token) {
        setErr("Sign in to this site in this browser (admin account) so the request can be authorized.");
        return;
      }
      const res = await fetch("/api/admin/oracle-rerun-bulk", {
        method: "POST",
        headers: {
          ...JSON_HEADERS,
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ scope }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string; message?: string; deleted?: number };
      if (!res.ok) {
        if (res.status === 403 && d.error === "admin_only") {
          setErr("Forbidden: set is_admin = true on your user in user_profiles (Supabase SQL).");
        } else {
          setErr([d.message, d.error].filter(Boolean).join(" — ") || res.statusText);
        }
        return;
      }
      await loadArticles(articlePage, articleScoreFilter);
      await loadBlogPosts(blogPage);
      await loadStats();
    } finally {
      setBulkOracleBusy("");
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
    () =>
      scrapers.filter(
        (j) =>
          j.target === "news_scraper" || j.target === "uap_scraper" || j.target === "outbreak_scraper",
      ),
    [scrapers],
  );
  const seoScraperJobs = useMemo(
    () => scrapers.filter((j) => j.target === "search_console"),
    [scrapers],
  );
  const writerScraperJobs = useMemo(
    () =>
      scrapers.filter(
        (j) =>
          j.target === "article_writer" &&
          (j.config as { mode?: string } | null)?.mode !== "search_console",
      ),
    [scrapers],
  );
  const gscWriterJobs = useMemo(
    () =>
      scrapers.filter(
        (j) =>
          j.target === "article_writer" &&
          (j.config as { mode?: string } | null)?.mode === "search_console",
      ),
    [scrapers],
  );

  const mainNewsIngestJob = useMemo(() => {
    const news = scrapers.filter((j) => j.target === "news_scraper");
    return news.find((j) => j.job_key === "news_main") ?? news[0] ?? null;
  }, [scrapers]);

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

  async function enrichUapBriefs() {
    setScraperBusy("uap-briefs");
    setUapBriefHint({ text: "Generating intelligence briefs… (may take ~1 min)", variant: "info" });
    try {
      const res = await fetch("/api/admin/scrapers", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "enrich_uap_briefs", limit: 12 }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        result?: {
          payload?: {
            updated?: number;
            scanned?: number;
            skipped_short?: number;
            remaining_without_brief?: number;
          };
        };
      };
      if (!res.ok) {
        const msg = data.error ?? `HTTP ${res.status}`;
        setUapBriefHint({ text: `Failed: ${msg}`, variant: "error" });
        setNewsIngestHint(`UAP AI briefs failed: ${msg}`);
      } else {
        const p = data.result?.payload;
        const updated = p?.updated ?? 0;
        const scanned = p?.scanned ?? 0;
        const remaining = p?.remaining_without_brief ?? "?";
        const skipped = p?.skipped_short ?? 0;
        const text =
          updated > 0
            ? `✓ ${updated} brief${updated === 1 ? "" : "s"} saved (${scanned} processed). ~${remaining} sightings still need a brief — click AI briefs again.`
            : scanned === 0
              ? "No eligible sightings without a brief (or migration missing: summary_brief column)."
              : `0 briefs saved (${scanned} tried${skipped ? `, ${skipped} too short` : ""}). ~${remaining} still waiting — try again.`;
        setUapBriefHint({
          text,
          variant: updated > 0 ? "success" : "info",
        });
        setNewsIngestHint(`UAP AI briefs: ${updated} updated · ${scanned} scanned · ~${remaining} remaining`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUapBriefHint({ text: `Failed: ${msg}`, variant: "error" });
    } finally {
      setScraperBusy("");
    }
  }

  async function runScraperNow(job: ScraperJob) {
    setScraperBusy(job.id);
    if (job.target === "news_scraper") setNewsIngestHint(null);
    try {
      const res = await fetch("/api/admin/scrapers", {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "run", id: job.id }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        result?: { skipped?: boolean; reason?: string; ok?: boolean; payload?: Record<string, unknown> };
      };
      if (job.target === "news_scraper" || job.target === "outbreak_scraper") {
        if (!res.ok) {
          setNewsIngestHint(`HTTP ${res.status}: ${data.error ?? "request failed"}`);
        } else {
        const r = data.result;
        if (data.error) {
          setNewsIngestHint(`Error: ${data.error}`);
        } else if (r?.skipped) {
          setNewsIngestHint(`Skipped: ${r.reason ?? "unknown"}`);
        } else if (r?.ok === false) {
          const err = (r.payload as { error?: string } | undefined)?.error;
          setNewsIngestHint(err ? `Failed: ${err}` : "Run failed (see job error below).");
        } else if (r?.payload && typeof r.payload === "object") {
          const p = r.payload;
          if (job.target === "outbreak_scraper") {
            const count = Array.isArray(p.outbreaks) ? p.outbreaks.length : "?";
            const cached = p.cached === true ? " (served from cache)" : "";
            setNewsIngestHint(`outbreaks ${count}${cached} · generated ${String(p.generated_at ?? "?")}`);
          } else {
            const src = p.sources as Record<string, number> | undefined;
            const parts: string[] = [];
            parts.push(`inserted ${String(p.inserted ?? "?")}`);
            parts.push(`fetched ${String(p.total_fetched ?? "?")}`);
            if (typeof p.missing_from_db === "number") parts.push(`new vs DB ${p.missing_from_db}`);
            if (typeof p.scored_this_run === "number") parts.push(`scored ${p.scored_this_run}`);
            if (src && typeof src === "object") {
              parts.push(
                `pulls G${src.guardian ?? 0} · GN${src.gnews ?? 0} · R${src.reddit ?? 0} · RSS${src.rss ?? 0}`,
              );
            }
            if (typeof p.min_score === "number") parts.push(`min score ${p.min_score}`);
            setNewsIngestHint(parts.join(" · "));
          }
        } else {
          setNewsIngestHint("Done (no payload details).");
        }
        }
      }
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
    const cronHuman = humanizeCronUtc(job.schedule_cron);
    const lastRunShort = last
      ? new Date(last.started_at).toLocaleString("en-GB", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";
    const durationShort = last?.duration_ms != null ? `${Math.round(last.duration_ms / 1000)}s` : "—";

    return (
      <div
        key={job.id}
        className="rounded-lg border px-3 py-2 sm:px-3.5 sm:py-2.5"
        style={{
          background: "#080c09",
          borderColor: "#2a3830",
          boxShadow: "inset 3px 0 0 rgba(0, 187, 102, 0.35)",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="font-raj text-[13px] font-bold leading-snug tracking-wide text-[var(--foreground)]">{job.name}</div>
            <div
              className="mt-0.5 truncate font-mono text-[10px] leading-tight"
              style={{ color: muted }}
              title={`${job.job_key} · ${job.target}`}
            >
              {job.job_key} · {job.target}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            <span
              className="rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
              style={{
                border: job.enabled ? "1px solid rgba(0,187,102,0.45)" : "1px solid #1a2620",
                color: job.enabled ? "var(--green)" : muted,
                background: job.enabled ? "rgba(0,187,102,0.1)" : "rgba(0,0,0,0.25)",
              }}
            >
              {job.enabled ? "On" : "Off"}
            </span>
            <button
              type="button"
              disabled={running}
              onClick={() => void updateScraper(job, { enabled: !job.enabled })}
              className="rounded border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors hover:bg-[#0f1812] disabled:opacity-50"
              style={{ borderColor: "#2a3830", color: muted }}
            >
              {job.enabled ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              disabled={running}
              onClick={() => void runScraperNow(job)}
              className="rounded border px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-[background,box-shadow] disabled:opacity-50"
              style={{
                borderColor: "var(--green-dark)",
                color: "var(--green)",
                background: "rgba(0,187,102,0.12)",
                boxShadow: "inset 0 1px 0 rgba(0,255,136,0.1)",
              }}
            >
              {running ? "Running" : "Run now"}
            </button>
            {job.target === "uap_scraper" && (
              <>
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
                  className="rounded border px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wide transition-colors hover:bg-[#0f1812] disabled:opacity-50"
                  style={{ borderColor: "#2a3830", color: muted }}
                >
                  max_new
                </button>
                <button
                  type="button"
                  disabled={scraperBusy === "uap-briefs"}
                  onClick={() => void enrichUapBriefs()}
                  className="rounded border px-2 py-1.5 text-[9px] font-semibold uppercase tracking-wide transition-colors hover:bg-[#0f1812] disabled:opacity-50"
                  style={{
                    borderColor: scraperBusy === "uap-briefs" ? "var(--green-dark)" : "#2a3830",
                    color: scraperBusy === "uap-briefs" ? "var(--green)" : muted,
                    background: scraperBusy === "uap-briefs" ? "rgba(0,187,102,0.1)" : "transparent",
                  }}
                >
                  {scraperBusy === "uap-briefs" ? "Briefs…" : "AI briefs"}
                </button>
              </>
            )}
          </div>
        </div>

        {job.target === "uap_scraper" && uapBriefHint ? (
          <div
            className="mt-2 rounded-md border px-3 py-2.5 text-[11px] leading-relaxed"
            style={{
              borderColor:
                uapBriefHint.variant === "error"
                  ? "#4a1a1a"
                  : uapBriefHint.variant === "success"
                    ? "rgba(0,187,102,0.45)"
                    : "#2a3830",
              background:
                uapBriefHint.variant === "error"
                  ? "rgba(255,51,51,0.08)"
                  : uapBriefHint.variant === "success"
                    ? "rgba(0,187,102,0.08)"
                    : "#0a100c",
              color:
                uapBriefHint.variant === "error"
                  ? "#ff9b9b"
                  : uapBriefHint.variant === "success"
                    ? "var(--green)"
                    : "var(--foreground)",
            }}
            role="status"
          >
            <span className="mr-2 font-semibold uppercase tracking-wider" style={{ color: muted }}>
              Result
            </span>
            {uapBriefHint.text}
          </div>
        ) : null}

        <div
          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t pt-2"
          style={{ borderColor: "#1a2620" }}
        >
          <div className="flex min-w-[min(100%,12rem)] max-w-full flex-1 flex-wrap items-center gap-2">
            <input
              key={`${job.id}-${job.schedule_cron}`}
              defaultValue={job.schedule_cron}
              onBlur={(e) => {
                const next = e.currentTarget.value.trim();
                if (next && next !== job.schedule_cron) {
                  void updateScraper(job, { schedule_cron: next });
                }
              }}
              className="box-border h-8 min-w-0 flex-1 rounded border px-2 py-1 font-mono text-[12px] leading-none outline-none transition-[border-color,box-shadow] focus:border-[rgba(0,187,102,0.5)] focus:shadow-[0_0_0_1px_rgba(0,187,102,0.2)] sm:max-w-[220px]"
              style={{ borderColor: "#24322c", background: "#050805", color: "var(--foreground)" }}
              aria-label={`Cron schedule (UTC) for ${job.name}`}
              title={cronHuman}
            />
            <span
              className="hidden max-w-[min(14rem,28vw)] truncate text-[10px] leading-tight sm:inline"
              style={{ color: "var(--green-dim)" }}
              title={cronHuman}
            >
              {cronHuman}
            </span>
          </div>
          <div
            className="flex flex-wrap items-baseline gap-x-3 gap-y-0 font-mono text-[10px] tabular-nums sm:ml-auto"
            style={{ color: muted }}
          >
            <span title={last ? new Date(last.started_at).toLocaleString("en-GB") : undefined}>
              <span className="mr-1 uppercase tracking-wider" style={{ color: "#3a5040" }}>
                Last
              </span>
              <span style={{ color: "var(--foreground)" }}>{lastRunShort}</span>
            </span>
            <span className="font-semibold uppercase" style={{ color: statusColor }}>
              {last?.status ?? "n/a"}
            </span>
            <span title="Duration">{durationShort}</span>
          </div>
        </div>

        {last?.error_text ? (
          <div
            className="mt-1.5 line-clamp-2 rounded border px-2 py-1 text-[10px] leading-snug"
            style={{ borderColor: "#4a1a1a", color: "#ff9b9b", background: "rgba(255,51,51,0.06)" }}
            title={last.error_text}
          >
            {last.error_text}
          </div>
        ) : null}
        {job.target === "article_writer" && last?.status === "success" ? (() => {
          const art = (last.result as { article?: { title?: string; url?: string; slug?: string } } | null)?.article;
          if (!art) return null;
          return (
            <div className="mt-1.5 truncate border-t pt-1.5 text-[10px]" style={{ borderColor: "#1a2620" }}>
              <span className="mr-1.5 uppercase tracking-wider" style={{ color: "var(--green-dim)" }}>
                Last article
              </span>
              <a
                href={art.url ?? `/blog/${art.slug ?? ""}`}
                target="_blank"
                rel="noreferrer"
                className="font-raj font-semibold no-underline underline-offset-2 transition-colors hover:underline"
                style={{ color: "var(--green)" }}
                title={art.title ?? art.slug ?? ""}
              >
                {art.title ?? art.slug ?? "View article"}
              </a>
            </div>
          );
        })() : null}
        {job.target === "search_console" && last?.status === "success" && last.result && typeof last.result === "object" ? (
          <div
            className="mt-1.5 line-clamp-2 border-t pt-1.5 font-mono text-[10px] leading-snug"
            style={{ borderColor: "#1a2620", color: "var(--green-dim)" }}
            title={JSON.stringify(last.result)}
          >
            <span className="mr-1.5 uppercase tracking-wider" style={{ color: "#3a5040" }}>
              Last run
            </span>
            {(() => {
              const r = last.result as { opportunities?: unknown[]; raw_count?: number };
              const n = Array.isArray(r.opportunities) ? r.opportunities.length : 0;
              const raw = typeof r.raw_count === "number" ? r.raw_count : 0;
              return `${n} opportunities · ${raw} queries from GSC`;
            })()}
          </div>
        ) : null}
        {job.target === "outbreak_scraper" && last?.status === "success" && last.result && typeof last.result === "object" && "outbreaks" in last.result ? (
          <div
            className="mt-1.5 line-clamp-2 border-t pt-1.5 font-mono text-[10px] leading-snug"
            style={{ borderColor: "#1a2620", color: "var(--green-dim)" }}
            title={JSON.stringify(last.result)}
          >
            <span className="mr-1.5 uppercase tracking-wider" style={{ color: "#3a5040" }}>
              Last run
            </span>
            {(() => {
              const r = last.result as { outbreaks?: unknown[]; generated_at?: string; cached?: boolean };
              const n = Array.isArray(r.outbreaks) ? r.outbreaks.length : 0;
              return `${n} outbreaks · ${r.cached ? "cache hit" : "refreshed"} · ${r.generated_at ? new Date(r.generated_at).toLocaleString("en-GB") : "—"}`;
            })()}
          </div>
        ) : null}
        {job.target === "news_scraper" && last?.status === "success" && last.result && typeof last.result === "object" && "inserted" in last.result ? (
          <div
            className="mt-1.5 line-clamp-2 border-t pt-1.5 font-mono text-[10px] leading-snug"
            style={{ borderColor: "#1a2620", color: "var(--green-dim)" }}
            title={JSON.stringify(last.result)}
          >
            <span className="mr-1.5 uppercase tracking-wider" style={{ color: "#3a5040" }}>
              Last run
            </span>
            {(() => {
              const r = last.result as {
                inserted?: number;
                total_fetched?: number;
                missing_from_db?: number;
                sources?: { guardian?: number; gnews?: number; reddit?: number; rss?: number };
              };
              const s = r.sources;
              const bits = [`in ${r.inserted ?? 0}`, `fetched ${r.total_fetched ?? "?"}`];
              if (typeof r.missing_from_db === "number") bits.push(`queue ${r.missing_from_db}`);
              if (s)
                bits.push(`G${s.guardian ?? 0}/GN${s.gnews ?? 0}/R${s.reddit ?? 0}/RSS${s.rss ?? 0}`);
              return bits.join(" · ");
            })()}
          </div>
        ) : null}
      </div>
    );
  }

  function selectMessage(m: Message) {
    setSelectedMsg(m);
    if (!m.read) void markRead(m.id, true);
    queueMicrotask(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  }

  const navBtn =
    "w-full rounded-md border border-transparent px-3.5 py-2.5 text-left text-[12px] font-semibold uppercase tracking-wide transition-colors hover:border-[#1a3320] hover:bg-[#0a130d]";

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
        className="flex w-full flex-1 flex-col gap-y-6 lg:flex-row lg:gap-0"
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
          className="flex w-full flex-shrink-0 flex-row flex-wrap gap-1.5 border-b pb-5 lg:w-[220px] lg:flex-col lg:border-b-0 lg:border-r lg:pb-0 lg:pr-6 lg:pt-2"
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
          <button type="button" className={navBtn} style={{ color: "var(--foreground)" }} onClick={() => scrollToId("scrapers-seo")}>
            SEO / GSC
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
        <main className="min-w-0 flex-1 space-y-10 lg:pl-10">
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
            <h2 className="font-raj mb-5 text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--foreground)", borderLeft: "2px solid var(--green-dark)", paddingLeft: 10 }}>
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
          <section id="subscribers" className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-raj text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--foreground)", borderLeft: "2px solid var(--green-dark)", paddingLeft: 10 }}>
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
            <h2 className="font-raj text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--foreground)", borderLeft: "2px solid var(--green-dark)", paddingLeft: 10 }}>
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
          <section id="community" className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-raj text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--foreground)", borderLeft: "2px solid var(--green-dark)", paddingLeft: 10 }}>
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
          <section id="content" className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-raj text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--foreground)", borderLeft: "2px solid var(--green-dark)", paddingLeft: 10 }}>
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

            <div
              className="rounded-md border px-3 py-2.5 text-[11px] leading-snug"
              style={{ borderColor: "var(--green-dark)", background: "rgba(0,187,102,0.07)", color: muted }}
            >
              <strong style={{ color: "var(--green)" }}>Oracle ↻</strong> — Oldalsáv: <strong style={{ color: "var(--foreground)" }}>Content</strong> → görgess le. A{" "}
              <strong style={{ color: "var(--foreground)" }}>Feed article list</strong> és a{" "}
              <strong style={{ color: "var(--foreground)" }}>Published reports</strong> táblázat minden sorában az utolsó oszlop (
              <strong style={{ color: "var(--foreground)" }}>Actions</strong>): <strong style={{ color: "#ccaa44" }}>Oracle ↻</strong> a Board és a Delete mellett.
              Be kell jelentkezned; a profilodban <code className="text-[var(--green-dim)]">is_admin = true</code> (Supabase).
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

            <div className="rounded-lg border p-5 sm:p-6" style={{ background: "rgba(255,100,0,0.04)", borderColor: "#4a3010" }}>
              <div className="font-raj text-[12px] font-bold uppercase tracking-wider" style={{ color: "#ffaa66" }}>
                Feed maintenance
              </div>
              <p className="mt-3 text-[12px] leading-relaxed" style={{ color: muted }}>
                <strong style={{ color: "var(--foreground)" }}>Oracle RESET ALL · feed</strong>{" "}
                <strong style={{ color: "#ff8844" }}>törli</strong> az összes meglévő Oracle elemzést (
                <code className="text-[var(--green-dim)]">oracle_analyses</code>) minden feed cikkhez.
                A board-ok üresek lesznek — új elemzést majd manuálisan indíthatsz a board oldalon.{" "}
                <strong style={{ color: "var(--foreground)" }}>Nem futtat</strong> automatikusan új Oracle-t.
                A soronkénti <strong style={{ color: "#ccaa44" }}>Oracle ↻</strong> gombokkal egyenként lehet újrafuttatni.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={bulkOracleBusy !== "" || blogAdminBusy !== "" || oracleRerunBusyKey !== ""}
                  onClick={() => void oracleBulkResetAll("feed")}
                  className="rounded-md border px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider disabled:opacity-40"
                  style={{ borderColor: "#5a5020", color: "#e8c060", background: "rgba(232,192,96,0.06)" }}
                >
                  {bulkOracleBusy === "feed" ? "Törlés…" : "Oracle RESET ALL · feed"}
                </button>
              </div>
            </div>

            <details open className="group mt-4 overflow-hidden rounded-lg border" style={{ background: cardBg, border }}>
              <summary
                className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-raj text-[12px] font-bold uppercase tracking-[0.12em] outline-none [&::-webkit-details-marker]:hidden"
                style={{ color: "var(--foreground)", background: "#0a100c" }}
              >
                <span>Feed article list</span>
                <span className="text-[10px] font-normal normal-case tracking-normal" style={{ color: muted }}>
                  {articleTotal} rows · Oracle ↻ az Actions oszlopban · fejlécre kattintva összecsukható
                </span>
              </summary>
              <div className="border-t" style={{ borderColor: "#1a2a22" }}>
            <div className="overflow-hidden" style={{ background: cardBg }}>
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
                          {a.angle && (
                            <div className="mb-1.5 max-w-[220px] text-[10px] leading-snug italic" style={{ color: muted }} title={a.angle}>
                              {a.angle.length > 60 ? `${a.angle.slice(0, 60)}…` : a.angle}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            <a href={`/board/${a.id}`} target="_blank" rel="noreferrer" className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide no-underline" style={{ borderColor: "var(--green-dark)", color: "var(--green-dim)" }}>Board ↗</a>
                            <button
                              type="button"
                              disabled={rescoreBusyId !== "" || articleBusy === a.id || bulkOracleBusy !== "" || braveBusyId !== ""}
                              onClick={() => void adminRescore(a.id)}
                              className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide disabled:opacity-40"
                              style={{ borderColor: "#203040", color: "#6ab0e0" }}
                              title="Re-score: friss AI pontozás (score + angle frissítés)"
                            >
                              {rescoreBusyId === a.id ? "…" : "Re-score ↺"}
                            </button>
                            <button
                              type="button"
                              disabled={braveBusyId !== "" || articleBusy === a.id || oracleRerunBusyKey !== "" || bulkOracleBusy !== "" || rescoreBusyId !== ""}
                              onClick={() => void adminBraveRefresh({ newsId: a.id })}
                              className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide disabled:opacity-40"
                              style={{ borderColor: "#1a3040", color: "#4ab8e0" }}
                              title="Brave ↺ — frissíti a linkeket minden board node-ra (OpenAI nélkül, Brave Search API)"
                            >
                              {braveBusyId === a.id ? "…" : "Brave ↺"}
                            </button>
                            <button
                              type="button"
                              disabled={articleBusy === a.id || oracleRerunBusyKey !== "" || bulkOracleBusy !== "" || rescoreBusyId !== "" || braveBusyId !== ""}
                              onClick={() => void adminOracleRerun({ newsId: a.id })}
                              className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide disabled:opacity-40"
                              style={{ borderColor: "#3a4020", color: "#ccaa44" }}
                              title="Admin only: Oracle reset + újrafuttatás (törli a meglévőt, új elemzést generál)"
                            >
                              {oracleRerunBusyKey === `news:${a.id}` ? "…" : "Oracle ↻"}
                            </button>
                            <button
                              type="button"
                              disabled={articleBusy === a.id || oracleRerunBusyKey !== "" || bulkOracleBusy !== "" || rescoreBusyId !== ""}
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
              </div>
            </details>

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
                  <span className="mt-2 block">
                    <strong style={{ color: "#ccaa44" }}>Oracle ↻</strong> (soronként) — egy riport elemzését törli és azonnal újrafuttatja.{" "}
                    <strong style={{ color: "var(--foreground)" }}>Oracle RESET ALL · analysis</strong> csak{" "}
                    <strong style={{ color: "#ff8844" }}>törli</strong> az összes Oracle elemzést a published riportoknál — a board-ok üresek lesznek, automatikusan{" "}
                    <strong style={{ color: "var(--foreground)" }}>nem</strong> fut le új elemzés.
                    Mindkettő: bejelentkezve kell lenni,{" "}
                    <code className="text-[var(--green-dim)]">is_admin = true</code> (<code className="text-[var(--green-dim)]">user_profiles</code>).
                  </span>
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={blogAdminBusy !== "" || bulkOracleBusy !== ""}
                    onClick={() => void sanitizeAllReportSources()}
                    className="rounded-md border px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider disabled:opacity-40"
                    style={{ borderColor: "#1a3320", color: "var(--green-dim)" }}
                  >
                    {blogAdminBusy === "sanitize" ? "Sanitizing…" : "Sanitize all source URLs"}
                  </button>
                  <button
                    type="button"
                    disabled={blogAdminBusy !== "" || bulkOracleBusy !== ""}
                    onClick={() => void deleteAllPublishedReports()}
                    className="rounded-md border px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider disabled:opacity-40"
                    style={{ borderColor: "#4a1a1a", color: "#ff8888" }}
                  >
                    {blogAdminBusy === "delete_all" ? "Deleting…" : "Delete all published reports"}
                  </button>
                  <button
                    type="button"
                    disabled={blogAdminBusy !== "" || bulkOracleBusy !== "" || oracleRerunBusyKey !== ""}
                    onClick={() => void oracleBulkResetAll("analysis")}
                    className="rounded-md border px-5 py-3.5 text-[11px] font-semibold uppercase tracking-wider disabled:opacity-40"
                    style={{ borderColor: "#5a5020", color: "#e8c060", background: "rgba(232,192,96,0.06)" }}
                  >
                    {bulkOracleBusy === "analysis" ? "Törlés…" : "Oracle RESET ALL · analysis"}
                  </button>
                </div>
              </div>
              <details open className="group overflow-hidden rounded-lg border" style={{ background: cardBg, border }}>
                <summary
                  className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 font-raj text-[12px] font-bold uppercase tracking-[0.12em] outline-none [&::-webkit-details-marker]:hidden"
                  style={{ color: "var(--foreground)", background: "#0a100c" }}
                >
                  <span>Published reports table</span>
                  <span className="text-[10px] font-normal normal-case tracking-normal" style={{ color: muted }}>
                    {blogTotal} posts · Oracle ↻ az Actions oszlopban · fejlécre kattintva összecsukható
                  </span>
                </summary>
                <div className="border-t" style={{ borderColor: "#1a2a22" }}>
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
                            {p.has_oracle ? (
                              <span className="mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide" style={{ background: "rgba(0,187,102,0.12)", color: "var(--green)" }}>Oracle</span>
                            ) : null}
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
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                disabled={braveBusyId !== "" || blogAdminBusy !== "" || oracleRerunBusyKey !== "" || bulkOracleBusy !== ""}
                                onClick={() => void adminBraveRefresh({ generatedArticleId: p.id })}
                                className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide disabled:opacity-40"
                                style={{ borderColor: "#1a3040", color: "#4ab8e0" }}
                                title="Brave ↺ — frissíti a linkeket minden board node-ra (OpenAI nélkül)"
                              >
                                {braveBusyId === p.id ? "…" : "Brave ↺"}
                              </button>
                              <button
                                type="button"
                                disabled={blogAdminBusy !== "" || oracleRerunBusyKey !== "" || bulkOracleBusy !== "" || braveBusyId !== ""}
                                onClick={() => void adminOracleRerun({ generatedArticleId: p.id })}
                                className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide disabled:opacity-40"
                                style={{ borderColor: "#3a4020", color: "#ccaa44" }}
                                title="Admin only: new Oracle analysis"
                              >
                                {oracleRerunBusyKey === `gen:${p.id}` ? "…" : "Oracle ↻"}
                              </button>
                              <button
                                type="button"
                                disabled={blogAdminBusy !== "" || oracleRerunBusyKey !== "" || bulkOracleBusy !== ""}
                                onClick={() => void deleteBlogPost(p.id, p.title)}
                                className="rounded border px-3.5 py-2.5 text-[10px] uppercase tracking-wide disabled:opacity-40"
                                style={{ borderColor: "#4a1a1a", color: "#ff8888" }}
                              >
                                {blogAdminBusy === p.id ? "…" : "Delete"}
                              </button>
                            </div>
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
              </details>
            </div>
          </section>

          {/* ── FEED SCRAPERS (ingest) — separate from investigation writers ── */}
          <section id="scrapers-feed" className="space-y-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-raj text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--foreground)", borderLeft: "2px solid var(--green-dark)", paddingLeft: 10 }}>
                Feed scrapers & ingest
              </h2>
              <div className="flex flex-wrap items-center gap-2">
                {mainNewsIngestJob ? (
                  <button
                    type="button"
                    disabled={scraperBusy === mainNewsIngestJob.id}
                    onClick={() => void runScraperNow(mainNewsIngestJob)}
                    className="rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition-[background,box-shadow] disabled:opacity-50"
                    style={{
                      borderColor: "var(--green-dark)",
                      color: "var(--green)",
                      background: "rgba(0,187,102,0.14)",
                      boxShadow: "inset 0 1px 0 rgba(0,255,136,0.12)",
                    }}
                    title="Same as “Run now” on Main news — one pipeline for all sources below."
                  >
                    {scraperBusy === mainNewsIngestJob.id ? "Ingest…" : "Full news ingest"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void loadScrapers()}
                  className="rounded-md border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
                  style={{ borderColor: "#1a2a22", color: muted }}
                >
                  Refresh jobs
                </button>
              </div>
            </div>
            {newsIngestHint ? (
              <div
                className="rounded-lg border px-3 py-2 font-mono text-[11px] leading-snug"
                style={{ borderColor: "#2a3830", background: "#0a100c", color: "var(--foreground)" }}
              >
                <span className="mr-2 uppercase tracking-wider" style={{ color: muted }}>
                  {newsIngestHint.startsWith("UAP AI briefs")
                    ? "UAP AI briefs"
                    : "Last manual ingest"}
                </span>
                {newsIngestHint}
              </div>
            ) : null}
            <div className="rounded-xl p-5 text-[12px] leading-relaxed sm:p-6 sm:px-7" style={{ background: cardBg, border: "1px solid #24322c", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)", color: muted }}>
              <strong style={{ color: "var(--foreground)" }}>Main news</strong> is one job:{" "}
              <strong style={{ color: "var(--foreground)" }}>Guardian API</strong>,{" "}
              <strong style={{ color: "var(--foreground)" }}>Google News (RSS)</strong>,{" "}
              <strong style={{ color: "var(--foreground)" }}>Reddit</strong>, and{" "}
              <strong style={{ color: "var(--foreground)" }}>investigative RSS</strong> feeds — then GPT scores headlines; only rows ≥{" "}
              <code className="text-[var(--green-dim)]">SCRAPER_MIN_SCORE</code> (default 70) are stored. On the public feed,{" "}
              <strong style={{ color: "var(--foreground)" }}>GNEWS</strong> with an age means the{" "}
              <em>newest Google-News-sourced article already in the database</em>, not the last crawl time — if nothing new passes the score gate, that date stays old even though ingest runs.{" "}
              <strong style={{ color: "var(--foreground)" }}>NUFORC UAP</strong> is a separate job (sightings table).{" "}
              <strong style={{ color: "var(--foreground)" }}>Outbreak refresh</strong> rebuilds WHO + GPT outbreak cache (~1h TTL on page loads; use Run now to force). Not the same as the investigation article writers below.
              <span className="mt-2 block text-[11px]" style={{ color: muted }}>
                Vercel cron hits <code className="text-[var(--green-dim)]">/api/scheduler/tick</code> (09:00 UTC on Hobby). Needs{" "}
                <code className="text-[var(--green-dim)]">CRON_SECRET</code>, <code className="text-[var(--green-dim)]">SCRAPER_SECRET</code>, and{" "}
                <code className="text-[var(--green-dim)]">OPENAI_API_KEY</code> for news scoring.
              </span>
            </div>
            <div className="space-y-2">
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

          {/* ── SEARCH CONSOLE / SEO ── */}
          <section id="scrapers-seo" className="mt-10 space-y-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-raj text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--foreground)", borderLeft: "2px solid #ffaa00", paddingLeft: 10 }}>
                Search Console &amp; SEO
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
              <strong style={{ color: "var(--foreground)" }}>1.</strong> Run <strong style={{ color: "#ffaa00" }}>Search Console sync</strong> first — pulls query data into{" "}
              <code className="text-[var(--green-dim)]">search_console_cache</code>. Needs Vercel env{" "}
              <code className="text-[var(--green-dim)]">GSC_SERVICE_ACCOUNT_EMAIL</code>,{" "}
              <code className="text-[var(--green-dim)]">GSC_PRIVATE_KEY</code>, and{" "}
              <code className="text-[var(--green-dim)]">GSC_SITE_URL</code> (domain property:{" "}
              <code className="text-[var(--green-dim)]">sc-domain:the-theorist.com</code>).{" "}
              <strong style={{ color: "var(--foreground)" }}>2.</strong> Then run <strong style={{ color: "#ffaa00" }}>Search Console SEO Article</strong> — writes a /blog post from the top opportunity.
              <span className="mt-2 block text-[11px]">
                Direct API: <code className="text-[var(--green-dim)]">GET /api/search-console</code> with Bearer <code className="text-[var(--green-dim)]">CRON_SECRET</code>.
              </span>
            </div>
            <div className="space-y-2">
              {seoScraperJobs.map(scraperJobCard)}
              {gscWriterJobs.map(scraperJobCard)}
              {scrapers.length > 0 && seoScraperJobs.length === 0 && gscWriterJobs.length === 0 && (
                <div className="rounded-lg px-4 py-6 text-center text-[12px]" style={{ background: cardBg, border, color: muted }}>
                  No Search Console jobs yet — click Refresh jobs (creates defaults) or run <code className="text-[var(--green-dim)]">supabase db push</code>.
                </div>
              )}
            </div>
          </section>

          {/* ── INVESTIGATION ARTICLE WRITERS (OpenAI → /blog) ── */}
          <section id="scrapers-writers" className="mt-10 space-y-4">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-raj text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--foreground)", borderLeft: "2px solid var(--green-dark)", paddingLeft: 10 }}>
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
            <div className="space-y-2">
              {writerScraperJobs.map(scraperJobCard)}
              {scrapers.length > 0 && writerScraperJobs.length === 0 && (
                <div className="rounded-lg px-4 py-6 text-center text-[12px]" style={{ background: cardBg, border, color: muted }}>
                  No article_writer jobs found.
                </div>
              )}
            </div>
          </section>

          {/* ── LORE DOSSIER WRITER ── */}
          <section id="lore-writer" className="mt-10 space-y-4">
            <div className="mb-1">
              <h2 className="font-raj text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--foreground)", borderLeft: "2px solid #c94dff", paddingLeft: 10 }}>
                Lore / Hypothesis Dossier Writer
              </h2>
            </div>
            <div className="rounded-xl p-5 text-[12px] leading-relaxed sm:p-6 sm:px-7" style={{ background: cardBg, border: "1px solid #24322c", color: muted }}>
              Generates a <strong style={{ color: "var(--foreground)" }}>HYPOTHESIS dossier</strong> — speculative conspiracy analysis (Epstein, Illuminati, Hollywood, adrenochrome, etc.).
              Published to <code className="text-[var(--green-dim)]">/blog</code> with a visible disclaimer badge. Uses a different AI prompt than standard Investigation Reports — no CIA-allowlist restriction.
            </div>
            <div className="rounded-xl p-5 sm:p-6 sm:px-7 space-y-4" style={{ background: cardBg, border: "1px solid #3a1a4a" }}>
              {/* Topic */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: muted }}>Topic *</label>
                <input
                  type="text"
                  value={loreTopic}
                  onChange={(e) => setLoreTopic(e.target.value)}
                  placeholder="e.g. Jeffrey Epstein's network and elite connections"
                  className="w-full rounded-md px-3 py-2 text-[12px] outline-none"
                  style={{ background: "#0a0f0d", border: "1px solid #2a1a3a", color: "#c8e8d0", fontFamily: "var(--font-share-tech-mono), monospace" }}
                />
              </div>
              {/* Angle */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: muted }}>Angle / focus <span style={{ color: "#3a5040" }}>(optional)</span></label>
                <input
                  type="text"
                  value={loreAngle}
                  onChange={(e) => setLoreAngle(e.target.value)}
                  placeholder="e.g. Intelligence blackmail operation, who was protected"
                  className="w-full rounded-md px-3 py-2 text-[12px] outline-none"
                  style={{ background: "#0a0f0d", border: "1px solid #2a1a3a", color: "#c8e8d0", fontFamily: "var(--font-share-tech-mono), monospace" }}
                />
              </div>
              {/* Seed URLs */}
              <div>
                <label className="block text-[10px] uppercase tracking-widest mb-1" style={{ color: muted }}>Seed / reference URLs <span style={{ color: "#3a5040" }}>(optional — one per line)</span></label>
                <textarea
                  value={loreSeedUrls}
                  onChange={(e) => setLoreSeedUrls(e.target.value)}
                  rows={4}
                  placeholder={"https://example.com/article-1\nhttps://example.com/article-2"}
                  className="w-full rounded-md px-3 py-2 text-[12px] outline-none resize-y"
                  style={{ background: "#0a0f0d", border: "1px solid #2a1a3a", color: "#c8e8d0", fontFamily: "var(--font-share-tech-mono), monospace" }}
                />
                <p className="mt-1 text-[10px]" style={{ color: "#2a4030" }}>These become primary citations in the dossier. Any https:// URL is accepted (no domain restriction).</p>
              </div>
              {/* Generate button */}
              <button
                type="button"
                onClick={() => void generateLoreDossier()}
                disabled={loreGenerating || !loreTopic.trim()}
                className="rounded-md px-5 py-2 text-[11px] font-bold uppercase tracking-widest transition-all"
                style={{
                  background: loreGenerating ? "rgba(201,77,255,0.06)" : "rgba(201,77,255,0.12)",
                  border: "1px solid #c94dff",
                  color: loreGenerating ? "#7a3a9a" : "#c94dff",
                  cursor: loreGenerating || !loreTopic.trim() ? "not-allowed" : "pointer",
                  opacity: !loreTopic.trim() ? 0.4 : 1,
                }}
              >
                {loreGenerating ? "◈ Generating dossier…" : "◈ Generate Hypothesis Dossier"}
              </button>
              {loreGenerating && (
                <p className="text-[11px]" style={{ color: "#c94dff" }}>OpenAI writing dossier — this takes ~30–60 seconds…</p>
              )}
              {loreResult && (
                <div
                  className="rounded-md px-4 py-3 text-[12px]"
                  style={{ background: loreResult.ok ? "rgba(0,187,102,0.07)" : "rgba(255,80,80,0.07)", border: `1px solid ${loreResult.ok ? "#1a4a30" : "#4a1a1a"}`, color: loreResult.ok ? "#00ff88" : "#ff8080" }}
                >
                  {loreResult.message}
                  {loreResult.ok && loreResult.url && (
                    <a href={loreResult.url} target="_blank" rel="noopener noreferrer" className="ml-3 underline" style={{ color: "#00bb66" }}>
                      Open →
                    </a>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Inbox */}
          <section id="contact">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-raj text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--foreground)", borderLeft: "2px solid var(--green-dark)", paddingLeft: 10 }}>
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
            <h2 className="font-raj mb-5 text-[13px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--foreground)", borderLeft: "2px solid var(--green-dark)", paddingLeft: 10 }}>
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
