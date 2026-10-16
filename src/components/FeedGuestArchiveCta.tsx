"use client";

import { useState } from "react";

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

  if (status === "ok") return <div className="publication-newsletter" role="status"><h2>You’re on the list.</h2><p>Check your inbox for the weekly briefing.</p></div>;
  return <section className="publication-newsletter" aria-labelledby="newsletter-heading">
    <div><p className="publication-eyebrow">Stay in the loop</p><h2 id="newsletter-heading">The Weekly Oracle Brief.</h2><p>Get the weekly briefing: selected stories, research leads, and public data worth exploring.</p></div>
    <div><form onSubmit={subscribe}><label className="publication-eyebrow" htmlFor="briefing-email">Email address</label><div className="publication-newsletter-form"><input id="briefing-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" /><button className="publication-button" type="submit" disabled={status === "loading"}>{status === "loading" ? "Subscribing…" : "Get the briefing →"}</button></div></form>{status === "error" && <p role="alert">{errorMsg}</p>}<button className="publication-text-link" type="button" onClick={onRegister}>Create a free account to save investigations →</button></div>
  </section>;
}
