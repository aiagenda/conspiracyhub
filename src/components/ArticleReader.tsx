"use client";

import { useEffect, useState, useRef } from "react";
import PolymarketWidget from "@/components/PolymarketWidget";
import Link from "next/link";
import Image from "next/image";
import type { NewsItem } from "@/types";
import { pageContentShellStyle } from "@/lib/pageShell";
import { markArticleRead } from "@/lib/readArticles";

const FONT = "var(--font-share-tech-mono), monospace";
const RAJ  = "var(--font-raj), sans-serif";

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
  agency:     { bg: "rgba(255,51,51,0.15)",   border: "#ff3333", text: "#ff5555", dot: "#ff3333" },
  company:    { bg: "rgba(255,170,0,0.15)",   border: "#ffaa00", text: "#ffcc44", dot: "#ffaa00" },
  person:     { bg: "rgba(0,187,102,0.15)",   border: "#00bb66", text: "#00ff88", dot: "#00bb66" },
  technology: { bg: "rgba(255,85,85,0.12)",   border: "#ff5555", text: "#ff8888", dot: "#ff5555" },
  event:      { bg: "rgba(255,170,0,0.12)",   border: "#ffaa00", text: "#ffcc44", dot: "#ffaa00" },
  theory:     { bg: "rgba(201,77,255,0.15)",  border: "#c94dff", text: "#e9b3ff", dot: "#c94dff" },
  location:   { bg: "rgba(90,128,200,0.15)",  border: "#5a80c8", text: "#8ab0ff", dot: "#5a80c8" },
};

const SEVERITY_OPACITY: Record<string, number> = {
  high: 1, medium: 0.75, low: 0.5,
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

/** Extra text for Polymarket keyword matching (not only the headline). */
function buildArticlePolymarketContext(item: NewsItem, body: string, highlights: Highlight[]): string {
  const parts: string[] = [];
  if (item.summary?.trim()) parts.push(item.summary.trim());
  if (item.angle?.trim()) parts.push(item.angle.trim());
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat) parts.push(flat.slice(0, 700));
  const hl = [...new Set(highlights.map((h) => h.text.trim()).filter(Boolean))];
  if (hl.length) parts.push(hl.slice(0, 20).join(" "));
  return parts.join(" ").slice(0, 2200);
}

