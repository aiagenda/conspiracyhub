"use client";

import Image from "next/image";
import Link from "next/link";
import ReaderReactionVote from "@/components/ReaderReactionVote";
import type { NewsItem } from "@/types";

function scoreColor(s: number) {
  if (s >= 70) return "#ff3333";
  if (s >= 50) return "#ffaa00";
  return "#00bb66";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NewsCard({
  item,
  onAnalyze,
  priority = false,
  read = false,
}: {
  item: NewsItem;
  onAnalyze: (item: NewsItem) => void;
  /** First visible cards: improves LCP when image is above the fold */
  priority?: boolean;
  /** User opened /article/[id] in this browser */
  read?: boolean;
}) {
  const color = scoreColor(item.score);
  const borderIdle = read ? "#1a4030" : "#1a3320";
  const borderHover = read ? "#2a6048" : "#2a4a30";

  return (
    <div
      className="animate-fade-slide-in"
      style={{
        border: `1px solid ${borderIdle}`,
        borderRadius: 4,
        background: read ? "rgba(7,14,10,0.95)" : "#090f0b",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "border-color 0.2s, opacity 0.2s",
        opacity: read ? 0.88 : 1,
        boxShadow: read ? "inset 0 0 0 1px rgba(0,187,102,0.06)" : undefined,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = borderHover;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = borderIdle;
      }}
    >
      {/* ── Card header: image OR styled placeholder ───────────────── */}
      <a href={`/article/${item.id}`} style={{ display: "block", textDecoration: "none" }}>
        <div style={{ position: "relative", height: 168, overflow: "hidden" }}>
          {item.image ? (
            <Image
              src={item.image}
              alt=""
              fill
              unoptimized
              priority={priority}
              loading={priority ? "eager" : undefined}
              sizes="(max-width: 768px) 100vw, (max-width: 1400px) 50vw, 25vw"
              style={{ objectFit: "cover", filter: "saturate(0.35) brightness(0.55)", transition: "filter 0.2s" }}
            />
          ) : (
            /* No-image placeholder: subtle scanline grid + accent glow */
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: `
                  radial-gradient(ellipse 80% 60% at 20% 50%, ${color}14 0%, transparent 70%),
                  repeating-linear-gradient(0deg, transparent, transparent 18px, rgba(255,255,255,0.018) 18px, rgba(255,255,255,0.018) 19px),
                  repeating-linear-gradient(90deg, transparent, transparent 24px, rgba(255,255,255,0.012) 24px, rgba(255,255,255,0.012) 25px),
                  #080d09
                `,
              }}
            />
          )}
          {/* shared gradient overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 35%, #090f0b)" }} />
          {/* PRIORITY SCORE badge */}
          <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(5,12,7,0.88)", border: `1px solid ${color}`, borderRadius: 3, padding: "4px 10px", fontSize: 12, color, letterSpacing: 1, fontFamily: "var(--font-raj), sans-serif", fontWeight: 700 }}>
            {item.score}% PRIORITY
          </div>
          {/* Section + time */}
          <div style={{ position: "absolute", bottom: 10, left: 12, fontSize: 11, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase" }}>
            {item.section} · {timeAgo(item.date)}
          </div>
          {/* VIEWED badge — only show when read */}
          {read && (
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                background: "rgba(0,40,28,0.85)",
                border: "1px solid rgba(0,187,102,0.45)",
                borderRadius: 2,
                padding: "3px 9px",
                fontSize: 11,
                color: "#6bc46b",
                letterSpacing: 1,
                fontFamily: "var(--font-raj), sans-serif",
                fontWeight: 700,
              }}
            >
              ✓ VIEWED
            </div>
          )}
        </div>
      </a>

      <div style={{ display: "flex", flexDirection: "row", flex: 1, minHeight: 0 }}>
        <ReaderReactionVote articleId={item.id} initial={item.reader_reaction} />
        <div
          style={{
            flex: 1,
            minWidth: 0,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >

        <a href={`/article/${item.id}`} style={{ textDecoration: "none" }}>
          <h3
            style={{
              fontFamily: "var(--font-raj), sans-serif",
              fontSize: 19,
              fontWeight: 700,
              color: read ? "#a8c8b0" : "#e8ffe8",
              lineHeight: 1.4,
              margin: 0,
              transition: "color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLHeadingElement).style.color = "#00ff88";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLHeadingElement).style.color = read ? "#a8c8b0" : "#e8ffe8";
            }}
          >
            {item.title}
          </h3>
        </a>

        {item.angle && (
          <div style={{ fontSize: 14, color: "#5a8068", borderLeft: "2px solid #1a3320", paddingLeft: 10, lineHeight: 1.65 }}>
            <span style={{ color: "#00bb66" }}>▸ </span>
            {item.angle}
          </div>
        )}


        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            onClick={() => onAnalyze(item)}
            style={{
              background: "transparent",
              border: `1px solid ${color}`,
              color,
              borderRadius: 3,
              padding: "10px 14px",
              fontFamily: "var(--font-raj), sans-serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = `${color}18`;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            ◈ READ & INVESTIGATE ▶
          </button>
          <Link
            href={`/community?article=${item.id}`}
            style={{
              display: "block",
              textAlign: "center",
              textDecoration: "none",
              background: "transparent",
              border: "1px solid #1a3320",
              color: "#5a8068",
              borderRadius: 3,
              padding: "10px 14px",
              fontFamily: "var(--font-raj), sans-serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "#00bb66";
              (e.currentTarget as HTMLAnchorElement).style.color = "#00ff88";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "#1a3320";
              (e.currentTarget as HTMLAnchorElement).style.color = "#5a8068";
            }}
          >
            ▸ DISCUSS IN COMMUNITY
          </Link>
          <Link
            href={`/article/${item.id}?chat=1`}
            style={{
              display: "block",
              textAlign: "center",
              textDecoration: "none",
              background: "transparent",
              border: "1px solid rgba(0,187,102,0.3)",
              color: "#4a7060",
              borderRadius: 3,
              padding: "10px 14px",
              fontFamily: "var(--font-raj), sans-serif",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "#00bb66";
              (e.currentTarget as HTMLAnchorElement).style.color = "#00bb66";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.borderColor = "rgba(0,187,102,0.3)";
              (e.currentTarget as HTMLAnchorElement).style.color = "#4a7060";
            }}
          >
            ◈ LIVE CHAT
          </Link>
        </div>
        </div>
      </div>
    </div>
  );
}
