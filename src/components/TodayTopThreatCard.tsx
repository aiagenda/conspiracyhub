"use client";

import Link from "next/link";
import type { NewsItem } from "@/types";

function scoreColor(s: number) {
  if (s >= 70) return "#ff3333";
  if (s >= 50) return "#ffaa00";
  return "#00bb66";
}

export default function TodayTopThreatCard({ item }: { item: NewsItem }) {
  const color = scoreColor(item.score);

  return (
    <div
      style={{
        marginBottom: "1.5rem",
        border: `1px solid ${color}55`,
        borderRadius: 4,
        background: "linear-gradient(135deg, rgba(255,51,51,0.08) 0%, rgba(5,12,7,0.95) 55%)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(255,51,51,0.15)" }}>
        <div
          style={{
            fontFamily: "var(--font-raj), sans-serif",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 3,
            color: color,
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          ◈ Today&apos;s top threat
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
          <div
            style={{
              fontFamily: "var(--font-raj), sans-serif",
              fontSize: 28,
              fontWeight: 700,
              color,
              lineHeight: 1,
              minWidth: 56,
            }}
          >
            {item.score}%
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h2
              style={{
                fontFamily: "var(--font-raj), sans-serif",
                fontSize: 16,
                fontWeight: 700,
                color: "#e8ffe8",
                margin: "0 0 6px",
                lineHeight: 1.35,
              }}
            >
              {item.title}
            </h2>
            {item.angle ? (
              <p style={{ fontSize: 11, color: "#9ec8ae", margin: 0, lineHeight: 1.55, maxWidth: 640 }}>
                {item.angle}
              </p>
            ) : null}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, padding: "10px 16px", flexWrap: "wrap" }}>
        <Link
          href={`/article/${item.id}`}
          style={{
            fontFamily: "var(--font-raj), sans-serif",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            padding: "7px 14px",
            border: `1px solid ${color}`,
            background: `${color}18`,
            color,
            textDecoration: "none",
            borderRadius: 3,
          }}
        >
          Read report →
        </Link>
        <Link
          href={`/board/${item.id}`}
          style={{
            fontFamily: "var(--font-raj), sans-serif",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            padding: "7px 14px",
            border: "1px solid #1a3320",
            background: "rgba(0,255,136,0.04)",
            color: "#00ff88",
            textDecoration: "none",
            borderRadius: 3,
          }}
        >
          Investigation board →
        </Link>
      </div>
    </div>
  );
}
