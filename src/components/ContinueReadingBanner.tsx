"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CONTINUE_READING_EVENT,
  getContinueReading,
  type ContinueReadingEntry,
} from "@/lib/continueReading";
import { getSupabaseBrowserClient } from "@/lib/supabase";

function scoreColor(s: number | undefined) {
  if (s == null) return "#00bb66";
  if (s >= 70) return "#ff3333";
  if (s >= 50) return "#ffaa00";
  return "#00bb66";
}

export default function ContinueReadingBanner() {
  const [entry, setEntry] = useState<ContinueReadingEntry | null>(null);

  const refresh = useCallback(() => {
    setEntry(getContinueReading());
  }, []);

  useEffect(() => {
    refresh();
    window.addEventListener(CONTINUE_READING_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(CONTINUE_READING_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [refresh]);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch("/api/reading-state", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          state?: {
            title: string;
            path: string;
            score?: number | null;
            news_id?: string | null;
            generated_article_id?: string | null;
            updated_at?: string;
          } | null;
        };
        const st = json.state;
        if (!st?.title || !st.path) return;
        const serverAt = st.updated_at ? Date.parse(st.updated_at) : Date.now();
        const local = getContinueReading();
        if (!local || serverAt >= local.at) {
          const merged: ContinueReadingEntry = {
            title: st.title,
            path: st.path,
            score: st.score ?? undefined,
            newsId: st.news_id ?? undefined,
            generatedArticleId: st.generated_article_id ?? undefined,
            at: serverAt,
          };
          setEntry(merged);
        }
      } catch {
        /* ignore */
      }
    })();
  }, []);

  if (!entry) return null;

  const color = scoreColor(entry.score);

  return (
    <div
      style={{
        marginBottom: "1.25rem",
        border: "1px solid #1a3320",
        borderRadius: 4,
        background: "rgba(0,255,136,0.03)",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        flexWrap: "wrap",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>
          Continue where you left off
        </div>
        <div style={{ fontSize: 12, color: "#c8e8d0", lineHeight: 1.4 }}>
          {entry.title}
          {entry.score != null ? (
            <span style={{ marginLeft: 8, color, fontFamily: "var(--font-raj), sans-serif", fontWeight: 700 }}>
              {entry.score}%
            </span>
          ) : null}
        </div>
      </div>
      <Link
        href={entry.path}
        style={{
          fontFamily: "var(--font-raj), sans-serif",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          padding: "6px 12px",
          border: "1px solid #00bb66",
          color: "#00ff88",
          textDecoration: "none",
          borderRadius: 3,
          whiteSpace: "nowrap",
        }}
      >
        Resume →
      </Link>
    </div>
  );
}
