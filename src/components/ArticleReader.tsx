"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { NewsItem } from "@/types";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ = "var(--font-raj), sans-serif";

type Highlight = {
  text: string;
  category: string;
  note: string;
  severity: string;
};

type AnnotatedSegment = {
  text: string;
  highlight?: Highlight;
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  agency: { bg: "rgba(255,51,51,0.15)", border: "#ff3333", text: "#ff5555", dot: "#ff3333" },
  company: { bg: "rgba(255,170,0,0.15)", border: "#ffaa00", text: "#ffcc44", dot: "#ffaa00" },
  person: { bg: "rgba(0,187,102,0.15)", border: "#00bb66", text: "#00ff88", dot: "#00bb66" },
  technology: { bg: "rgba(255,85,85,0.12)", border: "#ff5555", text: "#ff8888", dot: "#ff5555" },
  event: { bg: "rgba(255,170,0,0.12)", border: "#ffaa00", text: "#ffcc44", dot: "#ffaa00" },
  theory: { bg: "rgba(201,77,255,0.15)", border: "#c94dff", text: "#e9b3ff", dot: "#c94dff" },
  location: { bg: "rgba(90,128,200,0.15)", border: "#5a80c8", text: "#8ab0ff", dot: "#5a80c8" },
};

const SEVERITY_OPACITY: Record<string, number> = {
  high: 1,
  medium: 0.75,
  low: 0.5,
};

const CATEGORY_LABELS: Record<string, string> = {
  agency: "INTELLIGENCE AGENCY",
  company: "CORPORATION",
  person: "PERSON OF INTEREST",
  technology: "TECHNOLOGY",
  event: "SUSPICIOUS EVENT",
  theory: "CONSPIRACY LINK",
  location: "KEY LOCATION",
};

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

function buildSegments(text: string, highlights: Highlight[]): AnnotatedSegment[] {
  if (!highlights.length) return [{ text }];

  const found: Array<{ start: number; end: number; highlight: Highlight }> = [];

  for (const h of highlights) {
    const idx = text.indexOf(h.text);
    if (idx === -1) continue;
    const overlaps = found.some((f) => idx < f.end && idx + h.text.length > f.start);
    if (!overlaps) {
      found.push({ start: idx, end: idx + h.text.length, highlight: h });
    }
  }

  found.sort((a, b) => a.start - b.start);

  const segments: AnnotatedSegment[] = [];
  let cursor = 0;

  for (const f of found) {
    if (cursor < f.start) {
      segments.push({ text: text.slice(cursor, f.start) });
    }
    segments.push({ text: text.slice(f.start, f.end), highlight: f.highlight });
    cursor = f.end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }

  return segments;
}

