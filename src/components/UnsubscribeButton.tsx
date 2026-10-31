"use client";
import { useState } from "react";
import Link from "next/link";

export default function UnsubscribeButton({ token }: { token: string }) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(token ? "idle" : "error");

  async function leave() {
    setStatus("loading");
    try {
      const res = await fetch(`/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST" });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  const muted = { margin: "0 0 24px", color: "#888", fontSize: 14, lineHeight: 1.75 } as const;

  if (status === "done") {
    return <>
      <p style={muted}>Done — nothing further will be sent to that address. No hard feelings.</p>
      <Link href="/" style={{ color: "#00bb66", fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase" }}>← Back to the feed</Link>
    </>;
  }
  if (status === "error" && !token) {
    return <p style={muted}>This link is missing its token. Use the unsubscribe link at the foot of any briefing email.</p>;
  }

  return <>
    <p style={muted}>One click and the address this link came from is off the list straight away.</p>
    <button
      type="button"
      onClick={() => void leave()}
      disabled={status === "loading"}
      style={{ padding: "10px 18px", border: "1px solid #1a2a22", background: "transparent", color: "#00bb66", font: "13px/1.4 ui-monospace, monospace", letterSpacing: "0.06em", textTransform: "uppercase", cursor: "pointer" }}
    >
      {status === "loading" ? "Unsubscribing…" : "Unsubscribe →"}
    </button>
    {status === "error" ? <p role="alert" style={{ ...muted, marginTop: 16, color: "#cc5555" }}>That did not go through. Try again in a moment.</p> : null}
  </>;
}
