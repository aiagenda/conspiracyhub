"use client";

import Image from "next/image";
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
}: {
  item: NewsItem;
  onAnalyze: (item: NewsItem) => void;
  /** First visible cards: improves LCP when image is above the fold */
  priority?: boolean;
}) {
  const color = scoreColor(item.score);

  return (
    <div
      className="animate-fade-slide-in"
      style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", overflow: "hidden", display: "flex", flexDirection: "column", transition: "border-color 0.2s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#2a4a30"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1a3320"; }}
    >
      {/* IMAGE */}
      {item.image && (
        <div style={{ position: "relative", height: 140, overflow: "hidden" }}>
          <Image
            src={item.image}
            alt=""
            fill
            unoptimized
            priority={priority}
            loading={priority ? "eager" : undefined}
            sizes="(max-width: 768px) 100vw, 360px"
            style={{ objectFit: "cover", filter: "saturate(0.35) brightness(0.55)" }}
          />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 35%, #090f0b)" }} />
          <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(5,12,7,0.88)", border: `1px solid ${color}`, borderRadius: 3, padding: "2px 8px", fontSize: 10, color, letterSpacing: 1, fontFamily: "var(--font-raj), sans-serif", fontWeight: 700 }}>
            {item.score}% THREAT
          </div>
          <div style={{ position: "absolute", bottom: 8, left: 10, fontSize: 9, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase" }}>
            {item.section} · {timeAgo(item.date)}
          </div>
        </div>
      )}

      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {/* META (no image) */}
        {!item.image && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase" }}>
              {item.section} · {timeAgo(item.date)}
            </span>
            <span style={{ fontSize: 10, color, border: `1px solid ${color}`, borderRadius: 2, padding: "1px 7px", fontFamily: "var(--font-raj), sans-serif", fontWeight: 700, letterSpacing: 1 }}>
              {item.score}%
            </span>
          </div>
        )}

        {/* TITLE */}
        <h3 style={{ fontFamily: "var(--font-raj), sans-serif", fontSize: 15, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.35, margin: 0 }}>
          {item.title}
        </h3>

        {/* ANGLE */}
        {item.angle && (
          <div style={{ fontSize: 11, color: "#5a8068", borderLeft: "2px solid #1a3320", paddingLeft: 8, lineHeight: 1.6 }}>
            <span style={{ color: "#00bb66" }}>▸ </span>{item.angle}
          </div>
        )}

        {/* SCORE BAR (no image) */}
        {!item.image && (
          <div style={{ height: 3, background: "#1a3320", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${item.score}%`, background: color, borderRadius: 2, transition: "width 0.8s ease" }} />
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => onAnalyze(item)}
          style={{ marginTop: "auto", background: "transparent", border: `1px solid ${color}`, color, borderRadius: 3, padding: "8px 12px", fontFamily: "var(--font-raj), sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", cursor: "pointer", transition: "all 0.15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${color}18`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          ◈ ORACLE INVESTIGATION ▶
        </button>
      </div>
    </div>
  );
}