function HighlightedWord({ segment, allHighlights }: { segment: AnnotatedSegment; allHighlights: Highlight[] }) {
  const [tooltip, setTooltip] = useState(false);
  const h = segment.highlight!;
  const c = CATEGORY_COLORS[h.category] ?? CATEGORY_COLORS.agency;
  const opacity = SEVERITY_OPACITY[h.severity] ?? 0.75;

  const sameCategory = allHighlights.filter((x) => x.category === h.category).length;

  return (
    <span style={{ position: "relative", display: "inline" }}>
      <span
        onMouseEnter={() => setTooltip(true)}
        onMouseLeave={() => setTooltip(false)}
        style={{
          background: c.bg,
          borderBottom: `2px solid ${c.border}`,
          color: c.text,
          padding: "0 2px",
          borderRadius: 2,
          cursor: "pointer",
          opacity,
          transition: "opacity 0.15s",
          position: "relative",
        }}
      >
        {segment.text}
        {h.severity === "high" && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -2,
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: c.dot,
              display: "inline-block",
            }}
          />
        )}
      </span>

      {tooltip && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            width: 260,
            background: "#090f0b",
            border: `1px solid ${c.border}`,
            borderRadius: 4,
            padding: "10px 12px",
            pointerEvents: "none",
            boxShadow: `0 4px 20px rgba(0,0,0,0.8), 0 0 12px ${c.bg}`,
          }}
        >
          <span
            style={{
              position: "absolute",
              bottom: -5,
              left: "50%",
              width: 8,
              height: 8,
              background: "#090f0b",
              border: `1px solid ${c.border}`,
              borderTop: "none",
              borderLeft: "none",
              transform: "translateX(-50%) rotate(45deg)",
            }}
          />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontFamily: FONT, fontSize: 8, color: c.text, letterSpacing: 2, textTransform: "uppercase" }}>
              {CATEGORY_LABELS[h.category] ?? h.category.toUpperCase()}
            </span>
            <span
              style={{
                fontSize: 8,
                padding: "1px 5px",
                borderRadius: 2,
                border: `1px solid ${c.border}`,
                color: c.text,
                letterSpacing: 1,
                background: c.bg,
                textTransform: "uppercase",
              }}
            >
              {h.severity}
            </span>
          </div>

          <div style={{ fontFamily: FONT, fontSize: 10, color: "#c8e8d0", lineHeight: 1.65 }}>{h.note}</div>

          {sameCategory > 1 && (
            <div style={{ marginTop: 6, fontSize: 9, color: "#5a8068", letterSpacing: 1 }}>
              + {sameCategory - 1} more {h.category} flag{sameCategory > 2 ? "s" : ""} in this article
            </div>
          )}
        </span>
      )}
    </span>
  );
}

