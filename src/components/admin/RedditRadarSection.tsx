"use client";

import { useCallback, useEffect, useState } from "react";
import { muted } from "@/components/admin/constants";

type RedditMatch = {
  id: string;
  reddit_url: string;
  reddit_title: string;
  subreddit: string;
  match_type: string;
  matched_title: string | null;
  site_url: string;
  match_score: number;
  status: string;
  draft_variants?: {
    comment_variants: Array<{ style: string; text: string; full_text: string }>;
    post_variant: { title: string; body: string; full_text: string };
  };
};

const STYLE_COLORS: Record<string, string> = {
  normal: "#00bb66",
  short: "#ffaa00",
  casual: "#00bb66",
  direct: "#ffaa00",
  skeptical: "#8aa6ff",
  helpful: "#00bb66",
  investigative: "#ffaa00",
  analytical: "#8aa6ff",
};

type ScanStats = {
  candidates_count: number;
  feed_posts: number;
  search_queries: number;
  search_posts: number;
  total_reddit_posts: number;
  new_matches: number;
  skipped_existing: number;
  below_threshold: number;
  insert_errors: number;
};

export function RedditRadarSection() {
  const [matches, setMatches] = useState<RedditMatch[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<ScanStats | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/reddit-radar");
      const d = await res.json();
      if (d.error) setError(d.error);
      else {
        setMatches(d.matches ?? []);
        setPendingCount(d.pending_count ?? 0);
      }
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function scan() {
    setScanning(true);
    setError("");
    try {
      const res = await fetch("/api/admin/reddit-radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "scan" }),
      });
      const d = await res.json();
      if (d.error) setError(d.error);
      else {
        setMatches(d.payload?.matches ?? []);
        if (d.stats) setLastScan(d.stats);
        await load();
      }
    } catch (e) {
      setError(String(e));
    }
    setScanning(false);
  }

  async function generateDraft(id: string) {
    setDraftingId(id);
    setError("");
    try {
      const res = await fetch("/api/admin/reddit-radar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft", matchId: id }),
      });
      const d = await res.json();
      if (d.error) setError(d.error);
      else {
        setMatches((prev) =>
          prev.map((m) => (m.id === id ? { ...m, ...d.match, draft_variants: d.drafts } : m)),
        );
        setExpandedId(id);
      }
    } catch (e) {
      setError(String(e));
    }
    setDraftingId(null);
  }

  async function setStatus(id: string, status: "posted" | "dismissed") {
    await fetch("/api/admin/reddit-radar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: status, matchId: id }),
    });
    setMatches((prev) => prev.filter((m) => m.id !== id));
    setPendingCount((c) => Math.max(0, c - 1));
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] leading-relaxed" style={{ color: muted }}>
          Two-way scan: Reddit hot/new feeds + search driven by your site topics (feed, UAP, outbreaks, insider radar, blog).
          Generates comment drafts — paste manually (no auto-spam).
          {pendingCount > 0 ? (
            <span className="ml-2 font-mono text-[11px]" style={{ color: "#ff6600" }}>
              {pendingCount} pending
            </span>
          ) : null}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest"
            style={{ borderColor: "#1a3320", color: muted, opacity: loading ? 0.5 : 1 }}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => void scan()}
            disabled={scanning}
            className="rounded border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-all"
            style={{
              border: "1px solid #ff6600",
              color: "#ff6600",
              background: "rgba(255,102,0,0.06)",
              opacity: scanning ? 0.5 : 1,
              cursor: scanning ? "not-allowed" : "pointer",
            }}
          >
            {scanning ? "Scanning…" : "◈ Scan Reddit"}
          </button>
        </div>
      </div>

      {lastScan && (
        <div
          className="mb-4 grid grid-cols-2 gap-2 rounded border p-3 font-mono text-[10px] sm:grid-cols-4"
          style={{ borderColor: "#1a3320", background: "rgba(255,102,0,0.04)", color: muted }}
        >
          <div><span style={{ color: "#ff6600" }}>{lastScan.candidates_count}</span> site topics</div>
          <div><span style={{ color: "#ff6600" }}>{lastScan.total_reddit_posts}</span> Reddit posts</div>
          <div><span style={{ color: "#00bb66" }}>{lastScan.new_matches}</span> new matches</div>
          <div><span style={{ color: muted }}>{lastScan.search_queries}</span> search queries</div>
          <div className="col-span-2 sm:col-span-4 text-[9px]" style={{ color: "#3a5040" }}>
            feed {lastScan.feed_posts} · search hits {lastScan.search_posts} · skipped {lastScan.skipped_existing} · below threshold {lastScan.below_threshold}
            {lastScan.insert_errors > 0 ? ` · insert errors ${lastScan.insert_errors} (run supabase db push?)` : ""}
          </div>
        </div>
      )}

      {error && (
        <div
          className="mb-4 rounded p-3 font-mono text-xs"
          style={{ border: "1px solid rgba(255,51,51,0.3)", color: "#ff5555", background: "rgba(255,51,51,0.05)" }}
        >
          {error}
        </div>
      )}

      {loading && matches.length === 0 ? (
        <div className="py-8 text-center font-mono text-xs" style={{ color: muted }}>
          Loading matches…
        </div>
      ) : null}

      {!loading && matches.length === 0 ? (
        <div
          className="rounded border p-6 text-center"
          style={{ borderColor: "#1a3320", background: "#090f0b" }}
        >
          <div className="font-mono text-xs leading-relaxed" style={{ color: muted }}>
            No matches yet. Click <strong style={{ color: "#ff6600" }}>Scan Reddit</strong> to find threads
            discussing topics you already cover.
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {matches.map((m) => (
          <div
            key={m.id}
            className="overflow-hidden rounded"
            style={{ border: "1px solid #1a3320", background: "#090f0b" }}
          >
            <div className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className="rounded px-2 py-0.5 font-mono text-[9px] uppercase"
                  style={{ color: "#ff6600", border: "1px solid rgba(255,102,0,0.35)" }}
                >
                  r/{m.subreddit}
                </span>
                <span
                  className="rounded px-2 py-0.5 font-mono text-[9px] uppercase"
                  style={{ color: "#00bb66", border: "1px solid rgba(0,187,102,0.3)" }}
                >
                  {m.match_score}% match
                </span>
                <span className="font-mono text-[9px] uppercase" style={{ color: muted }}>
                  {m.match_type.replace(/_/g, " ")}
                </span>
                <span className="ml-auto font-mono text-[9px] uppercase" style={{ color: muted }}>
                  {m.status}
                </span>
              </div>

              <a
                href={m.reddit_url}
                target="_blank"
                rel="noreferrer"
                className="mb-2 block font-mono text-xs no-underline hover:underline"
                style={{ color: "var(--foreground)" }}
              >
                ↗ {m.reddit_title}
              </a>

              <div className="mb-3 font-mono text-[10px] leading-relaxed" style={{ color: muted }}>
                Our coverage:{" "}
                <a href={m.site_url} target="_blank" rel="noreferrer" style={{ color: "var(--green)" }}>
                  {m.matched_title ?? m.site_url}
                </a>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void generateDraft(m.id)}
                  disabled={draftingId === m.id}
                  className="rounded border px-2 py-1 font-mono text-[9px] uppercase"
                  style={{
                    borderColor: "#ff6600",
                    color: "#ff6600",
                    opacity: draftingId === m.id ? 0.5 : 1,
                    cursor: draftingId === m.id ? "wait" : "pointer",
                  }}
                >
                  {draftingId === m.id ? "Generating…" : m.draft_variants ? "Regenerate draft" : "◈ Generate draft"}
                </button>
                {m.draft_variants ? (
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                    className="rounded border px-2 py-1 font-mono text-[9px] uppercase"
                    style={{ borderColor: "#1a3320", color: muted }}
                  >
                    {expandedId === m.id ? "Hide drafts" : "Show drafts"}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void setStatus(m.id, "posted")}
                  className="rounded border px-2 py-1 font-mono text-[9px] uppercase"
                  style={{ borderColor: "#1a3320", color: "#00bb66" }}
                >
                  ✓ Posted
                </button>
                <button
                  type="button"
                  onClick={() => void setStatus(m.id, "dismissed")}
                  className="rounded border px-2 py-1 font-mono text-[9px] uppercase"
                  style={{ borderColor: "#1a3320", color: muted }}
                >
                  Dismiss
                </button>
              </div>
            </div>

            {expandedId === m.id && m.draft_variants ? (
              <div className="border-t p-4" style={{ borderColor: "#1a3320", background: "rgba(0,0,0,0.25)" }}>
                <div className="mb-3 font-mono text-[9px] uppercase tracking-widest" style={{ color: muted }}>
                  Comment replies (paste under the Reddit thread)
                </div>
                {m.draft_variants.comment_variants.map((v) => (
                  <div
                    key={v.style}
                    className="mb-3 overflow-hidden rounded"
                    style={{ border: `1px solid ${STYLE_COLORS[v.style] ?? "#1a3320"}44` }}
                  >
                    <div
                      className="flex items-center justify-between px-3 py-2"
                      style={{ background: `${STYLE_COLORS[v.style] ?? "#1a3320"}0a`, borderBottom: "1px solid #1a3320" }}
                    >
                      <span className="font-mono text-[9px] uppercase" style={{ color: STYLE_COLORS[v.style] ?? muted }}>
                        {v.style}
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => copy(v.full_text, `${m.id}-${v.style}`)}
                          className="rounded border px-2 py-0.5 font-mono text-[9px] uppercase"
                          style={{
                            borderColor: "#1a3320",
                            color: copied === `${m.id}-${v.style}` ? "#00ff88" : muted,
                          }}
                        >
                          {copied === `${m.id}-${v.style}` ? "✓ Copied" : "Copy"}
                        </button>
                        <a
                          href={m.reddit_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded border px-2 py-0.5 font-mono text-[9px] uppercase no-underline"
                          style={{ borderColor: "#ff6600", color: "#ff6600" }}
                        >
                          ↗ Open thread
                        </a>
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap p-3 font-mono text-xs" style={{ color: "var(--foreground)", margin: 0 }}>
                      {v.full_text}
                    </pre>
                  </div>
                ))}

                <div className="mt-4 font-mono text-[9px] uppercase tracking-widest" style={{ color: muted }}>
                  New post variant (optional)
                </div>
                <div className="mt-2 overflow-hidden rounded" style={{ border: "1px solid #1a332044" }}>
                  <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: "1px solid #1a3320" }}>
                    <span className="font-mono text-[9px] uppercase" style={{ color: "#ff6600" }}>
                      post
                    </span>
                    <button
                      type="button"
                      onClick={() => copy(m.draft_variants!.post_variant.full_text, `${m.id}-post`)}
                      className="rounded border px-2 py-0.5 font-mono text-[9px] uppercase"
                      style={{
                        borderColor: "#1a3320",
                        color: copied === `${m.id}-post` ? "#00ff88" : muted,
                      }}
                    >
                      {copied === `${m.id}-post` ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap p-3 font-mono text-xs" style={{ color: "var(--foreground)", margin: 0 }}>
                    {m.draft_variants.post_variant.full_text}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
