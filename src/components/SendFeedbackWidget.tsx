"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

export default function SendFeedbackWidget() {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const hidden =
    pathname.startsWith("/admin") ||
    pathname === "/contact" ||
    pathname.startsWith("/contact/");

  const reset = useCallback(() => {
    setMessage("");
    setStatus("idle");
    setErrorMsg("");
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg("");
    const pageUrl = typeof window !== "undefined" ? window.location.href : pathname;
    const subject = `[Feedback] ${pathname || "/"}`.slice(0, 200);
    const body =
      `${message.trim()}\n\n---\nPage: ${pageUrl}\nSubmitted: ${new Date().toISOString()}`.slice(0, 4000);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || "Anonymous",
          email: email.trim(),
          category: "support",
          subject,
          message: body,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Send failed");
      setStatus("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Send failed");
      setStatus("error");
    }
  }

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        className="send-feedback-fab"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        style={{
          position: "fixed",
        right: 20,
        bottom: 20,
          zIndex: 90,
          fontFamily: RAJ,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 2,
          textTransform: "uppercase",
          padding: "10px 14px",
          borderRadius: 4,
          border: "1px solid #00bb66",
          background: "rgba(5,12,7,0.92)",
          color: "#00ff88",
          cursor: "pointer",
          boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        Send feedback
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-dialog-title"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(3,8,6,0.88)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#090f0b",
              border: "1px solid #1a3320",
              borderRadius: 6,
              padding: "20px 20px 18px",
              color: "#c8e8d0",
              fontFamily: FONT,
              boxShadow: "0 0 40px rgba(0,255,136,0.08)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 3, marginBottom: 4 }}>SITE FEEDBACK</div>
                <h2 id="feedback-dialog-title" style={{ fontFamily: RAJ, fontSize: 18, fontWeight: 700, color: "#00ff88", margin: 0, letterSpacing: 1 }}>
                  Ideas & fixes
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                style={{
                  background: "transparent",
                  border: "1px solid #1a3320",
                  color: "#5a8068",
                  fontSize: 12,
                  padding: "4px 10px",
                  borderRadius: 3,
                  cursor: "pointer",
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#7aaa8a", lineHeight: 1.65, margin: "0 0 16px" }}>
              What should we improve, add, or fix? Your current page URL is attached automatically for context.
            </p>

            {status === "done" ? (
              <div style={{ padding: "16px 0", textAlign: "center" }}>
                <div style={{ fontFamily: RAJ, fontSize: 16, color: "#00ff88", marginBottom: 8 }}>Thank you</div>
                <div style={{ fontSize: 12, color: "#5a8068" }}>We read every message.</div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    reset();
                  }}
                  style={{
                    marginTop: 16,
                    fontFamily: RAJ,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 2,
                    padding: "8px 16px",
                    border: "1px solid #00bb66",
                    background: "transparent",
                    color: "#00ff88",
                    borderRadius: 3,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ fontSize: 10, color: "#3a5040", wordBreak: "break-all" }}>
                  Page: <span style={{ color: "#5a8068" }}>{pathname || "/"}</span>
                </div>
                <div className="feedback-form-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1, display: "block", marginBottom: 4 }}>NAME <span style={{ color: "#3a5040" }}>(optional)</span></label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Optional"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        background: "#050c07",
                        border: "1px solid #1a3320",
                        borderRadius: 3,
                        padding: "8px 10px",
                        color: "#c8e8d0",
                        fontFamily: FONT,
                        fontSize: 12,
                        outline: "none",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1, display: "block", marginBottom: 4 }}>EMAIL <span style={{ color: "#00bb66" }}>*</span></label>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@…"
                      style={{
                        width: "100%",
                        boxSizing: "border-box",
                        background: "#050c07",
                        border: "1px solid #1a3320",
                        borderRadius: 3,
                        padding: "8px 10px",
                        color: "#c8e8d0",
                        fontFamily: FONT,
                        fontSize: 12,
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1, display: "block", marginBottom: 4 }}>MESSAGE <span style={{ color: "#00bb66" }}>*</span></label>
                  <textarea
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Bugs, feature ideas, wrong data, copy tweaks…"
                    rows={5}
                    maxLength={3500}
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      background: "#050c07",
                      border: "1px solid #1a3320",
                      borderRadius: 3,
                      padding: "10px 10px",
                      color: "#c8e8d0",
                      fontFamily: FONT,
                      fontSize: 12,
                      lineHeight: 1.55,
                      resize: "vertical",
                      outline: "none",
                    }}
                  />
                  <div style={{ fontSize: 9, color: "#2a4030", marginTop: 4 }}>{message.length} / 3500</div>
                </div>
                {status === "error" && (
                  <div style={{ fontSize: 11, color: "#ff8888", border: "1px solid rgba(255,51,51,0.35)", padding: "8px 10px", borderRadius: 3 }}>{errorMsg}</div>
                )}
                <div style={{ fontSize: 9, color: "#2a4030", letterSpacing: 1 }}><span style={{ color: "#00bb66" }}>*</span> required fields</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                  <button
                    type="submit"
                    disabled={status === "sending"}
                    style={{
                      fontFamily: RAJ,
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                      padding: "10px 18px",
                      border: "1px solid #00bb66",
                      background: status === "sending" ? "rgba(0,187,102,0.08)" : "rgba(0,255,136,0.08)",
                      color: "#00ff88",
                      borderRadius: 3,
                      cursor: status === "sending" ? "wait" : "pointer",
                      opacity: status === "sending" ? 0.7 : 1,
                    }}
                  >
                    {status === "sending" ? "Sending…" : "Submit"}
                  </button>
                  <a
                    href="/contact"
                    onClick={() => setOpen(false)}
                    style={{ fontSize: 10, color: "#5a8068", alignSelf: "center", textDecoration: "underline" }}
                  >
                    Full contact form →
                  </a>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
