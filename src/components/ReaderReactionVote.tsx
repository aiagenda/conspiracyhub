"use client";

import { useCallback, useEffect, useState } from "react";
import {
  READER_REACTION_VOTE_TYPE,
  type ReaderReactionStats,
} from "@/lib/readerReactionVote";

const FONT = "var(--font-share-tech-mono), monospace";

type Props = {
  articleId?: string | number;
  generatedArticleId?: string | number;
  initial?: ReaderReactionStats;
  /** When true, vote clicks do not bubble (use inside `<Link>`). */
  insideLink?: boolean;
};

export default function ReaderReactionVote({
  articleId,
  generatedArticleId,
  initial,
  insideLink = false,
}: Props) {
  const [stats, setStats] = useState<ReaderReactionStats>(initial ?? { score: 0, up: 0, down: 0 });
  const [my, setMy] = useState<-1 | 0 | 1>(0);
  const [pending, setPending] = useState(false);

  const aid =
    typeof articleId === "string"
      ? articleId.trim()
      : articleId != null && String(articleId).trim() !== ""
        ? String(articleId).trim()
        : "";
  const gid =
    typeof generatedArticleId === "string"
      ? generatedArticleId.trim()
      : generatedArticleId != null && String(generatedArticleId).trim() !== ""
        ? String(generatedArticleId).trim()
        : "";
  /** Prefer feed article id when both are mistakenly passed. */
  const useArticle = aid.length > 0;
  const useGenerated = !useArticle && gid.length > 0;

  const q = useArticle
    ? `article_id=${encodeURIComponent(aid)}`
    : `generated_article_id=${encodeURIComponent(gid)}`;

  useEffect(() => {
    let cancelled = false;
    if (!useArticle && !useGenerated) return;
    fetch(`/api/vote?${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        if (d.reader_reaction) setStats(d.reader_reaction);
        const v = d.my_reader_reaction;
        setMy(v === 1 || v === -1 ? v : 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [q, useArticle, useGenerated]);

  const syncFromJson = useCallback((d: { reader_reaction?: ReaderReactionStats; my_reader_reaction?: number }) => {
    if (d.reader_reaction) setStats(d.reader_reaction);
    const v = d.my_reader_reaction;
    setMy(v === 1 || v === -1 ? v : 0);
  }, []);

  const post = useCallback(
    async (value: -1 | 0 | 1) => {
      if (!useArticle && !useGenerated) return;
      setPending(true);
      try {
        const res = await fetch("/api/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            useArticle
              ? { article_id: aid, vote_type: READER_REACTION_VOTE_TYPE, value }
              : { generated_article_id: gid, vote_type: READER_REACTION_VOTE_TYPE, value },
          ),
        });
        const d = await res.json();
        if (res.ok) syncFromJson(d);
      } finally {
        setPending(false);
      }
    },
    [aid, gid, useArticle, useGenerated, syncFromJson],
  );

  const onUp = useCallback(
    (e: React.MouseEvent) => {
      if (insideLink) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (my === 1) void post(0);
      else void post(1);
    },
    [insideLink, my, post],
  );

  const onDown = useCallback(
    (e: React.MouseEvent) => {
      if (insideLink) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (my === -1) void post(0);
      else void post(-1);
    },
    [insideLink, my, post],
  );

  const scoreColor = stats.score > 0 ? "#00ff88" : stats.score < 0 ? "#ff6666" : "var(--muted-dim, #7aaa8a)";

  const btn = (active: boolean, aria: string, onClick: (e: React.MouseEvent) => void, child: string) => (
    <button
      type="button"
      className={active ? undefined : "reader-reaction-btn"}
      aria-label={aria}
      onClick={onClick}
      disabled={pending || (!useArticle && !useGenerated)}
      style={{
        border: `1px solid ${active ? "#00bb66" : "#1a3320"}`,
        background: active ? "rgba(0,187,102,0.15)" : "transparent",
        color: active ? "#00ff88" : undefined,
        borderRadius: 2,
        width: 28,
        height: 26,
        fontSize: 12,
        cursor: pending ? "wait" : "pointer",
        fontFamily: FONT,
        lineHeight: 1,
        padding: 0,
      }}
    >
      {child}
    </button>
  );

  const scoreLabel = stats.score > 0 ? `+${stats.score}` : String(stats.score);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        padding: "10px 6px",
        borderRight: "1px solid #1a3320",
        alignSelf: "stretch",
        justifyContent: "center",
        minWidth: 40,
        flexShrink: 0,
      }}
    >
      {btn(my === 1, "Upvote", onUp, "▲")}
      <div
        style={{
          fontFamily: FONT,
          fontSize: 12,
          fontWeight: 700,
          color: scoreColor,
          minWidth: 24,
          textAlign: "center",
        }}
      >
        {scoreLabel}
      </div>
      {btn(my === -1, "Downvote", onDown, "▼")}
    </div>
  );
}
