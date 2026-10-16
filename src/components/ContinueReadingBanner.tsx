"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  CONTINUE_READING_EVENT,
  getContinueReading,
  type ContinueReadingEntry,
} from "@/lib/continueReading";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function ContinueReadingBanner() {
  const [entry, setEntry] = useState<ContinueReadingEntry | null>(null);

  const refresh = useCallback(() => {
    setEntry(getContinueReading());
  }, []);

  useEffect(() => {
    queueMicrotask(refresh);
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

  // Storage may contain old entries; only internal article/board paths are navigable.
  if (!/^\/(?:article|blog|board)\/[^\s]+$/.test(entry.path)) return null;
  return <aside className="publication-continue" aria-label="Continue reading"><div><span>Continue reading</span><Link href={entry.path}>{entry.title}</Link></div><Link href={entry.path} className="publication-text-link">Resume →</Link></aside>;
}
