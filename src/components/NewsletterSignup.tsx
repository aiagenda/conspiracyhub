"use client";
import { useId, useState } from "react";

type Props = { source: string; variant?: "panel" | "footer" };

/**
 * The one place readers are asked for anything. It used to live in a single
 * guest-only block at the foot of the feed, which is why it collected nobody.
 */
export default function NewsletterSignup({ source, variant = "panel" }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fieldId = useId();

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
        body: JSON.stringify({ email: trimmed, source }),
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
    return <p className="newsletter-done" role="status">
      Check your inbox — the subscription is live once you click the link in that email.
    </p>;
  }

  return <form onSubmit={subscribe} className={`newsletter-form newsletter-form--${variant}`}>
    <label className="publication-eyebrow" htmlFor={fieldId}>Email address</label>
    <div className="publication-newsletter-form">
      <input id={fieldId} type="email" autoComplete="email" required value={email}
        onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      <button className="publication-button" type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Subscribing…" : "Get the briefing →"}
      </button>
    </div>
    {status === "error" ? <p role="alert">{errorMsg}</p> : null}
  </form>;
}
