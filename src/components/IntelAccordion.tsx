"use client";

import { useState, type ReactNode } from "react";

const RAJ = "var(--font-raj), sans-serif";
const FONT = "var(--font-share-tech-mono), monospace";

export function CollapsibleSection({
  title,
  subtitle,
  count,
  accent = "#00bb66",
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  count?: number;
  accent?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className="intel-collapsible"
      style={{ border: "1px solid #1a3320", borderRadius: 4, overflow: "hidden", background: "#090f0b" }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="intel-collapsible-trigger"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "11px 13px",
          background: open ? "rgba(0,0,0,0.25)" : "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          fontFamily: FONT,
        }}
      >
        <span style={{ color: accent, fontSize: 12, flexShrink: 0, width: 14 }}>{open ? "▾" : "▸"}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: 10,
              color: accent,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {title}
            {count != null ? ` (${count})` : ""}
          </span>
          {subtitle && !open ? (
            <span
              style={{
                display: "block",
                fontSize: 10,
                color: "#3a5040",
                letterSpacing: 0.5,
                marginTop: 3,
                lineHeight: 1.4,
              }}
            >
              {subtitle}
            </span>
          ) : null}
        </span>
      </button>
      {open ? (
        <div className="intel-collapsible-body" style={{ padding: "0 13px 13px" }}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function IntelSectionChips({ chips }: { chips: Array<{ label: string; color?: string }> }) {
  if (!chips.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {chips.map((c) => (
        <span
          key={c.label}
          style={{
            fontSize: 9,
            color: c.color ?? "#5a8068",
            border: `1px solid ${(c.color ?? "#5a8068")}44`,
            padding: "3px 8px",
            borderRadius: 2,
            letterSpacing: 1,
          }}
        >
          {c.label}
        </span>
      ))}
    </div>
  );
}

export function IntelExpandBar({
  expanded,
  onToggle,
  expandLabel = "▼ EXPAND FULL INTEL",
  collapseLabel = "▲ SHOW LESS",
}: {
  expanded: boolean;
  onToggle: () => void;
  expandLabel?: string;
  collapseLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`intel-expand-bar${expanded ? " intel-expand-bar--expanded" : ""}`}
      style={{
        width: "100%",
        marginTop: expanded ? 8 : 0,
        padding: "10px 12px",
        background: expanded ? "transparent" : "rgba(0,255,136,0.04)",
        border: `1px solid ${expanded ? "#1a3320" : "rgba(0,187,102,0.35)"}`,
        borderRadius: 4,
        color: "#00bb66",
        fontFamily: RAJ,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 2,
        cursor: "pointer",
      }}
    >
      {expanded ? collapseLabel : expandLabel}
    </button>
  );
}
