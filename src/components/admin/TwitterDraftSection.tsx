"use client";

import { useState } from "react";
import { muted } from "@/components/admin/constants";

const STYLE_COLORS: Record<string, string> = {
  shocking: "#ff3333",
  question: "#ffaa00",
  investigative: "#00bb66",
};

type TweetPick = {
  article: {
    id: string;
    title: string;
    score: number | null;
    section: string | null;
    kind: "news_item" | "generated_article";
    has_oracle: boolean;
    board_url: string;
  };
  variants: Array<{
    style: string;
    text: string;
    full_tweet: string;
    char_count: number;
    twitter_intent_url: string;
  }>;
  hashtags: string[];
  best_time: string;
};

export function TwitterDraftSection() {
  const [loading, setLoading] = useState(false);
  const [picks, setPicks] = useState<TweetPick[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError("");
    setPicks([]);
    try {
      const res = await fetch("/api/admin/twitter-draft");
      const d = await res.json();
      if (d.error) setError(d.error);
      else setPicks(d.picks ?? []);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] leading-relaxed" style={{ color: muted }}>
          Picks up to 5 articles — high-score feed items plus Oracle investigation boards — and generates 3 post-ready variants each.
        </p>
        <button
          type="button"
          onClick={() => void generate()}
          disabled={loading}
          className="rounded border px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition-all"
          style={{
            border: "1px solid #ffaa00",
            color: "#ffaa00",
            background: "rgba(255,170,0,0.06)",
            opacity: loading ? 0.5 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Generating..." : "◈ Generate Drafts"}
        </button>
      </div>

      {error && (
        <div
          className="mb-4 rounded p-3 font-mono text-xs"
          style={{ border: "1px solid rgba(255,51,51,0.3)", color: "#ff5555", background: "rgba(255,51,51,0.05)" }}
        >
          {error === "no_article_found"
            ? "No eligible articles in the last 48h (65%+ score or Oracle analysis in 7 days). Try again later."
            : error}
        </div>
      )}

      {picks.length > 0 && (
        <div className="space-y-8">
          <p className="font-mono text-[10px] uppercase tracking-widest" style={{ color: muted }}>
            {picks.length} article{picks.length === 1 ? "" : "s"} ready
          </p>

          {picks.map((data) => (
            <div key={data.article.id} className="space-y-4">
              <div className="rounded p-3" style={{ border: "1px solid #1a3320", background: "#090f0b" }}>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--green-dim)" }}>
                    {data.article.kind === "generated_article" ? "Analysis article" : "Board article"}
                  </span>
                  {data.article.has_oracle && (
                    <span
                      className="rounded px-2 py-0.5 font-mono text-[10px]"
                      style={{ color: "#8aa6ff", border: "1px solid rgba(138,166,255,0.35)" }}
                    >
                      Oracle
                    </span>
                  )}
                  {data.article.score != null && (
                    <span
                      className="rounded px-2 py-0.5 font-mono text-[10px]"
                      style={{ color: "#ff3333", border: "1px solid rgba(255,51,51,0.3)" }}
                    >
                      {data.article.score}% threat
                    </span>
                  )}
                  {data.article.section && (
                    <span className="font-mono text-[9px]" style={{ color: muted }}>
                      {data.article.section}
                    </span>
                  )}
                  <span className="ml-auto font-mono text-[9px]" style={{ color: "var(--green-dim)" }}>
                    Best time: {data.best_time}
                  </span>
                </div>
                <div className="font-mono text-xs" style={{ color: "var(--foreground)" }}>
                  {data.article.title}
                </div>
                <div className="mt-2 flex flex-wrap gap-3">
                  <a
                    href={data.article.board_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[9px] uppercase"
                    style={{ color: "var(--green)" }}
                  >
                    ↗ {data.article.kind === "generated_article" ? "Article" : "Board"}
                  </a>
                  <span className="font-mono text-[9px]" style={{ color: "var(--green-dim)" }}>
                    {data.hashtags.map((h: string) => `#${h}`).join(" ")}
                  </span>
                </div>
              </div>

              {data.variants.map((v) => (
                <div
                  key={`${data.article.id}-${v.style}`}
                  className="overflow-hidden rounded"
                  style={{ border: `1px solid ${STYLE_COLORS[v.style] ?? "#1a3320"}44` }}
                >
                  <div
                    className="flex items-center justify-between px-3 py-2"
                    style={{
                      background: `${STYLE_COLORS[v.style] ?? "#1a3320"}0a`,
                      borderBottom: "1px solid #1a3320",
                    }}
                  >
                    <span
                      className="font-mono text-[9px] uppercase tracking-widest"
                      style={{ color: STYLE_COLORS[v.style] ?? "#5a8068" }}
                    >
                      {v.style}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-[9px]"
                        style={{ color: v.char_count > 270 ? "#ff3333" : "var(--green-dim)" }}
                      >
                        {v.char_count}/280
                      </span>
                      <button
                        type="button"
                        onClick={() => copy(v.full_tweet, `${data.article.id}-${v.style}`)}
                        className="rounded border px-2 py-0.5 font-mono text-[9px] uppercase"
                        style={{
                          border: "1px solid #1a3320",
                          color: copied === `${data.article.id}-${v.style}` ? "#00ff88" : "var(--green-dim)",
                          cursor: "pointer",
                          background: "transparent",
                        }}
                      >
                        {copied === `${data.article.id}-${v.style}` ? "✓ Copied" : "Copy"}
                      </button>
                      <a
                        href={v.twitter_intent_url}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded border px-2 py-0.5 font-mono text-[9px] uppercase no-underline"
                        style={{ border: "1px solid #1da1f2", color: "#1da1f2", background: "rgba(29,161,242,0.06)" }}
                      >
                        ↗ Post to X
                      </a>
                    </div>
                  </div>
                  <pre
                    className="whitespace-pre-wrap p-3 font-mono text-xs"
                    style={{ color: "var(--foreground)", margin: 0 }}
                  >
                    {v.full_tweet}
                  </pre>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
