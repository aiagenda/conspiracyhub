"use client";

import Link from "next/link";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

export default function RegisteredOnlyGate({
  variant = "fullscreen",
  title = "SIGN IN REQUIRED",
  subtitle = "Live chat and community threads are for registered members only. Create an account or sign in on the feed.",
  onClose,
}: {
  variant?: "fullscreen" | "embedded";
  title?: string;
  subtitle?: string;
  onClose?: () => void;
}) {
  const outer =
    variant === "fullscreen"
      ? {
          minHeight: "100vh",
          padding: 24,
        }
      : {
          height: "100%",
          minHeight: 280,
          padding: 16,
        };

  return (
    <div
      style={{
        ...outer,
        background: "#050c07",
        color: "#c8e8d0",
        fontFamily: FONT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: variant === "embedded" ? 360 : 420,
          border: "1px solid rgba(255,170,0,0.5)",
          borderRadius: 6,
          padding: variant === "embedded" ? "20px 18px" : "26px 24px",
          textAlign: "center",
          background: "linear-gradient(180deg, rgba(255,170,0,0.08) 0%, transparent 55%)",
          boxShadow: "0 0 28px rgba(255,170,0,0.12)",
          position: "relative",
        }}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              background: "transparent",
              border: "none",
              color: "#3a5040",
              cursor: "pointer",
              fontSize: 16,
              padding: 4,
              lineHeight: 1,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        )}
        <div
          style={{
            fontFamily: RAJ,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 4,
            color: "#ffaa33",
            marginBottom: 10,
          }}
        >
          ⚠ MEMBERS ONLY
        </div>
        <h2
          style={{
            fontFamily: RAJ,
            fontSize: variant === "embedded" ? 16 : 18,
            fontWeight: 700,
            letterSpacing: 2,
            color: "#ffcc88",
            margin: "0 0 12px",
            lineHeight: 1.25,
            textTransform: "uppercase",
          }}
        >
          {title}
        </h2>
        <p style={{ fontSize: 11, color: "#8aaa96", lineHeight: 1.7, margin: "0 0 18px" }}>{subtitle}</p>
        <Link
          href="/"
          style={{
            display: "block",
            fontFamily: RAJ,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            padding: "10px 14px",
            border: "1px solid #00bb66",
            background: "rgba(0,255,136,0.08)",
            color: "#00ff88",
            textDecoration: "none",
            borderRadius: 4,
          }}
        >
          GO TO FEED — SIGN IN OR SIGN UP
        </Link>
      </div>
    </div>
  );
}
