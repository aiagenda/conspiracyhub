"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Props = {
  newsId?: string;
  generatedArticleId?: string;
  title: string;
};

export default function SaveInvestigationButton({ newsId, generatedArticleId, title }: Props) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [toast, setToast] = useState("");

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setSignedIn(false);
          return;
        }
        setSignedIn(true);
        const res = await fetch("/api/saved-investigations", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          items?: Array<{ newsId?: string | null; generatedArticleId?: string | null }>;
        };
        const hit = (json.items ?? []).some((it) =>
          newsId ? it.newsId === newsId : it.generatedArticleId === generatedArticleId,
        );
        setSaved(hit);
      } catch {
        setSignedIn(false);
      }
    })();
  }, [newsId, generatedArticleId]);

  async function toggleSave() {
    if (!signedIn) {
      showToast("Sign in to save investigations");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        showToast("Sign in to save investigations");
        return;
      }
      if (saved) {
        const listRes = await fetch("/api/saved-investigations", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const listJson = (await listRes.json()) as {
          items?: Array<{ id: string; newsId?: string | null; generatedArticleId?: string | null }>;
        };
        const row = (listJson.items ?? []).find((it) =>
          newsId ? it.newsId === newsId : it.generatedArticleId === generatedArticleId,
        );
        if (row?.id) {
          await fetch(`/api/saved-investigations?id=${encodeURIComponent(row.id)}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
        }
        setSaved(false);
        showToast("Removed from saved");
        return;
      }
      const res = await fetch("/api/saved-investigations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          newsId,
          generatedArticleId,
          title,
        }),
      });
      const json = (await res.json()) as { error?: string; limit?: number };
      if (res.status === 403 && json.error === "save_limit") {
        showToast(`Free limit: ${json.limit ?? 5} saved — upgrade for unlimited`);
        return;
      }
      if (!res.ok) {
        showToast(json.error ?? "Could not save");
        return;
      }
      setSaved(true);
      showToast("Saved to My investigations");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      {toast ? (
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: "calc(100% + 6px)",
            fontFamily: "var(--font-share-tech-mono), monospace",
            fontSize: 9,
            color: "#00ff88",
            background: "rgba(5,12,7,0.95)",
            border: "1px solid #00bb66",
            borderRadius: 3,
            padding: "5px 10px",
            letterSpacing: 1,
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void toggleSave()}
        disabled={loading}
        title={signedIn === false ? "Sign in to save" : saved ? "Remove from saved" : "Save investigation"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 14px",
          background: saved ? "rgba(0,255,136,0.08)" : "rgba(5,12,7,0.92)",
          border: `1px solid ${saved ? "#00bb66" : "#1a3320"}`,
          borderRadius: 3,
          color: saved ? "#00ff88" : "#5a8068",
          fontFamily: "var(--font-raj), sans-serif",
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.7 : 1,
          backdropFilter: "blur(4px)",
        }}
      >
        {loading ? "…" : saved ? "★ SAVED" : "☆ SAVE"}
      </button>
    </div>
  );
}
