"use client";

import { useState } from "react";
import { pageContentShellStyle } from "@/lib/pageShell";

const CATS = [
  { id: "support",  label: "Support / Bug" },
  { id: "business", label: "Business / Partnerships" },
  { id: "press",    label: "Press / Media" },
  { id: "other",    label: "Other" },
];

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "", email: "", category: "support", subject: "", message: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function set(field: string, val: string) {
    setForm((f) => ({ ...f, [field]: val }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setStatus("done");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to send");
      setStatus("error");
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", background: "#0a0a0a", border: "1px solid #2a2a2a",
    borderRadius: 6, padding: "10px 14px", color: "#e8e8e8",
    fontSize: 14, outline: "none", boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block", fontSize: 11, letterSpacing: "0.08em",
    color: "#666", textTransform: "uppercase", marginBottom: 6,
  };

  if (status === "done") {
    return (
      <div style={pageContentShellStyle({ maxWidth: 680 })}>
        <div style={{
          marginTop: 60, padding: "40px 32px", background: "#0d0d0d",
          border: "1px solid #1a3a1a", borderRadius: 12, textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>✓</div>
          <h2 style={{ margin: "0 0 12px", color: "#e8e8e8", fontSize: 20 }}>
            Message received
          </h2>
          <p style={{ margin: 0, color: "#888", fontSize: 14, lineHeight: 1.6 }}>
            We&apos;ll review your message and get back to you if needed.
            Thank you for reaching out.
          </p>
          <button
            onClick={() => { setForm({ name: "", email: "", category: "support", subject: "", message: "" }); setStatus("idle"); }}
            style={{
              marginTop: 24, padding: "9px 20px", background: "transparent",
              border: "1px solid #333", borderRadius: 6, color: "#aaa",
              fontSize: 12, cursor: "pointer",
            }}
          >
            Send another message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={pageContentShellStyle({ maxWidth: 760 })}>
      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <p style={{ margin: "0 0 8px", fontSize: 11, letterSpacing: "0.12em", color: "#444", textTransform: "uppercase" }}>
          ConspiracyHub
        </p>
        <h1 style={{ margin: "0 0 10px", fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: "#e8e8e8" }}>
          Contact
        </h1>
        <p style={{ margin: 0, color: "#666", fontSize: 14, lineHeight: 1.6, maxWidth: 540 }}>
          Questions, bug reports, business inquiries, press requests — use the form below.
          We read everything and respond to serious inquiries.
        </p>
      </div>

      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Category */}
        <div>
          <label style={labelStyle}>Category</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CATS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => set("category", c.id)}
                style={{
                  padding: "7px 14px", border: "1px solid",
                  borderColor: form.category === c.id ? "#4a9a4a" : "#222",
                  borderRadius: 6,
                  background: form.category === c.id ? "rgba(74,154,74,0.12)" : "transparent",
                  color: form.category === c.id ? "#6bc46b" : "#666",
                  fontSize: 12, cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Name + Email row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div>
            <label style={labelStyle}>Name *</label>
            <input
              required value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="Your name" style={inp}
            />
          </div>
          <div>
            <label style={labelStyle}>Email *</label>
            <input
              required type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
              placeholder="your@email.com" style={inp}
            />
          </div>
        </div>

        {/* Subject */}
        <div>
          <label style={labelStyle}>Subject *</label>
          <input
            required value={form.subject} onChange={(e) => set("subject", e.target.value)}
            placeholder="Brief description" style={inp}
          />
        </div>

        {/* Message */}
        <div>
          <label style={labelStyle}>Message *</label>
          <textarea
            required
            rows={7}
            value={form.message}
            onChange={(e) => set("message", e.target.value)}
            placeholder="Describe your issue, question or proposal in detail..."
            style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }}
          />
          <p style={{ margin: "6px 0 0", fontSize: 11, color: "#444" }}>
            {form.message.length} / 4000 characters
          </p>
        </div>

        {status === "error" && (
          <p style={{ margin: 0, padding: "10px 14px", background: "rgba(180,60,60,0.1)", border: "1px solid #4a1a1a", borderRadius: 6, color: "#e06060", fontSize: 13 }}>
            {errorMsg}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "sending"}
          style={{
            alignSelf: "flex-start", padding: "11px 28px",
            background: status === "sending" ? "#1a2a1a" : "#1e3a1e",
            border: "1px solid #2a5a2a", borderRadius: 7,
            color: status === "sending" ? "#4a7a4a" : "#6bc46b",
            fontSize: 13, fontWeight: 600, letterSpacing: "0.04em",
            cursor: status === "sending" ? "not-allowed" : "pointer",
            transition: "all 0.15s",
          }}
        >
          {status === "sending" ? "Sending…" : "Send Message"}
        </button>
      </form>
    </div>
  );
}
