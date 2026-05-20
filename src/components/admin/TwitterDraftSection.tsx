"use client";

import { useState } from "react";
import { muted } from "@/components/admin/constants";

const STYLE_COLORS: Record<string, string> = {
  shocking: "#ff3333",
  question: "#ffaa00",
  investigative: "#00bb66",
};

export function TwitterDraftSection() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{
    article: { id: string; title: string; score: number; section: string; board_url: string };
    variants: Array<{ style: string; text: string; full_tweet: string; char_count: number; twitter_intent_url: string }>;
    hashtags: string[];
    best_time: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError("");
    setData(null);
    try {
      const res = await fetch("/api/admin/twitter-draft");
      const d = await res.json();
      if (d.error) setError(d.error);
      else setData(d);
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
          Picks today&apos;s top feed article (70%+) and generates 3 post-ready variants with board link and hashtags.
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
            ? "No articles scored 70%+ in the last 24h. Try again later."
            : error}
        </div>
      )}

      {data && (
        <div className="space-y-4">
          <div className="rounded p-3" style={{ border: "1px solid #1a3320", background: "#090f0b" }}>
            <div className="mb-1 flex items-center gap-3">
              <span className="font-mono text-[9px] uppercase tracking-widest" style={{ color: "var(--green-dim)" }}>
                Source article
              </span>
              <span
                className="rounded px-2 py-0.5 font-mono text-[10px]"
                style={{ color: "#ff3333", border: "1px solid rgba(255,51,51,0.3)" }}
              >
                {data.article.score}% threat
              </span>
              <span className="ml-auto font-mono text-[9px]" style={{ color: "var(--green-dim)" }}>
                Best time: {data.best_time}
              </span>
            </div>
            <div className="font-mono text-xs" style={{ color: "var(--foreground)" }}>
              {data.article.title}
            </div>
            <div className="mt-2 flex gap-3">
              <a
                href={data.article.board_url}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[9px] uppercase"
                style={{ color: "var(--green)" }}
              >
                ↗ Board
              </a>
              <span className="font-mono text-[9px]" style={{ color: "var(--green-dim)" }}>
                {data.hashtags.map((h: string) => `#${h}`).join(" ")}
              </span>
            </div>
          </div>

          {data.variants.map((v) => (
            <div
              key={v.style}
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
                    onClick={() => copy(v.full_tweet, v.style)}
                    className="rounded border px-2 py-0.5 font-mono text-[9px] uppercase"
                    style={{
                      border: "1px solid #1a3320",
                      color: copied === v.style ? "#00ff88" : "var(--green-dim)",
                      cursor: "pointer",
                      background: "transparent",
                    }}
                  >
                    {copied === v.style ? "✓ Copied" : "Copy"}
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
      )}
    </div>
  );
}
