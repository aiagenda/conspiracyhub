"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { isBillingEnabled } from "@/lib/featureFlags";

type SavedItem = {
  id: string;
  title: string;
  boardPath: string;
  articlePath: string | null;
  createdAt: string;
};

export default function SavedInvestigationsList() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [limit, setLimit] = useState<number | null>(5);
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setItems([]);
        setLoading(false);
        return;
      }
      const res = await fetch("/api/saved-investigations", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = (await res.json()) as {
        items?: SavedItem[];
        limit?: number | null;
        isPro?: boolean;
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Could not load saved investigations");
        setItems([]);
      } else {
        setItems(json.items ?? []);
        setLimit(json.limit ?? null);
        setIsPro(Boolean(json.isPro));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove(id: string) {
    setRemovingId(id);
    try {
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      await fetch(`/api/saved-investigations?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      setItems((prev) => prev.filter((it) => it.id !== id));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>
        My investigations
      </div>
      {loading ? (
        <div style={{ fontSize: 11, color: "#5a8068" }}>Loading…</div>
      ) : error ? (
        <div style={{ fontSize: 11, color: "#ff8888" }}>{error}</div>
      ) : items.length === 0 ? (
        <p style={{ fontSize: 11, color: "#5a8068", margin: 0, lineHeight: 1.6 }}>
          Save an investigation from any Oracle board with the ☆ SAVE button.
          {isBillingEnabled() ? ` Free accounts: up to ${limit ?? 5}; PRO: unlimited.` : " Unlimited saves while the platform is free."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((it) => (
            <li
              key={it.id}
              style={{
                border: "1px solid #1a3320",
                borderRadius: 3,
                padding: "10px 12px",
                background: "rgba(5,12,7,0.6)",
              }}
            >
              <div style={{ fontSize: 12, color: "#e8ffe8", marginBottom: 6, lineHeight: 1.4 }}>{it.title}</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Link href={it.boardPath} style={{ fontSize: 10, color: "#00ff88", letterSpacing: 1, textDecoration: "none" }}>
                  Board →
                </Link>
                {it.articlePath ? (
                  <Link href={it.articlePath} style={{ fontSize: 10, color: "#7aaa8a", letterSpacing: 1, textDecoration: "none" }}>
                    Article →
                  </Link>
                ) : null}
                <button
                  type="button"
                  disabled={removingId === it.id}
                  onClick={() => void remove(it.id)}
                  style={{
                    marginLeft: "auto",
                    fontSize: 9,
                    letterSpacing: 1,
                    color: "#aa6666",
                    background: "transparent",
                    border: "none",
                    cursor: removingId === it.id ? "wait" : "pointer",
                    textTransform: "uppercase",
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {!isBillingEnabled() ? null : !isPro && items.length > 0 && limit != null ? (
        <p style={{ fontSize: 10, color: "#3a5040", marginTop: 10, marginBottom: 0 }}>
          {items.length}/{limit} saved · PRO unlocks unlimited saves
        </p>
      ) : null}
    </div>
  );
}
