"use client";

import { useState } from "react";

const RAJ = "var(--font-raj), sans-serif";
const FONT = "var(--font-share-tech-mono), monospace";

type Props = {
  onRegister: () => void;
};

/** Soft prompt for guests browsing the archive — no hard pagination gate. */
export default function FeedGuestArchiveCta({ onRegister }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setErrorMsg("Enter a valid email.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/newsletter/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "feed_archive" }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErrorMsg(json.error ?? "Could not subscribe.");
        setStatus("error");
        return;
      }
      setStatus("ok");
      setEmail("");
    } catch {
      setErrorMsg("Network error — try again.");
      setStatus("error");
    }
  }

  if (status === "ok") {
    return (
      <div
        style={{
          marginTop: "1.75rem",
          padding: "18px 20px",
          border: "1px solid rgba(0,255,136,0.35)",
          borderRadius: 6,
          background: "rgba(0,255,136,0.05)",
          textAlign: "center",
        }}
      >
        <div style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#00ff88", letterSpacing: 1.5, marginBottom: 6 }}>
          ✓ YOU&apos;RE ON THE LIST
        </div>
        <p style={{ fontFamily: FONT, fontSize: 12, color: "#7aaa8a", margin: 0, lineHeight: 1.65 }}>
          Weekly Oracle Brief — check your inbox for confirmation.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        marginTop: "1.75rem",
        padding: "20px 22px",
        border: "1px solid rgba(0,187,102,0.35)",
        borderRadius: 6,
        background: "linear-gradient(180deg, rgba(0,255,136,0.06) 0%, transparent 70%)",
      }}
    >
      <div style={{ fontFamily: RAJ, fontSize: 10, fontWeight: 700, letterSpacing: 4, color: "#00bb66", marginBottom: 8 }}>
        ◈ STAY IN THE LOOP
      </div>
      <div style={{ fontFamily: RAJ, fontSize: 17, fontWeight: 700, color: "#c8e8d0", marginBottom: 8, lineHeight: 1.35 }}>
        Digging through the archive?
      </div>
      <p style={{ fontFamily: FONT, fontSize: 12, color: "#8aaa96", lineHeight: 1.75, margin: "0 0 16px", maxWidth: 520 }}>
        Get the <strong style={{ color: "#c8e8d0" }}>Weekly Oracle Brief</strong> by email — top boards, priority signals, and outbreak
        highlights. Or register free for Oracle triggers, saved investigations, and briefing prefs on Account.
      </p>

      <form onSubmit={subscribe} style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14, maxWidth: 480 }}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@email.com — weekly briefing"
          aria-label="Email for weekly newsletter"
          style={{
            flex: "1 1 200px",
            minWidth: 0,
            padding: "10px 12px",
            background: "#090f0b",
            border: "1px solid #1a3320",
            borderRadius: 4,
            color: "#c8e8d0",
            fontFamily: FONT,
            fontSize: 13,
          }}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          style={{
            fontFamily: RAJ,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            padding: "10px 16px",
            border: "1px solid #00bb66",
            background: "rgba(0,255,136,0.1)",
            color: "#00ff88",
            borderRadius: 4,
            cursor: status === "loading" ? "wait" : "pointer",
            opacity: status === "loading" ? 0.7 : 1,
          }}
        >
          {status === "loading" ? "…" : "Newsletter"}
        </button>
      </form>

      {status === "error" && errorMsg ? (
        <p style={{ fontFamily: FONT, fontSize: 11, color: "#ff6666", margin: "0 0 12px" }}>{errorMsg}</p>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <button
          type="button"
          onClick={onRegister}
          style={{
            fontFamily: RAJ,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            padding: "9px 16px",
            border: "1px solid #1a3320",
            background: "transparent",
            color: "#9ec8ae",
            borderRadius: 4,
            cursor: "pointer",
          }}
        >
          Register free →
        </button>
        <span style={{ fontFamily: FONT, fontSize: 10, color: "#3a5040" }}>
          Browsing stays free — no paywall on older pages.
        </span>
      </div>
    </div>
  );
}