// Build annotated segments from text + highlights
function buildSegments(text: string, highlights: Highlight[]): AnnotatedSegment[] {
  if (!highlights.length) return [{ text }];

  // Sort highlights by first occurrence in text
  const found: Array<{ start: number; end: number; highlight: Highlight }> = [];

  for (const h of highlights) {
    const idx = text.indexOf(h.text);
    if (idx === -1) continue;
    // Skip if overlapping with already found
    const overlaps = found.some(f => idx < f.end && idx + h.text.length > f.start);
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
  const ref = useRef<HTMLSpanElement>(null);
  const h = segment.highlight!;
  const c = CATEGORY_COLORS[h.category] ?? CATEGORY_COLORS.agency;
  const opacity = SEVERITY_OPACITY[h.severity] ?? 0.75;

  // Find similar highlights (same category) to show count
  const sameCategory = allHighlights.filter(x => x.category === h.category).length;

  return (
    <span style={{ position: "relative", display: "inline" }}>
      <span
        ref={ref}
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
        {/* Severity dot */}
        {h.severity === "high" && (
          <span style={{
            position: "absolute", top: -4, right: -2,
            width: 5, height: 5, borderRadius: "50%",
            background: c.dot, display: "inline-block",
          }} />
        )}
      </span>

      {/* Tooltip */}
      {tooltip && (
        <span style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 100,
          display: "block",
          width: 260,
          background: "#090f0b",
          border: `1px solid ${c.border}`,
          borderRadius: 4,
          padding: "10px 12px",
          pointerEvents: "none",
          boxShadow: `0 4px 20px rgba(0,0,0,0.8), 0 0 12px ${c.bg}`,
        }}>
          {/* Arrow */}
          <span style={{
            position: "absolute", bottom: -5, left: "50%",
            width: 8, height: 8, background: "#090f0b",
            border: `1px solid ${c.border}`, borderTop: "none", borderLeft: "none",
            transform: "translateX(-50%) rotate(45deg)",
          }} />

          <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontFamily: FONT, fontSize: 9, color: c.text, letterSpacing: 2, textTransform: "uppercase" }}>
              {CATEGORY_LABELS[h.category] ?? h.category.toUpperCase()}
            </span>
            <span style={{
              fontSize: 9, padding: "1px 5px", borderRadius: 2,
              border: `1px solid ${c.border}`, color: c.text, letterSpacing: 1,
              background: c.bg, textTransform: "uppercase",
            }}>
              {h.severity}
            </span>
          </span>

          <span style={{ display: "block", fontFamily: FONT, fontSize: 11, color: "#c8e8d0", lineHeight: 1.65 }}>
            {h.note}
          </span>

          {sameCategory > 1 && (
            <span style={{ display: "block", marginTop: 6, fontSize: 10, color: "#5a8068", letterSpacing: 1 }}>
              + {sameCategory - 1} more {h.category} flag{sameCategory > 2 ? "s" : ""} in this article
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function ArticleText({ text, highlights }: { text: string; highlights: Highlight[] }) {
  const segments = buildSegments(text, highlights);

  // Split into paragraphs first
  const paragraphs = text.split(/\n\n+/);
  if (paragraphs.length <= 1) {
    // Render as one block
    return (
      <p style={{ fontFamily: FONT, fontSize: 15, color: "#c8e8d0", lineHeight: 1.85, margin: "0 0 1.1rem" }}>
        {segments.map((seg, i) =>
          seg.highlight
            ? <HighlightedWord key={i} segment={seg} allHighlights={highlights} />
            : <span key={i}>{seg.text}</span>
        )}
      </p>
    );
  }

  // Rebuild segments per paragraph
  return (
    <>
      {paragraphs.filter(p => p.trim()).map((para, pi) => {
        const paraSegs = buildSegments(para, highlights);
        return (
          <p key={pi} style={{ fontFamily: FONT, fontSize: 15, color: "#c8e8d0", lineHeight: 1.85, margin: "0 0 1.35rem" }}>
            {paraSegs.map((seg, i) =>
              seg.highlight
                ? <HighlightedWord key={i} segment={seg} allHighlights={highlights} />
                : <span key={i}>{seg.text}</span>
            )}
          </p>
        );
      })}
    </>
  );
}

export default function ArticleReader({ item, body }: { item: NewsItem; body: string }) {
  const [highlights, setHighlights]   = useState<Highlight[]>([]);
  const [hlLoading, setHlLoading]     = useState(false);
  const [hlError, setHlError]         = useState("");
  const [legendOpen, setLegendOpen]   = useState(true);
  const [filterCat, setFilterCat]     = useState<string | null>(null);

  useEffect(() => {
    markArticleRead(item.id);
  }, [item.id]);

  /* eslint-disable react-hooks/set-state-in-effect -- highlights fetch lifecycle */
  useEffect(() => {
    if (!body) return;
    setHlLoading(true);
    fetch("/api/article-highlights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: body, title: item.title }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.highlights) setHighlights(data.highlights);
        else setHlError("Could not load highlights.");
      })
      .catch(() => setHlError("Highlight scan failed."))
      .finally(() => setHlLoading(false));
  }, [body, item.title]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const displayHighlights = filterCat
    ? highlights.filter(h => h.category === filterCat)
    : highlights;

  const highCount = highlights.filter(h => h.severity === "high").length;

  return (
    <div style={{ minHeight: "100vh", background: "#050c07", color: "#c8e8d0", fontFamily: FONT }}>
      <div className="scanline" />
      {/* FLOATING ORACLE BANNER - always visible */}
      <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", zIndex: 50, display: "flex", alignItems: "center", gap: 0, background: "#090f0b", border: "1px solid #00bb66", borderRadius: 4, overflow: "hidden", boxShadow: "0 0 24px rgba(0,255,136,0.15)", animation: "bannerGlow 2.5s ease-in-out infinite" }}>
        <style>{`
          @keyframes bannerGlow { 0%,100%{box-shadow:0 0 16px rgba(0,255,136,0.12)} 50%{box-shadow:0 0 28px rgba(0,255,136,0.28)} }
          @keyframes bannerDot { 0%,100%{opacity:1} 50%{opacity:0.2} }
        `}</style>
        <div style={{ background: "rgba(0,255,136,0.08)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#00ff88", display: "inline-block", animation: "bannerDot 1.2s ease-in-out infinite" }} />
          <span style={{ fontFamily: "var(--font-share-tech-mono), monospace", fontSize: 10, color: "#00bb66", letterSpacing: 2 }}>ORACLE ANALYSIS READY</span>
        </div>
        <a href={`/board/${item.id}`}
          style={{ display: "block", padding: "10px 16px", background: "rgba(0,255,136,0.12)", borderLeft: "1px solid #00bb66", fontFamily: "var(--font-raj), sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, color: "#00ff88", textDecoration: "none", textTransform: "uppercase", transition: "background 0.15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,136,0.22)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,136,0.12)"; }}>
          ◈ OPEN INVESTIGATION BOARD ▶
        </a>
        <button
          onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
          style={{ padding: "10px 12px", background: "transparent", border: "none", borderLeft: "1px solid #1a3320", color: "#5a8068", fontFamily: "var(--font-share-tech-mono), monospace", fontSize: 10, cursor: "pointer", letterSpacing: 1, transition: "color 0.15s" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#00ff88"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#5a8068"; }}
          title="Scroll to analysis">
          ↓
        </button>
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>

        {/* TOP NAV */}
        <div style={{ height: 44, background: "#050c07", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
          <Link href="/" style={{ fontSize: 10, color: "#5a8068", textDecoration: "none", letterSpacing: 2, border: "1px solid #1a3320", padding: "4px 10px", borderRadius: 3 }}>
            ← FEED
          </Link>
          <div style={{ width: 1, height: 20, background: "#1a3320" }} />
          <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2 }}>THE THEORIST</div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <Link href={`/board/${item.id}`}
              style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "6px 14px", borderRadius: 3, border: "1px solid #00bb66", color: "#00ff88", textDecoration: "none" }}>
              ◈ INVESTIGATION BOARD ▶
            </Link>
            <a href={item.url} target="_blank" rel="noreferrer"
              style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", padding: "6px 14px", borderRadius: 3, border: "1px solid #1a3320", color: "#5a8068", textDecoration: "none" }}>
              ↗ ORIGINAL
            </a>
          </div>
        </div>

        <div
          style={{
            ...pageContentShellStyle({ padding: "1.75rem clamp(1rem, 3vw, 2rem) 6rem" }),
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) minmax(280px, 340px)",
            gap: "clamp(1.25rem, 3vw, 2.5rem)",
          }}
        >

          {/* MAIN ARTICLE */}
          <div>
            {/* Article header */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, color: "#5a8068", letterSpacing: 2, textTransform: "uppercase" }}>{item.section}</span>
                <span style={{ fontSize: 10, color: "#3a5040", letterSpacing: 1 }}>{timeAgo(item.date)}</span>
                <span style={{ fontSize: 11, color: scoreColor(item.score), border: `1px solid ${scoreColor(item.score)}`, padding: "1px 7px", borderRadius: 2, fontFamily: RAJ, fontWeight: 700, letterSpacing: 1 }}>
                  {item.score}% THREAT
                </span>
                {highCount > 0 && (
                  <span style={{ fontSize: 11, color: "#ff3333", border: "1px solid rgba(255,51,51,0.3)", padding: "1px 7px", borderRadius: 2, letterSpacing: 1 }}>
                    ⚠ {highCount} HIGH SEVERITY FLAG{highCount > 1 ? "S" : ""}
                  </span>
                )}
              </div>
              <h1 style={{ fontFamily: RAJ, fontSize: 30, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.28, margin: "0 0 12px" }}>{item.title}</h1>
              {item.angle && (
                <div style={{ padding: "8px 12px", borderLeft: "2px solid #1a3320", fontSize: 14, color: "#5a8068", lineHeight: 1.65 }}>
                  <span style={{ color: "#00bb66" }}>▸ </span>{item.angle}
                </div>
              )}
            </div>

            {/* Hero image */}
            {item.image && (
              <div style={{ position: "relative", height: 320, marginBottom: "1.5rem", borderRadius: 4, overflow: "hidden" }}>
                <Image src={item.image} alt="" fill unoptimized style={{ objectFit: "cover", filter: "saturate(0.4) brightness(0.65)" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 50%, #050c07)" }} />
              </div>
            )}

            {/* Highlight loading bar */}
            {hlLoading && (
              <div style={{ marginBottom: "1rem", border: "1px solid #1a3320", borderRadius: 3, background: "#090f0b", overflow: "hidden" }}>
                <div style={{ padding: "8px 12px", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", display: "inline-block", animation: "bannerDot 0.9s step-end infinite" }} />
                  <span style={{ fontSize: 10, color: "#00bb66", letterSpacing: 2 }}>SCANNING ARTICLE FOR CONSPIRACY SIGNALS...</span>
                </div>
                <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    "> Tokenizing article entities...",
                    "> Cross-referencing CIA FOIA database...",
                    "> Matching against conspiracy pattern index...",
                    "> Categorizing signals by severity...",
                  ].map((l, i) => (
                    <div key={i} style={{ fontSize: 10, color: "#3a5040", letterSpacing: 0.5, animation: `al-fadein 0.3s ease ${i * 0.4}s both` }}>{l}</div>
                  ))}
                </div>
                <style>{`@keyframes al-fadein{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}`}</style>
              </div>
            )}
            {hlError && (
              <div style={{ marginBottom: "1rem", fontSize: 10, color: "#ff3333" }}>[{hlError}]</div>
            )}

            {/* Article body with highlights */}
            {body && (
              <div style={{ marginBottom: "1.5rem" }}>
                <ArticleText text={body} highlights={displayHighlights} />
              </div>
            )}

            {/* No body: show summary + prominent source link */}
            {!body && (
              <div style={{ marginBottom: "1.5rem", display: "flex", flexDirection: "column", gap: 14 }}>
                {item.summary && (
                  <div style={{ padding: "16px 18px", border: "1px solid #1a3320", borderRadius: 4, background: "rgba(0,255,136,0.02)", fontSize: 14, color: "#9ec8ae", lineHeight: 1.75 }}>
                    <div style={{ fontSize: 11, color: "#5a8068", letterSpacing: 1.5, marginBottom: 10, textTransform: "uppercase" }}>◈ AI Summary</div>
                    {item.summary}
                  </div>
                )}
                {/* "Open original source" CTA — dominant when no body */}
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
                      padding: "16px 20px", borderRadius: 4, textDecoration: "none",
                      border: "1px solid #2a5040",
                      background: "rgba(0,255,136,0.04)",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,136,0.09)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,136,0.04)"; }}
                  >
                    <div>
                      <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 2, marginBottom: 4 }}>
                        ↗ OPEN ORIGINAL SOURCE
                      </div>
                      <div style={{ fontSize: 12, color: "#5a8068", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 480 }}>
                        {item.url}
                      </div>
                    </div>
                    <span style={{ fontSize: 20, color: "#00bb66", flexShrink: 0 }}>↗</span>
                  </a>
                )}

                {/* If article is about UAP/UFO/Pentagon files — show official document links */}
                {/uap|ufo|pentagon.files|disclosure|extraterrestrial|anomalous.phenomena/i.test(item.title + " " + (item.summary ?? "")) && (
                  <div style={{ padding: "16px 18px", border: "1px solid #1a3320", borderRadius: 4, background: "#080c09" }}>
                    <div style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: "#aac2ff", letterSpacing: 2, marginBottom: 14, textTransform: "uppercase" }}>
                      ◈ Official Declassified UAP Documents
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {[
                        { label: "AARO — All-domain Anomaly Resolution Office (DoD)", url: "https://www.aaro.mil/", note: "Latest UAP reports, historical records, and case database" },
                        { label: "Pentagon UAP Disclosure — April 2024 Report", url: "https://media.defense.gov/2024/Mar/08/2003409233/-1/-1/0/DOPSR-CLEARED-508-COMPLIANT-HRRV1-08-MAR-2024-FINAL.PDF", note: "Official DoD AARO historical record report (PDF)" },
                        { label: "FBI Vault — UFO / Project Blue Book", url: "https://vault.fbi.gov/UFO", note: "Declassified FBI files on UAP incidents" },
                        { label: "CIA FOIA — UFO Records", url: "https://www.cia.gov/readingroom/collection/ufos-fact-or-fiction", note: "CIA reading room — UFOs: Fact or Fiction collection" },
                        { label: "NARA — Project Blue Book (1947–1969)", url: "https://www.archives.gov/research/military/air-force/ufos", note: "National Archives — complete Air Force UAP investigation files" },
                        { label: "Office of the DNI — UAP Report 2021", url: "https://www.dni.gov/files/ODNI/documents/assessments/Prelimary-Assessment-UAP-20210625.pdf", note: "Preliminary Assessment: Unidentified Aerial Phenomena (PDF)" },
                      ].map((doc) => (
                        <a
                          key={doc.url}
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: "flex", flexDirection: "column", gap: 3, padding: "10px 12px", border: "1px solid #1a2a3a", borderRadius: 3, textDecoration: "none", background: "rgba(170,194,255,0.03)", transition: "border-color 0.15s" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#4a6aaa"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = "#1a2a3a"; }}
                        >
                          <span style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#aac2ff" }}>{doc.label} ↗</span>
                          <span style={{ fontSize: 12, color: "#5a7a9a" }}>{doc.note}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* CTA to investigation board */}
            <Link href={`/board/${item.id}`}
              style={{ display: "block", padding: "14px", border: "1px solid #00bb66", borderRadius: 4, textAlign: "center", textDecoration: "none", background: "rgba(0,255,136,0.04)", transition: "all 0.15s" }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,136,0.08)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,136,0.04)"; }}>
              <div style={{ fontFamily: RAJ, fontSize: 14, fontWeight: 700, color: "#00ff88", letterSpacing: 3, marginBottom: 4 }}>◈ OPEN INVESTIGATION BOARD ▶</div>
              <div style={{ fontSize: 10, color: "#5a8068", letterSpacing: 1 }}>AI-generated node graph · CIA FOIA · USPTO patents · conspiracy theories</div>
            </Link>
          </div>

          {/* SIDEBAR: Highlight legend + list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Legend */}
            <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", overflow: "hidden" }}>
              <div
                onClick={() => setLegendOpen(o => !o)}
                style={{ padding: "10px 12px", borderBottom: legendOpen ? "1px solid #1a3320" : "none", display: "flex", justifyContent: "space-between", cursor: "pointer" }}>
                <div style={{ fontFamily: FONT, fontSize: 10, color: "#00bb66", letterSpacing: 2 }}>◈ SIGNAL LEGEND</div>
                <span style={{ color: "#5a8068", fontSize: 11 }}>{legendOpen ? "▲" : "▼"}</span>
              </div>
              {legendOpen && (
                <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {Object.entries(CATEGORY_LABELS).map(([cat, label]) => {
                    const c = CATEGORY_COLORS[cat];
                    const count = highlights.filter(h => h.category === cat).length;
                    if (count === 0) return null;
                    return (
                      <div
                        key={cat}
                        onClick={() => setFilterCat(f => f === cat ? null : cat)}
                        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: filterCat && filterCat !== cat ? 0.35 : 1, transition: "opacity 0.15s" }}>
                        <span style={{ width: 8, height: 8, borderRadius: 1, background: c.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: "#5a8068", flex: 1, letterSpacing: 0.5 }}>{label}</span>
                        <span style={{ fontSize: 11, color: c.text, fontFamily: RAJ, fontWeight: 700 }}>{count}</span>
                      </div>
                    );
                  })}
                  {filterCat && (
                    <button onClick={() => setFilterCat(null)} style={{ marginTop: 4, background: "transparent", border: "1px solid #1a3320", color: "#5a8068", fontFamily: FONT, fontSize: 9, padding: "4px", borderRadius: 2, cursor: "pointer", letterSpacing: 1 }}>
                      CLEAR FILTER
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* POLYMARKET — after legend (matches desktop layout bundle) */}
            <PolymarketWidget query={item.title} context={buildArticlePolymarketContext(item, body, highlights)} />

            {/* Flags list */}
            {highlights.length > 0 && (
              <div style={{ border: "1px solid #1a3320", borderRadius: 4, background: "#090f0b", overflow: "hidden" }}>
                <div style={{ padding: "10px 12px", borderBottom: "1px solid #1a3320" }}>
                  <div style={{ fontFamily: FONT, fontSize: 10, color: "#ff3333", letterSpacing: 2 }}>⚠ FLAGGED SIGNALS ({displayHighlights.length})</div>
                </div>
                <div style={{ maxHeight: 420, overflowY: "auto" }}>
                  {displayHighlights.map((h, i) => {
                    const c = CATEGORY_COLORS[h.category] ?? CATEGORY_COLORS.agency;
                    return (
                      <div key={i} style={{ padding: "9px 12px", borderBottom: "1px solid #0d1a10" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: c.text }}>{h.text}</span>
                          <span style={{ fontSize: 8, color: c.dot, border: `1px solid ${c.border}`, padding: "1px 5px", borderRadius: 2, letterSpacing: 1, flexShrink: 0, marginLeft: 4 }}>
                            {h.severity.toUpperCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: "#5a8068", letterSpacing: 1, marginBottom: 4 }}>
                          {CATEGORY_LABELS[h.category] ?? h.category}
                        </div>
                        <div style={{ fontFamily: FONT, fontSize: 12, color: "#7a9a8a", lineHeight: 1.55 }}>{h.note}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {hlLoading && (
              <div style={{ border: "1px solid #1a3320", borderRadius: 4, padding: "12px", background: "#090f0b", textAlign: "center" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88", margin: "0 auto 8px", animation: "bannerDot 0.9s step-end infinite" }} />
                <div style={{ fontSize: 9, color: "#3a5040", letterSpacing: 2 }}>SCANNING SIGNALS...</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