function ArticleText({ text, highlights }: { text: string; highlights: Highlight[] }) {
  const segments = buildSegments(text, highlights);

  const paragraphs = text.split(/\n\n+/);
  if (paragraphs.length <= 1) {
    return (
      <p style={{ fontFamily: FONT, fontSize: 13, color: "#c8e8d0", lineHeight: 1.9, margin: "0 0 1rem" }}>
        {segments.map((seg, i) =>
          seg.highlight ? (
            <HighlightedWord key={i} segment={seg} allHighlights={highlights} />
          ) : (
            <span key={i}>{seg.text}</span>
          ),
        )}
      </p>
    );
  }

  return (
    <>
      {paragraphs
        .filter((p) => p.trim())
        .map((para, pi) => {
          const paraSegs = buildSegments(para, highlights);
          return (
            <p key={pi} style={{ fontFamily: FONT, fontSize: 13, color: "#c8e8d0", lineHeight: 1.9, margin: "0 0 1.25rem" }}>
              {paraSegs.map((seg, i) =>
                seg.highlight ? (
                  <HighlightedWord key={i} segment={seg} allHighlights={highlights} />
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </p>
          );
        })}
    </>
  );
}

export default function ArticleReader({ item, body }: { item: NewsItem; body: string }) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [hlLoading, setHlLoading] = useState(false);
  const [hlError, setHlError] = useState("");
  const [legendOpen, setLegendOpen] = useState(true);
  const [filterCat, setFilterCat] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- highlights fetch lifecycle */
  useEffect(() => {
    if (!body) return;
    setHlLoading(true);
    fetch("/api/article-highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body, title: item.title }),
    })
      .then((r) => r.json())
      .then((data: { highlights?: Highlight[]; error?: string }) => {
        if (data.highlights) setHighlights(data.highlights);
        else setHlError(data.error ?? "Could not load highlights.");
      })
      .catch(() => setHlError("Highlight scan failed."))
      .finally(() => setHlLoading(false));
  }, [body, item.title]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const displayHighlights = filterCat ? highlights.filter((h) => h.category === filterCat) : highlights;

  const highCount = highlights.filter((h) => h.severity === "high").length;

  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ height: 44, background: "#050c07", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
          <Link
            href="/"
            style={{ fontSize: 10, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3 }}
          >
            ← FEED
          </Link>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>THE THEORIST</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Link
              href={`/board/${item.id}`}
              style={{
                fontFamily: RAJ,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                padding: "6px 14px",
                borderRadius: 3,
                border: "1px solid #00bb66",
                color: "#00ff88",
                textDecoration: "none",
              }}
            >
              ◈ INVESTIGATION BOARD ▶
            </Link>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              style={{
                fontFamily: RAJ,
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                padding: "6px 14px",
                borderRadius: 3,
                border: "1px solid #1a3320",
                color: "#5a8068",
                textDecoration: "none",
              }}
            >
              ↗ ORIGINAL
            </a>
          </div>
        </div>

        <div
          style={{
            maxWidth: 860,
            margin: "0 auto",
            padding: "2rem 1.25rem 4rem",
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "2rem",
          }}
          className="article-reader-grid"
        >
          <style>{`
            @media (min-width: 960px) {
              .article-reader-grid { grid-template-columns: 1fr 260px !important; }
            }
          `}</style>

          <div>
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase" }}>{item.section}</span>
                <span style={{ fontSize: 9, color: "#3a5040", letterSpacing: 1 }}>{timeAgo(item.date)}</span>
                <span
                  style={{
                    fontSize: 10,
                    color: scoreColor(item.score),
                    border: `1px solid ${scoreColor(item.score)}`,
                    padding: "1px 7px",
                    borderRadius: 2,
                    fontFamily: RAJ,
                    fontWeight: 700,
                    letterSpacing: 1,
                  }}
                >
                  {item.score}% THREAT
                </span>
                {highCount > 0 && (
                  <span style={{ fontSize: 10, color: "#ff3333", border: "1px solid rgba(255,51,51,0.3)", padding: "1px 7px", borderRadius: 2, letterSpacing: 1 }}>
                    ⚠ {highCount} HIGH SEVERITY FLAG{highCount > 1 ? "S" : ""}
                  </span>
                )}
              </div>
              <h1 style={{ fontFamily: RAJ, fontSize: 26, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.25, margin: "0 0 10px" }}>{item.title}</h1>
              {item.angle && (
                <div style={{ padding: "8px 12px", borderLeft: "2px solid #1a3320", fontSize: 12, color: "#5a8068", lineHeight: 1.6 }}>
                  <span style={{ color: "#00bb66" }}>▸ </span>
                  {item.angle}
                </div>
              )}
            </div>

            {item.image && (
              <div style={{ position: "relative", height: 320, marginBottom: "1.5rem", borderRadius: 4, overflow: "hidden" }}>
                <Image src={item.image} alt="" fill unoptimized style={{ objectFit: "cover", filter: "saturate(0.4) brightness(0.65)" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, #050c07)" }} />
              </div>
            )}

            {hlLoading && (
              <div
                style={{
                  marginBottom: "1rem",
                  padding: "8px 12px",
                  border: "1px solid #1a3320",
                  borderRadius: 3,
                  background: "rgba(0,255,136,0.02)",
                  fontSize: 10,
                  color: "#00bb66",
                  letterSpacing: 2,
                }}
              >
                <span style={{ animation: "blink 0.9s step-end infinite", display: "inline-block" }}>◉</span> SCANNING ARTICLE FOR CONSPIRACY SIGNALS...
              </div>
            )}
            {hlError && (
              <div style={{ marginBottom: "1rem", fontSize: 10, color: "#ff3333" }}>
                [{hlError}]
              </div>
            )}

            {!body && item.summary && (
              <div
                style={{
                  marginBottom: "1rem",
                  padding: "12px 14px",
                  border: "1px solid #1a3320",
                  borderRadius: 3,
                  background: "rgba(0,255,136,0.02)",
                  fontSize: 11,
                  color: "#7aaa8a",
                  lineHeight: 1.7,
                }}
              >
                <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 6 }}>ARTICLE SUMMARY</div>
                {item.summary}
              </div>
            )}

            {body && (
              <div style={{ marginBottom: "1.5rem" }}>
                <ArticleText text={body} highlights={displayHighlights} />
              </div>
            )}

            <Link
              href={`/board/${item.id}`}
              style={{
                display: "block",
                padding: "14px",
                border: "1px solid #00bb66",
                borderRadius: 4,
                textAlign: "center",
                textDecoration: "none",
                background: "rgba(0,255,136,0.04)",
                transition: "all 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,136,0.08)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,136,0.04)";
              }}
            >
              <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 3, marginBottom: 4 }}>◈ OPEN INVESTIGATION BOARD ▶</div>
              <div style={{ fontSize: 10, color: "#5a8068", letterSpacing: 1 }}>AI-generated node graph · CIA FOIA · USPTO patents · conspiracy theories</div>
            </Link>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", overflow: "hidden" }}>
              <div
                onClick={() => setLegendOpen((o) => !o)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setLegendOpen((o) => !o);
                }}
                style={{
                  padding: "10px 12px",
                  borderBottom: legendOpen ? "1px solid #1a3320" : "none",
                  display: "flex",
                  justifyContent: "space-between",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontFamily: FONT, fontSize: 9, color: "#00bb66", letterSpacing: 2 }}>◈ SIGNAL LEGEND</div>
                <span style={{ color: "#5a8068", fontSize: 10 }}>{legendOpen ? "▲" : "▼"}</span>
              </div>
              {legendOpen && (
                <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                    const c = CATEGORY_COLORS[cat];
                    const count = highlights.filter((h) => h.category === cat).length;
                    if (count === 0) return null;
                    return (
                      <div
                        key={cat}
                        onClick={() => setFilterCat((f) => (f === cat ? null : cat))}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") setFilterCat((f) => (f === cat ? null : cat));
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          cursor: "pointer",
                          opacity: filterCat && filterCat !== cat ? 0.35 : 1,
                          transition: "opacity 0.15s",
                        }}
                      >
                        <span style={{ width: 8, height: 8, borderRadius: 1, background: c.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: 10, color: "#5a8068", flex: 1, letterSpacing: 0.5 }}>{label}</span>
                        <span style={{ fontSize: 10, color: c.text, fontFamily: RAJ, fontWeight: 700 }}>{count}</span>
                      </div>
                    );
                  })}
                  {filterCat && (
                    <button
                      type="button"
                      onClick={() => setFilterCat(null)}
                      style={{
                        marginTop: 4,
                        background: "transparent",
                        border: "1px solid #1a3320",
                        color: "#5a8068",
                        fontFamily: FONT,
                        fontSize: 9,
                        padding: "4px",
                        borderRadius: 2,
                        cursor: "pointer",
                        letterSpacing: 1,
                      }}
                    >
                      CLEAR FILTER
                    </button>
                  )}
                </div>
              )}
            </div>

            {highlights.length > 0 && (
              <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", overflow: "hidden" }}>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #1a3320" }}>
                  <div style={{ fontFamily: FONT, fontSize: 9, color: "#ff3333", letterSpacing: 2 }}>
                    ⚠ FLAGGED SIGNALS ({displayHighlights.length})
                  </div>
                </div>
                <div style={{ maxHeight: 420, overflowY: "auto" }}>
                  {displayHighlights.map((h, i) => {
                    const c = CATEGORY_COLORS[h.category] ?? CATEGORY_COLORS.agency;
                    return (
                      <div key={i} style={{ padding: "9px 12px", borderBottom: "1px solid #0d1a10" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: c.text }}>{h.text}</span>
                          <span
                            style={{
                              fontSize: 8,
                              color: c.dot,
                              border: `1px solid ${c.border}`,
                              padding: "1px 5px",
                              borderRadius: 2,
                              letterSpacing: 1,
                              flexShrink: 0,
                              marginLeft: 4,
                            }}
                          >
                            {h.severity.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 1, marginBottom: 4 }}>
                          {CATEGORY_LABELS[h.category] ?? h.category}
                        </div>
                        <div style={{ fontFamily: FONT, fontSize: 10, color: "#7a9a8a", lineHeight: 1.55 }}>{h.note}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {hlLoading && (
              <div style={{ fontSize: 10, color: "#3a5040", letterSpacing: 1, textAlign: "center", padding: 12 }}>Scanning for signals...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
