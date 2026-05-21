"use client";

import { useCallback, useEffect, useState } from "react";
import { muted } from "@/components/admin/constants";

type InsiderSignal = {
  signal_key: string;
  tracker_name: string;
  category: string;
  title: string;
  url: string;
  published: string;
  promoted: boolean;
  board_id: string | null;
  board_url: string | null;
};

export function InsiderSignalsSection() {
  const [signals, setSignals] = useState<InsiderSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [promotingKey, setPromotingKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ title: string; board_url: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/insider-signals");
      const d = await res.json();
      if (d.error) setError(d.error);
      else setSignals(d.signals ?? []);
    } catch (e) {
      setError(String(e));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function promote(signalKey: string) {
    setPromotingKey(signalKey);
    setError("");
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/insider-signals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "promote", signalKey }),
      });
      const d = await res.json();
      if (!res.ok || d.error) {
        setError(d.error ?? `Request failed (${res.status})`);
      } else {
        setSuccess({
          title: String(d.title ?? "Board item created"),
          board_url: String(d.board_url ?? ""),
        });
        await load();
      }
    } catch (e) {
      setError(String(e));
    }
    setPromotingKey(null);
  }

  const unpromoted = signals.filter((s) => !s.promoted);

  return (
    <div className="mb-6 overflow-hidden rounded" style={{ border: "1px solid #1a3320", background: "#090f0b" }}>
      <div className="border-b px-4 py-3" style={{ borderColor: "#1a3320" }}>
        <div className="font-mono text-[10px] uppercase tracking-widest" style={{ color: "#8aa6ff" }}>
          Insider signals → board
        </div>
        <p className="mt-1 font-mono text-[10px] leading-relaxed" style={{ color: muted }}>
          Hot X posts from Insider Radar. Promote to feed board first — then Reddit Radar can match your article, not the raw tweet.
        </p>
      </div>

      {error ? (
        <div className="px-4 py-2 font-mono text-[10px]" style={{ color: "#ff6666" }}>
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          className="mx-4 mb-3 rounded border px-3 py-2 font-mono text-[10px]"
          style={{ borderColor: "rgba(0,187,102,0.35)", color: "#00bb66", background: "rgba(0,187,102,0.08)" }}
        >
          ✓ Board item created:{" "}
          {success.board_url ? (
            <a href={success.board_url} target="_blank" rel="noreferrer" className="underline" style={{ color: "#00ff88" }}>
              {success.title}
            </a>
          ) : (
            success.title
          )}
          {" "}— now click <strong>Scan Reddit</strong> below to find matching threads.
        </div>
      ) : null}

      {loading ? (
        <div className="px-4 py-6 font-mono text-[10px]" style={{ color: muted }}>
          Loading signals…
        </div>
      ) : unpromoted.length === 0 ? (
        <div className="px-4 py-6 font-mono text-[10px]" style={{ color: muted }}>
          No unpromoted Twitter signals in the last 7 days.
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: "#1a3320" }}>
          {unpromoted.slice(0, 8).map((s) => (
            <div key={s.signal_key} className="p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className="rounded px-2 py-0.5 font-mono text-[9px] uppercase"
                  style={{ color: "#8aa6ff", border: "1px solid rgba(138,166,255,0.35)" }}
                >
                  @{s.tracker_name}
                </span>
                <span className="font-mono text-[9px] uppercase" style={{ color: muted }}>
                  {s.category}
                </span>
              </div>
              <a
                href={s.url}
                target="_blank"
                rel="noreferrer"
                className="mb-3 block font-mono text-xs leading-relaxed no-underline hover:underline"
                style={{ color: "var(--foreground)" }}
              >
                ↗ {s.title}
              </a>
              <button
                type="button"
                onClick={() => void promote(s.signal_key)}
                disabled={promotingKey === s.signal_key}
                className="rounded border px-2 py-1 font-mono text-[9px] uppercase"
                style={{
                  borderColor: "#8aa6ff",
                  color: "#8aa6ff",
                  opacity: promotingKey === s.signal_key ? 0.5 : 1,
                  cursor: promotingKey === s.signal_key ? "wait" : "pointer",
                }}
              >
                {promotingKey === s.signal_key ? "Creating board item…" : "◈ Promote to board"}
              </button>
            </div>
          ))}
        </div>
      )}

      {signals.some((s) => s.promoted) ? (
        <div className="border-t px-4 py-3" style={{ borderColor: "#1a3320" }}>
          <div className="mb-2 font-mono text-[9px] uppercase tracking-widest" style={{ color: muted }}>
            Already on board
          </div>
          <div className="space-y-2">
            {signals
              .filter((s) => s.promoted)
              .slice(0, 4)
              .map((s) => (
                <div key={s.signal_key} className="font-mono text-[10px]" style={{ color: muted }}>
                  <a href={s.board_url ?? "#"} target="_blank" rel="noreferrer" style={{ color: "var(--green)" }}>
                    {s.title.slice(0, 80)}
                    {s.title.length > 80 ? "…" : ""}
                  </a>
                </div>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
