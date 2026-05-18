"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import Link from "next/link";
import PolymarketWidget from "@/components/PolymarketWidget";
import { combinePolymarketQuery } from "@/lib/polymarketQuery";
import type { Edge, Node, OracleAnalysis, OracleSource } from "@/types";

const FONT = "'Share Tech Mono', monospace";
const RAJ = "'Rajdhani', sans-serif";

/** Detail drawer width — synced via --ib-panel-w on .ib-root */
const IB_PANEL_W = "clamp(400px, 40vw, 480px)";

const IB_TYPE = {
  sectionLabel: {
    fontFamily: FONT,
    fontSize: 10,
    color: "#5a8068",
    letterSpacing: 2,
    textTransform: "uppercase" as const,
    marginBottom: 6,
  },
  body: { fontFamily: FONT, fontSize: 13, color: "#c8e8d0", lineHeight: 1.8 },
  bodyMuted: { fontFamily: FONT, fontSize: 13, color: "#7aaa8a", lineHeight: 1.75 },
  bodySm: { fontFamily: FONT, fontSize: 12, color: "#7aaa8a", lineHeight: 1.65 },
  panelTitle: { fontFamily: RAJ, fontSize: 17, fontWeight: 700, letterSpacing: 1 },
  headline: { fontFamily: RAJ, fontSize: 16, fontWeight: 700, color: "#e8ffe8", lineHeight: 1.4 },
  passage: { fontFamily: FONT, fontSize: 13, color: "#c8e8d0", lineHeight: 1.8, fontStyle: "italic" as const },
  listItem: { fontSize: 12, color: "#7aaa8a", lineHeight: 1.65 },
  meta: { fontFamily: FONT, fontSize: 10 },
};

function useNarrowPanel() {
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return narrow;
}

function DetailSection({
  title,
  accent = "#5a8068",
  children,
}: {
  title: string;
  accent?: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ ...IB_TYPE.sectionLabel, color: accent, marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

/** Excluded from PNG export (with data-share-ignore). */
const EXPORT_IGNORE = "data-export-ignore";

function shouldIgnoreInExport(el: Element): boolean {
  return el.hasAttribute("data-share-ignore") || el.hasAttribute(EXPORT_IGNORE);
}

/** html2canvas misses SVG filters, low opacity text, and animations — normalize the clone. */
function tuneBoardCloneForExport(doc: Document, root: HTMLElement) {
  root.querySelectorAll("[filter]").forEach((el) => el.removeAttribute("filter"));
  root.querySelectorAll("text").forEach((el) => {
    el.setAttribute("opacity", "1");
    const fs = el.getAttribute("font-size") || el.style.fontSize;
    if (fs) {
      const n = parseFloat(fs);
      if (n > 0 && n < 12) el.setAttribute("font-size", String(Math.min(14, n + 1.5)));
    }
  });
  root.querySelectorAll("ellipse").forEach((el) => {
    const fill = el.getAttribute("fill");
    if (fill?.includes("rgba")) el.setAttribute("opacity", "0.55");
  });
  root.querySelectorAll("line, path").forEach((el) => {
    const o = el.getAttribute("stroke-opacity");
    if (o && parseFloat(o) < 0.85) el.setAttribute("stroke-opacity", "0.9");
  });
  root.querySelectorAll("*").forEach((el) => {
    if (el instanceof HTMLElement) {
      el.style.animation = "none";
      el.style.transition = "none";
    }
  });
  const hasDetailPanel = Boolean(root.querySelector(".ib-detail-panel"));
  const mainSvg = root.querySelector(".ib-main-svg");
  if (mainSvg instanceof SVGElement) {
    mainSvg.style.opacity = "1";
    mainSvg.style.width = hasDetailPanel ? "calc(100% - var(--ib-panel-w, 440px))" : "100%";
    mainSvg.style.height = "100%";
  }
  root.querySelectorAll(".ib-detail-panel").forEach((panel) => {
    if (!(panel instanceof HTMLElement)) return;
    panel.style.animation = "none";
    const scroll = panel.querySelector(".ib-detail-panel-scroll");
    if (scroll instanceof HTMLElement) {
      scroll.style.overflow = "visible";
      scroll.style.overflowY = "visible";
      scroll.style.maxHeight = "none";
      scroll.style.height = "auto";
    }
  });
  root.querySelectorAll("svg").forEach((svg) => {
    if (!svg.classList.contains("ib-main-svg")) svg.style.opacity = "0.5";
  });
  const style = doc.createElement("style");
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@600;700&family=Share+Tech+Mono&display=swap');
    .ib-main-svg text { opacity: 1 !important; fill-opacity: 1 !important; }
    .ib-main-svg rect[stroke] { stroke-opacity: 0.95 !important; }
  `;
  doc.head.appendChild(style);
}

const TYPE_LABELS: Record<string, string> = {
  article: "ARTICLE",
  patent: "PATENT",
  foia: "CIA FOIA",
  company: "COMPANY",
  event: "EVENT",
  person: "PERSON",
  theory: "CONSPIRACY HYPOTHESIS",
};

const NODE_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  article: { bg: "#0a1a10", border: "#00ff88", text: "#00ff88", glow: "rgba(0,255,136,0.3)" },
  patent: { bg: "#1a0a0a", border: "#ff3333", text: "#ff5555", glow: "rgba(255,51,51,0.25)" },
  foia: { bg: "#1a0a0a", border: "#ff3333", text: "#ff3333", glow: "rgba(255,51,51,0.35)" },
  company: { bg: "#1a1200", border: "#ffaa00", text: "#ffaa00", glow: "rgba(255,170,0,0.25)" },
  event: { bg: "#1a1200", border: "#ffaa00", text: "#ffcc44", glow: "rgba(255,170,0,0.2)" },
  person: { bg: "#071510", border: "#00bb66", text: "#00bb66", glow: "rgba(0,187,102,0.2)" },
  theory: { bg: "#140818", border: "#c94dff", text: "#e9b3ff", glow: "rgba(201,77,255,0.3)" },
};

const FALLBACK_COLOR = { bg: "#0a1a10", border: "#00ff88", text: "#00ff88", glow: "rgba(0,255,136,0.3)" };

type Props = {
  nodes: Node[];
  edges: Edge[];
  onNodeClick: (node: Node | null) => void;
  selectedNode: Node | null;
  conclusion?: string;
  verdict?: OracleAnalysis["verdict"];
  analysisSources?: OracleSource[];
  /** Article headline for Polymarket relevance search */
  articleTitle?: string;
  /** Summary, body snippet, Oracle text — improves keyword match vs title-only */
  polymarketContext?: string;
  /** If set, renders a back-link in the header bar (e.g. "/article/123") */
  backHref?: string;
  /** Label for the back-link; defaults to "← BACK" */
  backLabel?: string;
};

function formatVerdictShort(v: OracleAnalysis["verdict"] | undefined): string {
  if (!v) return "—";
  const s = String(v).toUpperCase();
  const map: Record<string, string> = {
    TRUE: "TRUE",
    PARTIALLY_TRUE: "PARTIALLY TRUE",
    QUESTIONABLE: "QUESTIONABLE",
    DISINFORMATION: "DISINFORMATION",
    VALÓS: "TRUE",
    "RÉSZBEN VALÓS": "PARTIALLY TRUE",
    MEGKÉRDŐJELEZHETŐ: "QUESTIONABLE",
    "TERJESZTETT DEZINFO": "DISINFORMATION",
  };
  return map[s] ?? s.replace(/_/g, " ");
}

function isLikelyUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim());
}

function EdgeLine({ edge, nodes, active }: { edge: Edge; nodes: Node[]; active: boolean }) {
  const from = nodes.find((n) => n.id === edge.from);
  const to = nodes.find((n) => n.id === edge.to);
  if (!from || !to) return null;
  const opacity = active ? 1 : 0.35;
  const strokeW = active ? 2 : 1;
  return (
    <g>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={edge.color} strokeWidth={strokeW} strokeOpacity={opacity * 0.4} />
      <line
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        stroke={edge.color}
        strokeWidth={active ? 1.5 : 1}
        strokeOpacity={opacity}
        strokeDasharray="6 14"
        style={{ animation: `dashMove ${2 / Math.max(edge.strength || 0.4, 0.2)}s linear infinite` }}
      />
    </g>
  );
}

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

/** Compact Polymarket block for the node detail drawer (selected node + article context). */
function PolymarketInline({
  articleTitle,
  articleContext,
  nodeLabel,
  nodeDetailTitle,
}: {
  articleTitle?: string;
  articleContext?: string;
  nodeLabel: string;
  nodeDetailTitle: string;
}) {
  const q = useMemo(() => {
    if (!articleTitle?.trim()) return "";
    const ctx = [articleContext, nodeLabel, nodeDetailTitle].filter(Boolean).join(" · ");
    return combinePolymarketQuery(articleTitle, ctx);
  }, [articleTitle, articleContext, nodeLabel, nodeDetailTitle]);

  if (!q) return null;
  return <PolymarketInlineFetch key={q} q={q} />;
}

function PolymarketInlineFetch({ q }: { q: string }) {
  const [markets, setMarkets] = useState<
    Array<{ id: string; question: string; yesPrice: number; noPrice: number; volume: number; url: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/polymarket?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        const list = d.markets ?? [];
        setMarkets(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [q]);

  if (loading || !markets.length) return null;

  return (
    <div style={{ border: "1px solid rgba(201,77,255,0.25)", borderRadius: 3, overflow: "hidden", marginTop: 14 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          padding: "7px 10px",
          background: "rgba(20,8,28,0.6)",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ width: 6, height: 6, marginTop: 2, borderRadius: "50%", background: "#c94dff", display: "inline-block", flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontFamily: FONT, fontSize: 9, color: "#c94dff", letterSpacing: 2 }}>
            POLYMARKET — {markets.length} BET{markets.length > 1 ? "S" : ""}
          </span>
          {!open && (
            <span style={{ fontFamily: FONT, fontSize: 8, color: "#5a8068", letterSpacing: 1, opacity: 0.92 }}>
              Click to expand
            </span>
          )}
        </span>
        <span style={{ fontSize: 9, color: "#5a8068", flexShrink: 0 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid rgba(201,77,255,0.15)" }}>
          {markets.slice(0, 3).map((m) => (
            <div key={m.id} style={{ padding: "8px 10px", borderBottom: "1px solid rgba(201,77,255,0.1)" }}>
              <div style={{ fontFamily: RAJ, fontSize: 11, fontWeight: 700, color: "#e9b3ff", lineHeight: 1.3, marginBottom: 6 }}>
                {m.question.slice(0, 60)}
                {m.question.length > 60 ? "…" : ""}
              </div>
              <div style={{ display: "flex", height: 3, borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ width: `${m.yesPrice}%`, background: "#00bb66" }} />
                <div style={{ width: `${m.noPrice}%`, background: "#ff3333" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#00ff88" }}>{m.yesPrice}¢ YES</span>
                  <span style={{ fontFamily: RAJ, fontSize: 13, fontWeight: 700, color: "#ff3333" }}>{m.noPrice}¢ NO</span>
                </div>
                <a
                  href={m.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 9,
                    color: "#c94dff",
                    border: "1px solid rgba(201,77,255,0.3)",
                    padding: "2px 8px",
                    borderRadius: 2,
                    textDecoration: "none",
                    letterSpacing: 1,
                  }}
                >
                  BET ↗
                </a>
              </div>
            </div>
          ))}
          <div style={{ padding: "5px 10px", fontSize: 8, color: "#3a3040", letterSpacing: 1, textAlign: "center" }}>
            Prediction market · Not financial advice
          </div>
        </div>
      )}
    </div>
  );
}

function GraphNode({ node, onClick, selected, pulse }: { node: Node; onClick: (node: Node) => void; selected: boolean; pulse: boolean }) {
  const c = NODE_COLORS[node.type] ?? FALLBACK_COLOR;
  const isCenter = node.id === "center";
  const isTheory = node.type === "theory";

  // Dynamic width based on label length
  const labelLen = (node.label || "").length;
  const w = isCenter ? 140 : isTheory ? 148 : Math.max(110, Math.min(148, labelLen * 7.5));
  const h = isCenter ? 64 : isTheory ? 62 : 54;

  // Truncate labels to fit box
  const maxLabelChars = Math.floor(w / 6.5);
  const displayLabel = truncate(node.label || "", maxLabelChars);

  // Sub text — max 2 lines, truncated
  const subLines = (node.sub || "").split("\n").slice(0, 2).map(l => truncate(l, Math.floor(w / 5.5)));

  return (
    <g transform={`translate(${node.x}, ${node.y})`} onClick={() => onClick(node)} style={{ cursor: "pointer" }}>
      <ellipse cx={0} cy={0} rx={w * 0.6} ry={h * 0.7} fill={c.glow} style={{ animation: selected || (isCenter && pulse) ? "glowPulse 1.5s ease-in-out infinite" : "none" }} filter="blur(8px)" />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} ry={4} fill={c.bg} stroke={c.border} strokeWidth={selected ? 2 : isCenter ? 1.5 : 1} strokeOpacity={selected ? 1 : 0.7} />
      {[[-w / 2, -h / 2, 1], [-w / 2 + 10, -h / 2, 1], [w / 2, -h / 2, -1], [w / 2 - 10, -h / 2, -1]].map(([x, y, dx], i) => (
        <line key={i} x1={Number(x)} y1={Number(y)} x2={Number(x) + Number(dx) * 8} y2={Number(y)} stroke={c.border} strokeWidth={1.5} strokeOpacity={0.5} />
      ))}
      <text x={0} y={-h / 2 + 11} textAnchor="middle" fill={c.text} opacity={0.55} style={{ fontFamily: FONT, fontSize: 8, letterSpacing: 1.5 }}>
        {TYPE_LABELS[node.type] ?? "NODE"}
      </text>
      <text x={0} y={isCenter ? 3 : 1} textAnchor="middle" fill={c.text} style={{ fontFamily: RAJ, fontSize: isCenter ? 13 : isTheory ? 11 : 11, fontWeight: 700, letterSpacing: 0.5 }}>
        {displayLabel}
      </text>
      {subLines.map((line, i) => (
        <text key={i} x={0} y={(isCenter ? 15 : 13) + i * 11} textAnchor="middle" fill={c.text} opacity={0.5} style={{ fontFamily: FONT, fontSize: 8 }}>
          {line}
        </text>
      ))}
      {selected && <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={4} ry={4} fill="none" stroke={c.border} strokeWidth={3} strokeOpacity={0.4} style={{ animation: "glowPulse 1s ease-in-out infinite" }} />}
    </g>
  );
}

function FullAnalysisModal({ node, onClose }: { node: Node; onClose: () => void }) {
  const c = NODE_COLORS[node.type] ?? FALLBACK_COLOR;
  const d = node.detail;
  const isTheory = node.type === "theory";

  return (
    <div className="ib-node-modal-backdrop" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200, background: "rgba(3,8,6,0.95)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}>
      <div className="ib-node-modal-panel modal-panel" onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 680, maxHeight: "88vh", overflowY: "auto", background: "#080f09", border: `1px solid ${c.border}`, borderRadius: 4 }}>

        {/* Header */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid #1a3320", background: "#050c07", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 1 }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 9, color: c.text, opacity: 0.6, letterSpacing: 3, marginBottom: 3 }}>{TYPE_LABELS[node.type] ?? "NODE"} · FULL ANALYSIS</div>
            <div style={{ fontFamily: RAJ, fontSize: 15, fontWeight: 700, color: c.text, letterSpacing: 1 }}>{d.title || node.label}</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid #1a3320", color: "#5a8068", fontFamily: FONT, fontSize: 10, padding: "4px 10px", borderRadius: 3, cursor: "pointer", letterSpacing: 1 }}>✕ CLOSE</button>
        </div>

        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Score */}
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 4 }}>{isTheory ? "PLAUSIBILITY" : "THREAT LEVEL"}</div>
              <div style={{ fontFamily: RAJ, fontSize: 44, fontWeight: 700, color: (d.threat ?? 0) >= 65 ? "#ff3333" : (d.threat ?? 0) >= 35 ? "#ffaa00" : "#00bb66", lineHeight: 1 }}>{d.threat ?? d.confidence ?? 0}%</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 5, background: "#1a3320", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", width: `${d.threat ?? d.confidence ?? 0}%`, background: (d.threat ?? 0) >= 65 ? "#ff3333" : (d.threat ?? 0) >= 35 ? "#ffaa00" : "#00bb66", borderRadius: 3 }} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {d.source_tier && <span style={{ fontSize: 9, border: "1px solid #1a3320", padding: "2px 7px", borderRadius: 2, color: "#5a8068" }}>Tier {d.source_tier}</span>}
                {d.source_type && <span style={{ fontSize: 9, border: "1px solid #1a3320", padding: "2px 7px", borderRadius: 2, color: "#5a8068", textTransform: "uppercase" }}>{d.source_type}</span>}
              </div>
            </div>
          </div>

          {/* Body */}
          {d.body && (
            <div>
              <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>{isTheory ? "Full Theory Explanation" : "Detail"}</div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: "#c8e8d0", lineHeight: 1.85 }}>{d.body}</div>
            </div>
          )}

          {/* Why it matters */}
          {d.why_it_matters && (
            <div style={{ padding: "10px 12px", background: "rgba(0,255,136,0.03)", border: "1px solid #1a3320", borderRadius: 3 }}>
              <div style={{ fontFamily: FONT, fontSize: 9, color: "#00bb66", letterSpacing: 2, marginBottom: 5 }}>WHY IT MATTERS</div>
              <div style={{ fontFamily: FONT, fontSize: 11, color: "#7aaa8a", lineHeight: 1.7 }}>{d.why_it_matters}</div>
            </div>
          )}

          {/* Key claims */}
          {d.key_claims && d.key_claims.length > 0 && (
            <div>
              <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>{isTheory ? "Evidence cited by theorists" : "Key Claims"}</div>
              {d.key_claims.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 8, color: "#7aaa8a", fontSize: 11, marginBottom: 7, lineHeight: 1.65, alignItems: "flex-start" }}>
                  <span style={{ color: isTheory ? "#c94dff" : "#00bb66", flexShrink: 0 }}>▸</span><span>{item}</span>
                </div>
              ))}
            </div>
          )}

          {/* Counter evidence */}
          {d.counter_evidence && d.counter_evidence.length > 0 && (
            <div>
              <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>Counter Evidence</div>
              {d.counter_evidence.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 8, color: "#5a6a5a", fontSize: 11, marginBottom: 6, lineHeight: 1.65, alignItems: "flex-start" }}>
                  <span style={{ color: "#ffaa00", flexShrink: 0 }}>◻</span><span>{item}</span>
                </div>
              ))}
            </div>
          )}

          {/* Uncertainties */}
          {d.uncertainties && d.uncertainties.length > 0 && (
            <div>
              <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>Uncertainties</div>
              {d.uncertainties.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 8, color: "#5a6060", fontSize: 11, marginBottom: 6, lineHeight: 1.65, alignItems: "flex-start" }}>
                  <span style={{ color: "#ff3333", flexShrink: 0, opacity: 0.5 }}>?</span><span>{item}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actors */}
          {d.actors && d.actors.length > 0 && (
            <div>
              <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>Key Figures</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {d.actors.map((a, i) => (
                  <span key={i} style={{ fontSize: 10, padding: "3px 10px", border: `1px solid ${c.border}`, borderRadius: 2, color: c.text, background: c.bg }}>{a}</span>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {d.timeline && d.timeline.length > 0 && (
            <div>
              <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>Timeline</div>
              <div style={{ borderLeft: "1px solid #1a3320", paddingLeft: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {d.timeline.map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ fontFamily: FONT, fontSize: 10, color: c.text, opacity: 0.7, whiteSpace: "nowrap", minWidth: 90 }}>{item.date}</span>
                    <span style={{ fontFamily: FONT, fontSize: 11, color: "#7aaa8a", lineHeight: 1.55 }}>{item.event}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Open questions */}
          {d.open_questions && d.open_questions.length > 0 && (
            <div>
              <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>Open Questions</div>
              {d.open_questions.map((q, i) => (
                <div key={i} style={{ display: "flex", gap: 8, color: "#5a6a7a", fontSize: 11, marginBottom: 6, lineHeight: 1.65 }}>
                  <span style={{ color: "#5a8068", flexShrink: 0 }}>?</span><span>{q}</span>
                </div>
              ))}
            </div>
          )}

          {!isTheory && d.excerpt && (
            <div style={{ border: "1px solid #1a3320", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
              <div style={{ padding: "10px 12px", background: "rgba(0,255,136,0.02)", borderBottom: "1px solid #1a3320" }}>
                <div style={{ ...IB_TYPE.sectionLabel, color: "#00bb66", marginBottom: 8 }}>◈ KEY PASSAGE</div>
                <blockquote style={{ margin: 0, padding: "0 0 0 12px", borderLeft: "2px solid #1a4a2a" }}>
                  <div style={{ fontFamily: FONT, fontSize: 11, color: "#c8e8d0", lineHeight: 1.8, fontStyle: "italic" }}>
                    &ldquo;{d.excerpt}&rdquo;
                  </div>
                </blockquote>
                <div style={{ marginTop: 6, fontSize: 9, color: "#5a8068" }}>— {d.source}</div>
              </div>
              {d.source_url && (
                <a
                  href={d.source_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "flex", gap: 8, color: "#00bb66", fontSize: 10, textDecoration: "none", padding: "7px 12px" }}
                >
                  <span>↗</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.source_url}</span>
                </a>
              )}
            </div>
          )}

          {((d.theory_sources && d.theory_sources.length > 0) || d.source_url) && (
            <div>
              <div style={{ fontFamily: FONT, fontSize: 9, color: isTheory ? "#c94dff" : "#00bb66", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>
                {isTheory ? "Sources & Documentation" : "Primary Source"}
              </div>
              {d.source_url && !d.excerpt && (
                <a
                  href={d.source_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    gap: 8,
                    color: "#00bb66",
                    fontSize: 11,
                    textDecoration: "none",
                    marginBottom: 6,
                    padding: "6px 10px",
                    border: "1px solid rgba(0,187,102,0.2)",
                    borderRadius: 3,
                    background: "rgba(0,187,102,0.04)",
                    wordBreak: "break-all",
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ flexShrink: 0 }}>↗</span>
                  <span>
                    {d.source} — {d.source_url}
                  </span>
                </a>
              )}
              {d.theory_sources?.filter((s: string) => /^https?:\/\//i.test(s)).map((s: string, i: number) => (
                <a
                  key={i}
                  href={s}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    gap: 8,
                    color: "#00bb66",
                    fontSize: 11,
                    textDecoration: "none",
                    marginBottom: 6,
                    padding: "6px 10px",
                    border: "1px solid rgba(0,187,102,0.2)",
                    borderRadius: 3,
                    background: "rgba(0,187,102,0.04)",
                    wordBreak: "break-all",
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ flexShrink: 0 }}>↗</span>
                  <span>{s}</span>
                </a>
              ))}
              {d.theory_sources?.filter((s: string) => !/^https?:\/\//i.test(s)).map((s: string, i: number) => (
                <div key={i} style={{ fontSize: 10, color: "#5a8068", marginBottom: 4, paddingLeft: 4 }}>
                  ⟨{i + 1}⟩ {s}
                </div>
              ))}
            </div>
          )}

          {!isTheory && !d.source_url && d.source && (
            <div style={{ padding: "8px 12px", background: "rgba(0,255,136,0.03)", border: "1px solid #1a3320", borderRadius: 3 }}>
              <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 3 }}>SOURCE</div>
              <div style={{ fontFamily: FONT, fontSize: 11, color: c.text }}>{d.source}</div>
            </div>
          )}

          {/* Brave-enriched search results — visible on ALL node types */}
          {d.brave_sources && d.brave_sources.length > 0 && (
            <div style={{ paddingTop: 14, borderTop: "1px solid #1a3320" }}>
              <div style={{ fontFamily: FONT, fontSize: 9, color: "#4ab8e0", letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>
                ⬡ Web Intelligence · {d.brave_sources.length} Sources
              </div>
              {(d.brave_sources as { title: string; url: string; description: string }[]).map((src, i) => {
                let domain = "";
                try { domain = new URL(src.url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
                return (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: "block", marginBottom: 8, padding: "9px 11px", border: "1px solid rgba(74,184,224,0.2)", borderRadius: 4, background: "rgba(74,184,224,0.03)", textDecoration: "none" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                      <span style={{ color: "#4ab8e0", fontSize: 10, flexShrink: 0 }}>↗</span>
                      <span style={{ fontFamily: FONT, fontSize: 11, color: "#7ad4f0", fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{src.title}</span>
                    </div>
                    {src.description ? (
                      <div style={{ fontFamily: FONT, fontSize: 10, color: "#5a8a9a", lineHeight: 1.5, marginBottom: 3, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{src.description}</div>
                    ) : null}
                    {domain ? <div style={{ fontFamily: FONT, fontSize: 9, color: "#3a6878", letterSpacing: 1 }}>{domain}</div> : null}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailPanel({
  node,
  edges,
  onClose,
  analysisSources,
  polymarketArticleTitle,
  polymarketArticleContext,
  overlay = false,
}: {
  node: Node | null;
  edges: Edge[];
  onClose: () => void;
  analysisSources?: OracleSource[];
  polymarketArticleTitle?: string;
  polymarketArticleContext?: string;
  overlay?: boolean;
}) {
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  if (!node) return null;
  const c = NODE_COLORS[node.type] ?? FALLBACK_COLOR;
  const d = node.detail;

  return (
    <>
    <div
      className={`ib-detail-panel${overlay ? " ib-detail-overlay" : ""}`}
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: "var(--ib-panel-w)",
        background: "#06110a",
        borderLeft: `1px solid ${c.border}`,
        display: "flex",
        flexDirection: "column",
        animation: "slideIn 0.25s ease",
        zIndex: 30,
        boxShadow: "-8px 0 32px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid #1a3320",
          background: "#050c07",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontFamily: FONT, fontSize: 10, color: c.text, letterSpacing: 3, opacity: 0.7 }}>{TYPE_LABELS[node.type] ?? "NODE"}</div>
          <div style={{ ...IB_TYPE.panelTitle, color: c.text, marginTop: 3 }}>{node.label}</div>
        </div>
        <button type="button" data-export-ignore onClick={onClose} style={{ background: "transparent", border: "1px solid #1a3320", color: "#5a8068", fontFamily: FONT, fontSize: 11, padding: "4px 10px", borderRadius: 3, cursor: "pointer", letterSpacing: 1 }}>
          ✕
        </button>
      </div>

      <div className="ib-detail-panel-scroll" style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
        {node.type === "theory" ? (
          <div style={{ marginBottom: 12 }}>
            {/* Theory header badge */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ padding: "3px 10px", background: "rgba(201,77,255,0.12)", border: "1px solid rgba(201,77,255,0.4)", borderRadius: 2, fontSize: 9, color: "#c94dff", letterSpacing: 2, fontFamily: FONT, textTransform: "uppercase" }}>
                ◈ KNOWN CONSPIRACY THEORY
              </div>
            </div>

            {/* Full explanation */}
            <div style={{ ...IB_TYPE.body, marginBottom: 14 }}>
              {d.body}
            </div>

            {/* Key people */}
            {d.actors && d.actors.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: FONT, fontSize: 9, color: "#c94dff", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>Key figures</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {d.actors.map((a: string, i: number) => (
                    <span key={i} style={{ fontSize: 10, padding: "2px 8px", border: "1px solid rgba(201,77,255,0.3)", borderRadius: 2, color: "#e9b3ff", background: "rgba(201,77,255,0.06)" }}>{a}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Evidence points */}
            {node.type !== "theory" && d.key_claims && d.key_claims.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>Evidence cited by theorists</div>
                {d.key_claims.map((item: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 7, color: "#7aaa8a", fontSize: 11, marginBottom: 6, lineHeight: 1.6, alignItems: "flex-start" }}>
                    <span style={{ color: "#c94dff", flexShrink: 0 }}>▸</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Counter evidence */}
            {node.type !== "theory" && d.counter_evidence && d.counter_evidence.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>Mainstream counter-arguments</div>
                {d.counter_evidence.map((item: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 7, color: "#5a8068", fontSize: 11, marginBottom: 5, lineHeight: 1.6, alignItems: "flex-start" }}>
                    <span style={{ color: "#ffaa00", flexShrink: 0 }}>◻</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Timeline */}
            {node.type !== "theory" && d.timeline && d.timeline.length > 0 ? (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 6, textTransform: "uppercase" }}>Theory timeline</div>
                {d.timeline.map((item: { date: string; event: string }, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 8, fontSize: 10, marginBottom: 5, alignItems: "flex-start" }}>
                    <span style={{ color: "#c94dff", whiteSpace: "nowrap", flexShrink: 0, fontFamily: FONT }}>{item.date}</span>
                    <span style={{ color: "#7aaa8a", lineHeight: 1.5 }}>{item.event}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Sources — Brave-enriched cards or fallback plain URLs */}
            {(Boolean(d.brave_sources?.length) || Boolean(d.theory_sources?.length)) ? (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontFamily: FONT, fontSize: 10, color: "#c94dff", letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>Sources & documentation</div>
                {d.brave_sources && d.brave_sources.length > 0 ? (
                  // Rich Brave-enriched cards
                  (d.brave_sources as { title: string; url: string; description: string }[]).map((src, i) => {
                    let domain = "";
                    try { domain = new URL(src.url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
                    return (
                      <a
                        key={i}
                        href={src.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: "block",
                          marginBottom: 7,
                          padding: "7px 10px",
                          border: "1px solid rgba(0,187,102,0.25)",
                          borderRadius: 4,
                          background: "rgba(0,187,102,0.04)",
                          textDecoration: "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                          <span style={{ color: "#00ff88", fontSize: 10, flexShrink: 0 }}>↗</span>
                          <span style={{ fontFamily: FONT, fontSize: 11, color: "#00cc77", fontWeight: 600, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
                            {src.title}
                          </span>
                        </div>
                        {src.description ? (
                          <div style={{ fontFamily: FONT, fontSize: 10, color: "#7aaa8a", lineHeight: 1.5, marginBottom: 3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {src.description}
                          </div>
                        ) : null}
                        {domain ? (
                          <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 1 }}>{domain}</div>
                        ) : null}
                      </a>
                    );
                  })
                ) : (
                  // Fallback: plain URL list
                  (d.theory_sources as string[]).filter((s: string) => isLikelyUrl(s)).map((item: string, i: number) => {
                    let domain = "";
                    try { domain = new URL(item.trim()).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
                    return (
                      <a
                        key={i}
                        href={item.trim()}
                        target="_blank"
                        rel="noreferrer"
                        style={{ display: "flex", gap: 7, color: "#00bb66", fontSize: 11, textDecoration: "none", lineHeight: 1.5, wordBreak: "break-all", padding: "6px 8px", border: "1px solid rgba(0,187,102,0.2)", borderRadius: 3, background: "rgba(0,187,102,0.04)", marginBottom: 6 }}
                      >
                        <span style={{ flexShrink: 0, color: "#00ff88" }}>↗</span>
                        <span>{domain || item}</span>
                      </a>
                    );
                  })
                )}
              </div>
            ) : null}

            {/* Disclaimer */}
            <div style={{ padding: "7px 9px", background: "rgba(201,77,255,0.05)", border: "1px solid rgba(201,77,255,0.2)", borderRadius: 3, fontSize: 9, color: "#7a5a88", lineHeight: 1.5, fontFamily: FONT }}>
              This is a documented conspiracy theory — cross-check all claims independently.
            </div>
          </div>
        ) : null}

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 5, textTransform: "uppercase" }}>
            {node.type === "theory" ? "Plausibility (model)" : "Threat level"}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontFamily: RAJ, fontSize: 28, fontWeight: 700, color: d.threat >= 65 ? "#ff3333" : d.threat >= 45 ? "#ffaa00" : "#00bb66" }}>{d.threat}%</div>
            <div style={{ flex: 1, height: 3, background: "#1a3320", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${d.threat}%`, background: d.threat >= 65 ? "#ff3333" : d.threat >= 45 ? "#ffaa00" : "#00bb66", borderRadius: 2 }} />
            </div>
          </div>
        </div>

        {node.type !== "theory" ? (
          <>
            <div style={{ ...IB_TYPE.headline, marginBottom: 10 }}>{d.title}</div>
            <div style={{ ...IB_TYPE.bodyMuted, marginBottom: 12 }}>{d.body}</div>

            <div style={{ border: "1px solid #1a3320", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
              <div
                style={{
                  padding: "6px 10px",
                  background: "rgba(0,255,136,0.03)",
                  borderBottom: d.excerpt ? "1px solid #1a3320" : "none",
                  display: "flex",
                  gap: 8,
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 3 }}>SOURCE</div>
                  <div style={{ fontFamily: FONT, fontSize: 10, color: c.text }}>{d.source}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end", flexShrink: 0 }}>
                  {d.source_tier ? (
                    <span
                      style={{
                        fontSize: 8,
                        border: "1px solid #1a3320",
                        padding: "1px 5px",
                        borderRadius: 2,
                        color: d.source_tier === "A" ? "#00ff88" : d.source_tier === "B" ? "#ffaa00" : "#5a8068",
                        letterSpacing: 1,
                      }}
                    >
                      TIER {d.source_tier}
                    </span>
                  ) : null}
                  {d.source_type ? (
                    <span
                      style={{
                        fontSize: 8,
                        border: "1px solid #1a3320",
                        padding: "1px 5px",
                        borderRadius: 2,
                        color: "#5a8068",
                        textTransform: "uppercase",
                        letterSpacing: 1,
                      }}
                    >
                      {d.source_type}
                    </span>
                  ) : null}
                </div>
              </div>
              {d.excerpt ? (
                <div style={{ padding: "10px 12px", background: "rgba(0,255,136,0.02)", borderBottom: d.source_url ? "1px solid #1a3320" : "none" }}>
                  <div style={{ ...IB_TYPE.sectionLabel, color: "#00bb66", marginBottom: 8 }}>◈ KEY PASSAGE</div>
                  <blockquote style={{ margin: 0, padding: "0 0 0 10px", borderLeft: "2px solid #1a4a2a" }}>
                    <div style={{ ...IB_TYPE.passage }}>
                      &ldquo;{d.excerpt}&rdquo;
                    </div>
                  </blockquote>
                </div>
              ) : null}
              {d.source_url ? (
                <a
                  href={d.source_url}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 10px",
                    color: "#00bb66",
                    fontSize: 10,
                    textDecoration: "none",
                    background: "transparent",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = "rgba(0,255,136,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
                  }}
                >
                  <span style={{ flexShrink: 0 }}>↗</span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.source_url}</span>
                </a>
              ) : null}
            </div>

            {d.why_it_matters ? (
              <DetailSection title="Why it matters" accent="#00bb66">
                <div style={IB_TYPE.bodyMuted}>{d.why_it_matters}</div>
              </DetailSection>
            ) : null}
          </>
        ) : null}

        {node.type !== "theory" && d.brave_sources && (d.brave_sources as { title: string; url: string; description: string }[]).length > 0 ? (
          <DetailSection
            title={`Web Intelligence · ${(d.brave_sources as { title: string; url: string; description: string }[]).length} sources`}
            accent="#4ab8e0"
          >
            {(d.brave_sources as { title: string; url: string; description: string }[]).slice(0, 8).map((src, i) => {
              let domain = "";
              try { domain = new URL(src.url).hostname.replace(/^www\./, ""); } catch { /* ignore */ }
              return (
                <a
                  key={`bsrc-${i}`}
                  href={src.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ display: "block", marginBottom: 7, padding: "8px 11px", border: "1px solid rgba(74,184,224,0.22)", borderRadius: 4, background: "rgba(74,184,224,0.03)", textDecoration: "none" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                    <span style={{ color: "#4ab8e0", fontSize: 11, flexShrink: 0 }}>↗</span>
                    <span style={{ fontFamily: FONT, fontSize: 12, color: "#7ad4f0", fontWeight: 600, lineHeight: 1.4 }}>{src.title}</span>
                  </div>
                  {src.description ? (
                    <div style={{ ...IB_TYPE.bodySm, color: "#5a8a9a", marginBottom: 3 }}>{src.description}</div>
                  ) : null}
                  {domain ? <div style={{ ...IB_TYPE.meta, color: "#3a6878", letterSpacing: 1 }}>{domain}</div> : null}
                </a>
              );
            })}
          </DetailSection>
        ) : (node.type !== "theory" && d.theory_sources && (d.theory_sources as string[]).length > 0) ? (
          <DetailSection title="Theory citations" accent="#c94dff">
            {(d.theory_sources as string[]).filter((s: string) => isLikelyUrl(s)).slice(0, 12).map((item: string, i: number) => (
              <div key={`tsrc-${i}`} style={{ display: "flex", gap: 7, ...IB_TYPE.listItem, marginBottom: 6, wordBreak: "break-word" }}>
                <span style={{ color: "#e9b3ff", flexShrink: 0 }}>⟨{i + 1}⟩</span>
                <a href={item.trim()} target="_blank" rel="noreferrer" style={{ color: "#00bb66", textDecoration: "none", flex: 1 }}>{item}</a>
              </div>
            ))}
          </DetailSection>
        ) : null}

        {node.type !== "theory" && d.key_claims && d.key_claims.length > 0 ? (
          <DetailSection title="Key claims">
            {d.key_claims.slice(0, 6).map((item, i) => (
              <div key={`claim-${i}`} style={{ display: "flex", gap: 7, ...IB_TYPE.listItem, marginBottom: 6, alignItems: "flex-start" }}>
                <span style={{ color: "#00bb66", flexShrink: 0 }}>▸</span>
                <span>{item}</span>
              </div>
            ))}
          </DetailSection>
        ) : null}

        {node.type !== "theory" && d.counter_evidence && d.counter_evidence.length > 0 ? (
          <DetailSection title="Counter-evidence">
            {d.counter_evidence.slice(0, 6).map((item, i) => (
              <div key={`counter-${i}`} style={{ display: "flex", gap: 7, ...IB_TYPE.listItem, marginBottom: 6, alignItems: "flex-start" }}>
                <span style={{ color: "#ffaa00", flexShrink: 0 }}>▸</span>
                <span>{item}</span>
              </div>
            ))}
          </DetailSection>
        ) : null}

        {d.uncertainties && d.uncertainties.length > 0 ? (
          <DetailSection title="Uncertainties">
            {d.uncertainties.slice(0, 6).map((item, i) => (
              <div key={`uncertain-${i}`} style={{ display: "flex", gap: 7, ...IB_TYPE.listItem, marginBottom: 6, alignItems: "flex-start" }}>
                <span style={{ color: "#ff3333", flexShrink: 0 }}>▸</span>
                <span>{item}</span>
              </div>
            ))}
          </DetailSection>
        ) : null}

        {node.type !== "theory" && d.timeline && d.timeline.length > 0 ? (
          <DetailSection title="Timeline">
            {d.timeline.slice(0, 6).map((item, i) => (
              <div key={`timeline-${i}`} style={{ display: "grid", gridTemplateColumns: "84px 1fr", gap: 8, ...IB_TYPE.listItem, marginBottom: 6 }}>
                <span style={{ color: "#5a8068", fontFamily: FONT }}>{item.date}</span>
                <span>{item.event}</span>
              </div>
            ))}
          </DetailSection>
        ) : null}

        {d.actors && d.actors.length > 0 && node.type !== "theory" ? (
          <DetailSection title="Actors">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {d.actors.slice(0, 10).map((actor, i) => (
                <span key={`actor-${i}`} style={{ fontSize: 11, border: "1px solid #1a3320", padding: "3px 8px", borderRadius: 2, color: "#7aaa8a" }}>
                  {actor}
                </span>
              ))}
            </div>
          </DetailSection>
        ) : null}

        {typeof d.confidence === "number" ? (
          <DetailSection title={`Confidence ${Math.round(d.confidence)}%`}>
            <div style={{ height: 4, background: "#1a3320", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.max(0, Math.min(100, d.confidence))}%`, background: "#00bb66", borderRadius: 2 }} />
            </div>
          </DetailSection>
        ) : null}

        {d.open_questions && d.open_questions.length > 0 ? (
          <DetailSection title="Open questions">
            {d.open_questions.slice(0, 8).map((item, i) => (
              <div key={`q-${i}`} style={{ display: "flex", gap: 7, ...IB_TYPE.listItem, marginBottom: 6 }}>
                <span style={{ color: "#00bb66" }}>?</span>
                <span>{item}</span>
              </div>
            ))}
          </DetailSection>
        ) : null}

        {node.type === "theory" && analysisSources && analysisSources.length > 0 ? (
          <DetailSection title="Corpus sources (full analysis)">
            {analysisSources.slice(0, 8).map((s) => (
              <div key={s.id ?? s.url} style={{ marginBottom: 10 }}>
                <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "#00bb66", fontSize: 12, textDecoration: "none", display: "block", lineHeight: 1.5 }}>
                  {s.title} ↗
                </a>
                <div style={{ fontSize: 10, color: "#476352", marginTop: 3 }}>
                  {s.domain} · tier {s.tier} · {s.source_type}
                </div>
              </div>
            ))}
          </DetailSection>
        ) : null}

        <DetailSection title={`Connections (${edges.filter((e) => e.from === node.id || e.to === node.id).length})`}>
          {edges
            .filter((e) => e.from === node.id || e.to === node.id)
            .map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={{ width: 22, height: 2, background: e.color, flexShrink: 0 }} />
                <div style={{ ...IB_TYPE.meta, color: "#7aaa8a", letterSpacing: 0.5, lineHeight: 1.5 }}>{e.label}</div>
              </div>
            ))}
        </DetailSection>

        <PolymarketInline
          articleTitle={polymarketArticleTitle}
          articleContext={polymarketArticleContext}
          nodeLabel={node.label}
          nodeDetailTitle={d.title}
        />
      </div>

      <div style={{ padding: "12px 14px", borderTop: "1px solid #1a3320" }}>
        <button
          type="button"
          data-export-ignore
          onClick={() => setShowFullAnalysis(true)}
          style={{
            width: "100%",
            padding: "9px",
            background: "transparent",
            border: `1px solid ${c.border}`,
            color: c.text,
            fontFamily: RAJ,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            borderRadius: 3,
            cursor: "pointer",
            transition: "all 0.15s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${c.bg}`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          ◈ FULL ANALYSIS ▶
        </button>
      </div>
    </div>
    {showFullAnalysis && <FullAnalysisModal node={node} onClose={() => setShowFullAnalysis(false)} />}
    </>
  );
}

export default function InvestigationBoard({
  nodes,
  edges,
  onNodeClick,
  selectedNode,
  conclusion,
  verdict,
  analysisSources,
  articleTitle,
  polymarketContext,
  backHref,
  backLabel = "← BACK",
}: Props) {
  const [scanLine, setScanLine] = useState(0);
  const [glitch, setGlitch] = useState(false);
  const [pulse, setPulse] = useState(false);
  const [internalSelected, setInternalSelected] = useState<Node | null>(selectedNode ?? null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);
  const [shareToast, setShareToast] = useState("");
  const [shareMenuOpen, setShareMenuOpen] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  const narrowPanel = useNarrowPanel();

  const shareText = conclusion
    ? `Investigation: "${conclusion.slice(0, 120)}${conclusion.length > 120 ? "…" : ""}" — The Theorist`
    : "AI-powered investigation — The Theorist";
  const shareUrl = typeof window !== "undefined" ? window.location.href : "https://conspiracyhub.vercel.app";

  const toast = useCallback((msg: string, ms = 2500) => {
    setShareToast(msg);
    setTimeout(() => setShareToast(""), ms);
  }, []);

  // Close share dropdown when clicking outside
  useEffect(() => {
    if (!shareMenuOpen) return;
    function handleOutside(e: MouseEvent) {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target as globalThis.Node)) {
        setShareMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [shareMenuOpen]);

  const downloadPng = useCallback(async (): Promise<string | null> => {
    if (!boardRef.current) return null;
    setShareMenuOpen(false);

    const previousSelection = internalSelected;
    const didAutoPick = !previousSelection && nodes.length > 0;
    if (didAutoPick) {
      const pick =
        nodes.find((n) => n.id === "center") ??
        nodes.find((n) => n.type !== "theory") ??
        nodes[0];
      setInternalSelected(pick);
      onNodeClick(pick);
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      await new Promise<void>((r) => setTimeout(r, 120));
    }

    if (typeof document !== "undefined" && document.fonts?.ready) {
      await document.fonts.ready;
    }
    const html2canvas = (await import("html2canvas")).default;
    const el = boardRef.current;
    const canvas = await html2canvas(el, {
      backgroundColor: "#050c07",
      scale: 3,
      useCORS: true,
      allowTaint: false,
      logging: false,
      width: el.scrollWidth,
      height: el.scrollHeight,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
      ignoreElements: shouldIgnoreInExport,
      onclone: (clonedDoc, clonedEl) => {
        tuneBoardCloneForExport(clonedDoc, clonedEl as HTMLElement);
      },
    });

    if (didAutoPick) {
      setInternalSelected(null);
      onNodeClick(null);
    }
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) { resolve(null); return; }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `theorist-investigation-${Date.now()}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
          resolve(url);
        },
        "image/png",
        1
      );
    });
  }, [internalSelected, nodes, onNodeClick]);

  const shareVia = useCallback(async (platform: string) => {
    if (sharing) return;
    setShareMenuOpen(false);

    if (platform === "download") {
      setSharing(true);
      toast("Capturing board…", 4000);
      try {
        await downloadPng();
        toast("PNG saved ✓");
      } catch { toast("Capture failed"); }
      setSharing(false);
      return;
    }

    if (platform === "copy") {
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast("Link copied ✓");
      } catch { toast("Could not copy link"); }
      return;
    }

    const encoded = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);
    const hashtags = "TheTheorist,UAP,Investigation";

    const urls: Record<string, string> = {
      twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encoded}&hashtags=${hashtags}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
      reddit: `https://www.reddit.com/submit?url=${encoded}&title=${encodedText}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`,
      email: `mailto:?subject=${encodeURIComponent("Check this investigation")}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`,
    };

    const target = urls[platform];
    if (target) {
      window.open(target, "_blank", "width=640,height=480,noopener,noreferrer");
      toast("Share opened ✓");
    }
  }, [sharing, shareText, shareUrl, toast, downloadPng]);

  // Pan / zoom state
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [localNodes, setLocalNodes] = useState<Node[]>(nodes);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragState = useRef<{ type: "pan" | "node"; nodeId?: string; startX: number; startY: number; origX: number; origY: number } | null>(null);
  const [svgDragActive, setSvgDragActive] = useState(false);

  const graphStructureKey = useMemo(() => {
    const ids = [...nodes].map((n) => n.id).sort().join("|");
    const es = [...edges]
      .map((e) => `${e.from}->${e.to}`)
      .sort()
      .join(";");
    return `${ids}::${es}`;
  }, [nodes, edges]);

  /* eslint-disable react-hooks/set-state-in-effect -- sync from props when graph topology changes */
  useEffect(() => {
    setLocalNodes(nodes);
    // graphStructureKey drives resets; `nodes` omitted so prop reference churn does not wipe dragged positions
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [graphStructureKey]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Convert screen coords → SVG coords accounting for transform
  function screenToSvg(screenX: number, screenY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: screenX, y: screenY };
    const rect = svg.getBoundingClientRect();
    const svgW = 1000; const svgH = 640;
    const scaleX = svgW / rect.width;
    const scaleY = svgH / rect.height;
    const sx = (screenX - rect.left) * scaleX;
    const sy = (screenY - rect.top) * scaleY;
    // Undo the transform
    return {
      x: (sx - transform.x) / transform.scale,
      y: (sy - transform.y) / transform.scale,
    };
  }

  function handleSvgMouseDown(e: ReactMouseEvent<SVGSVGElement>) {
    // Only pan if clicking background (not a node)
    const target = e.target as SVGElement;
    if (target.closest("[data-node]")) return;
    dragState.current = { type: "pan", startX: e.clientX, startY: e.clientY, origX: transform.x, origY: transform.y };
    setSvgDragActive(true);
    e.preventDefault();
  }

  function handleNodeMouseDown(e: ReactMouseEvent, nodeId: string) {
    e.stopPropagation();
    const node = localNodes.find(n => n.id === nodeId);
    if (!node) return;
    const svgCoords = screenToSvg(e.clientX, e.clientY);
    dragState.current = { type: "node", nodeId, startX: svgCoords.x - node.x, startY: svgCoords.y - node.y, origX: node.x, origY: node.y };
    e.preventDefault();
  }

  function handleMouseMove(e: ReactMouseEvent<SVGSVGElement>) {
    const ds = dragState.current;
    if (!ds) return;
    if (ds.type === "pan") {
      const dx = e.clientX - ds.startX;
      const dy = e.clientY - ds.startY;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scaleX = 1000 / rect.width;
      const scaleY = 640 / rect.height;
      setTransform(t => ({ ...t, x: ds.origX + dx * scaleX, y: ds.origY + dy * scaleY }));
    } else if (ds.type === "node" && ds.nodeId) {
      const svgCoords = screenToSvg(e.clientX, e.clientY);
      setLocalNodes(prev => prev.map(n =>
        n.id === ds.nodeId
          ? { ...n, x: svgCoords.x - ds.startX, y: svgCoords.y - ds.startY }
          : n
      ));
    }
  }

  function handleMouseUp() {
    dragState.current = null;
    setSvgDragActive(false);
  }

  function resetView() {
    setTransform({ x: 0, y: 0, scale: 1 });
  }

  const selectedEdges = useMemo(() => {
    if (!internalSelected) return new Set<string>();
    return new Set(edges.filter((e) => e.from === internalSelected.id || e.to === internalSelected.id).map((e) => `${e.from}-${e.to}`));
  }, [internalSelected, edges]);

  useEffect(() => {
    const iv = setInterval(() => setScanLine((l) => (l + 2) % 640), 16);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 120);
    }, 7000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setPulse((p) => !p), 1500);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.88 : 1.14;
      const rect = svg.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 1000;
      const my = ((e.clientY - rect.top) / rect.height) * 640;
      setTransform((t) => {
        const newScale = Math.max(0.3, Math.min(4, t.scale * delta));
        const factor = newScale / t.scale;
        return {
          x: mx + (t.x - mx) * factor,
          y: my + (t.y - my) * factor,
          scale: newScale,
        };
      });
    };
    svg.addEventListener("wheel", wheelHandler, { passive: false });
    return () => svg.removeEventListener("wheel", wheelHandler);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setInternalSelected(null);
        onNodeClick(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNodeClick]);

  /* eslint-disable react-hooks/set-state-in-effect -- refresh selected node when props.nodes updates */
  useEffect(() => {
    setInternalSelected((prev) => {
      if (!prev) return prev;
      const next = nodes.find((n) => n.id === prev.id);
      return next ?? prev;
    });
  }, [nodes]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const connectedEdges = internalSelected ? edges.filter((e) => selectedEdges.has(`${e.from}-${e.to}`)) : [];
  const handleNodeClick = (node: Node) => {
    const next = internalSelected?.id === node.id ? null : node;
    setInternalSelected(next);
    onNodeClick(next);
  };

  const allText = `${nodes.map((n) => `${n.label} ${n.sub} ${n.detail?.title ?? ""} ${n.detail?.source ?? ""}`).join(" ")} ${edges.map((e) => e.label).join(" ")}`.toLowerCase();
  const hasCiaFoia = allText.includes("cia") || allText.includes("foia");
  const hasUspto = allText.includes("uspto") || allText.includes("patent");
  const hasGuardian = allText.includes("guardian");
  const hasDarpa = allText.includes("darpa");

  return (
    <div className="ib-root" style={{ fontFamily: FONT, background: "#040b06", minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", ["--ib-panel-w" as string]: IB_PANEL_W }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;600;700&display=swap');
        .ib-root { --ib-panel-w: clamp(400px, 40vw, 480px); }
        .ib-detail-panel-scroll { max-width: 65ch; }
        @media (max-width: 1023px) {
          .ib-detail-overlay { width: min(100%, 480px) !important; box-shadow: -12px 0 48px rgba(0,0,0,0.55); }
        }
        @keyframes dashMove { to { stroke-dashoffset: -20; } }
        @keyframes glowPulse { 0%,100%{opacity:0.6} 50%{opacity:1} }
        @keyframes slideIn { from{transform:translateX(20px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes ol-fadein { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{ height: 44, background: "#050c07", borderBottom: "1px solid #1a3320", display: "flex", alignItems: "center", padding: "0 16px", gap: 14 }}>
        {backHref && (
          <>
            <Link
              href={backHref}
              prefetch={false}
              style={{
                fontSize: 10,
                color: "#00ff88",
                textDecoration: "none",
                letterSpacing: 2,
                border: "1px solid #00bb66",
                padding: "4px 10px",
                borderRadius: 3,
                flexShrink: 0,
                fontFamily: RAJ,
                fontWeight: 700,
              }}
            >
              {backLabel}
            </Link>
            <div style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
          </>
        )}
        <div style={{ fontFamily: RAJ, fontSize: 15, fontWeight: 700, color: "#00ff88", letterSpacing: 3, flexShrink: 0 }}>
          {glitch ? "C0NSP1RACY 0RACLE" : "CONSPIRACY ORACLE"}
        </div>
        <div style={{ width: 1, height: 20, background: "#1a3320", flexShrink: 0 }} />
        <div style={{ color: "#5a8068", fontSize: 10 }}>INVESTIGATION MODE</div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12, alignItems: "center" }}>
          {[
            { label: "CIA FOIA", active: hasCiaFoia },
            { label: "USPTO", active: hasUspto },
            { label: "GUARDIAN", active: hasGuardian },
            { label: "DARPA", active: hasDarpa },
            { label: "HYPOTHESES", active: nodes.some((n) => n.type === "theory") },
          ].map((s) => (
            <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 9, color: s.active ? "#5a8068" : "#476352", letterSpacing: 1 }}>
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: s.active ? "#00ff88" : "#ff3333",
                  display: "inline-block",
                  animation: s.active ? "glowPulse 2s infinite" : "none",
                }}
              />
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {conclusion || verdict ? (
        <div
          style={{
            minHeight: 34,
            background: "#030804",
            borderBottom: "1px solid #1a3320",
            display: "flex",
            alignItems: "center",
            padding: "6px 16px",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontFamily: FONT, fontSize: 9, color: "#c94dff", letterSpacing: 2 }}>VERDICT</span>
          <span style={{ fontFamily: RAJ, fontSize: 12, fontWeight: 700, color: "#00ff88" }}>{formatVerdictShort(verdict)}</span>
          {conclusion ? (
            <span style={{ fontFamily: FONT, fontSize: 10, color: "#7aaa8a", flex: 1, minWidth: 0, lineHeight: 1.55 }}>{conclusion}</span>
          ) : null}
        </div>
      ) : null}

      <div style={{ height: 24, background: "#030803", borderBottom: "1px solid #1a3320", overflow: "hidden", display: "flex", alignItems: "center" }}>
        <div style={{ fontSize: 9, color: "#1a4a2a", letterSpacing: 1, padding: "0 8px", borderRight: "1px solid #1a3320", whiteSpace: "nowrap", flexShrink: 0 }}>LIVE</div>
        <div style={{ overflow: "hidden", flex: 1 }}>
          <div style={{ display: "flex", animation: "ticker 30s linear infinite", whiteSpace: "nowrap" }}>
            {["▸ Neuralink: FDA approval", "◈ USPTO: neural interface patents", "▸ CIA FOIA: historical records", "◈ DARPA contracts + industry links", "▸ WEF / Snowden statements"].map((t, i) => (
              <span key={i} style={{ fontSize: 9, color: "#3a6040", letterSpacing: 1, padding: "0 24px" }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div ref={boardRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.3 }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#0d2015" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
        <div data-export-ignore style={{ position: "absolute", left: 0, right: 0, height: 2, top: scanLine, background: "rgba(0,255,136,0.04)", zIndex: 5 }} />
        <div
          data-share-ignore
          style={{
            position: "absolute",
            top: 12,
            right: internalSelected ? "calc(var(--ib-panel-w) + 16px)" : 12,
            zIndex: 20,
            display: "flex",
            gap: 6,
            alignItems: "center",
          }}
        >
          {shareToast ? (
            <div
              style={{
                fontFamily: FONT,
                fontSize: 9,
                color: "#00ff88",
                background: "rgba(5,12,7,0.95)",
                border: "1px solid #00bb66",
                borderRadius: 3,
                padding: "5px 12px",
                letterSpacing: 1,
                whiteSpace: "nowrap",
                animation: "ol-fadein 0.2s ease",
              }}
            >
              {shareToast}
            </div>
          ) : null}
          {/* Share dropdown */}
          <div ref={shareMenuRef} data-share-ignore style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setShareMenuOpen((o) => !o)}
              disabled={sharing}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                background: shareMenuOpen ? "rgba(0,255,136,0.06)" : "rgba(5,12,7,0.92)",
                border: `1px solid ${shareMenuOpen ? "#00bb66" : "#1a3320"}`,
                borderRadius: 3,
                color: shareMenuOpen ? "#00ff88" : "#5a8068",
                fontFamily: "var(--font-raj), sans-serif",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                cursor: sharing ? "not-allowed" : "pointer",
                transition: "all 0.15s",
                backdropFilter: "blur(4px)",
                opacity: sharing ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!sharing && !shareMenuOpen) {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#00bb66";
                  (e.currentTarget as HTMLButtonElement).style.color = "#00ff88";
                }
              }}
              onMouseLeave={(e) => {
                if (!shareMenuOpen) {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a3320";
                  (e.currentTarget as HTMLButtonElement).style.color = "#5a8068";
                }
              }}
            >
              {sharing ? "CAPTURING…" : `◈ SHARE ${shareMenuOpen ? "▲" : "▼"}`}
            </button>

            {shareMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  background: "#060e08",
                  border: "1px solid #1a3320",
                  borderRadius: 4,
                  minWidth: 200,
                  zIndex: 200,
                  overflow: "hidden",
                  animation: "ol-fadein 0.15s ease",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                }}
              >
                {[
                  { id: "twitter",   icon: "𝕏",  label: "Share on X / Twitter" },
                  { id: "facebook",  icon: "f",  label: "Share on Facebook" },
                  { id: "reddit",    icon: "r/", label: "Share on Reddit" },
                  { id: "whatsapp",  icon: "📱", label: "Share on WhatsApp" },
                  { id: "email",     icon: "✉",  label: "Send via Email" },
                  { id: "copy",      icon: "🔗", label: "Copy link" },
                  { id: "download",  icon: "💾", label: "Download PNG" },
                ].map(({ id, icon, label }, i) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => void shareVia(id)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 14px",
                      background: "transparent",
                      border: "none",
                      borderTop: i === 0 ? "none" : "1px solid #0f1e13",
                      color: "#c8e8d0",
                      fontFamily: "var(--font-raj), sans-serif",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: 1,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,255,136,0.06)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <span style={{ width: 20, textAlign: "center", fontSize: 13, flexShrink: 0 }}>{icon}</span>
                    <span style={{ color: "#a0c8b0" }}>{label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {/* Zoom controls — bottom-left when no panel; with panel, grouped with stats (see cluster below) */}
        {!internalSelected ? (
          <div data-export-ignore style={{ position: "absolute", bottom: 16, left: 16, zIndex: 20, display: "flex", flexDirection: "column", gap: 4 }}>
            {[
              { label: "+", action: () => setTransform((t) => ({ ...t, scale: Math.min(4, t.scale * 1.2) })) },
              { label: "−", action: () => setTransform((t) => ({ ...t, scale: Math.max(0.3, t.scale * 0.83) })) },
              { label: "⊡", action: resetView },
            ].map(({ label, action }) => (
              <button
                key={label}
                type="button"
                onClick={action}
                style={{
                  width: 30,
                  height: 30,
                  background: "rgba(4,11,6,0.9)",
                  border: "1px solid #1a3320",
                  color: "#5a8068",
                  fontFamily: "var(--font-raj), sans-serif",
                  fontSize: 16,
                  fontWeight: 700,
                  borderRadius: 3,
                  cursor: "pointer",
                  lineHeight: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#00bb66";
                  (e.currentTarget as HTMLButtonElement).style.color = "#00ff88";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a3320";
                  (e.currentTarget as HTMLButtonElement).style.color = "#5a8068";
                }}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {/* Zoom level indicator */}
        <div data-export-ignore style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#2a4030", letterSpacing: 2, zIndex: 20, fontFamily: FONT }}>
          {Math.round(transform.scale * 100)}% · SCROLL TO ZOOM · DRAG TO PAN
        </div>

        <svg
          className="ib-main-svg"
          ref={svgRef}
          viewBox="0 0 1000 640"
          style={{ width: internalSelected && !narrowPanel ? "calc(100% - var(--ib-panel-w))" : "100%", height: "100%", transition: "width 0.25s ease", position: "absolute", inset: 0, cursor: svgDragActive ? "grabbing" : "grab" }}
          preserveAspectRatio="xMidYMid meet"
          onMouseDown={handleSvgMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <g transform={`translate(${transform.x},${transform.y}) scale(${transform.scale})`}>
          {localNodes.length > 0 && edges.map((edge, i) => (
            <EdgeLine key={`${edge.from}-${edge.to}-${i}`} edge={edge} nodes={localNodes} active={!internalSelected || selectedEdges.has(`${edge.from}-${edge.to}`)} />
          ))}

          {localNodes.map((node) => (
            <g key={node.id} data-node="true" onMouseDown={(e) => handleNodeMouseDown(e, node.id)} style={{ cursor: "grab" }}>
              <GraphNode node={node} onClick={handleNodeClick} selected={internalSelected?.id === node.id} pulse={pulse} />
            </g>
          ))}

          {internalSelected &&
            connectedEdges.map((e, i) => {
              const from = localNodes.find((n) => n.id === e.from);
              const to = localNodes.find((n) => n.id === e.to);
              if (!from || !to) return null;
              const mx = (from.x + to.x) / 2;
              const my = (from.y + to.y) / 2;
              return (
                <g key={i}>
                  {(() => {
                    const lbl = e.label && e.label.length > 26 ? e.label.slice(0, 25) + "…" : (e.label || "");
                    const bw = Math.max(80, lbl.length * 5.5 + 16);
                    return (
                      <>
                        <rect x={mx - bw/2} y={my - 10} width={bw} height={16} rx={2} fill="#040b06" stroke={e.color} strokeWidth={0.5} strokeOpacity={0.6} />
                        <text x={mx} y={my + 2} textAnchor="middle" fill={e.color} opacity={0.9} style={{ fontFamily: FONT, fontSize: 9, letterSpacing: 0.5 }}>
                          {lbl}
                        </text>
                      </>
                    );
                  })()}
                </g>
              );
            })}
          </g>
        </svg>

        <div style={{ position: "absolute", bottom: 16, left: 16, display: "flex", flexDirection: "column", gap: 5, background: "rgba(4,11,6,0.85)", border: "1px solid #1a3320", borderRadius: 4, padding: "10px 12px" }}>
          <div style={{ fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 4, textTransform: "uppercase" }}>Connection types</div>
          {[
            ["#ff3333", "Direct evidence"],
            ["#ffaa00", "Indirect link"],
            ["#00bb66", "Counter signal"],
            ["#5a8068", "Cross-reference"],
            ["#c94dff", "Conspiracy hypothesis"],
          ].map(([col, label]) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 18, height: 1.5, background: col }} />
              <span style={{ fontSize: 10, color: "#5a8068", letterSpacing: 1 }}>{label}</span>
            </div>
          ))}
        </div>

        {internalSelected ? (
          <div
            data-export-ignore
            style={{
              position: "absolute",
              bottom: 16,
              right: "calc(var(--ib-panel-w) + 16px)",
              zIndex: 20,
              display: "flex",
              flexDirection: "row",
              alignItems: "flex-end",
              gap: 12,
            }}
          >
            <div style={{ display: "flex", gap: 12, flexShrink: 0 }}>
              {[
                [String(nodes.length), "NODES"],
                [String(edges.length), "EDGES"],
                [`${Math.max(...nodes.map((n) => n.detail?.threat ?? 0), 0)}%`, "MAX THREAT"],
              ].map(([val, label]) => (
                <div
                  key={label}
                  style={{
                    background: "rgba(4,11,6,0.85)",
                    border: "1px solid #1a3320",
                    borderRadius: 4,
                    padding: "8px 12px",
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontFamily: RAJ, fontSize: 20, fontWeight: 700, color: "#00ff88", lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: 8, color: "#5a8068", letterSpacing: 2, marginTop: 3 }}>{label}</div>
                </div>
              ))}
            </div>
            <div data-export-ignore style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
              {[
                { label: "+", action: () => setTransform((t) => ({ ...t, scale: Math.min(4, t.scale * 1.2) })) },
                { label: "−", action: () => setTransform((t) => ({ ...t, scale: Math.max(0.3, t.scale * 0.83) })) },
                { label: "⊡", action: resetView },
              ].map(({ label, action }) => (
                <button
                  key={label}
                  type="button"
                  onClick={action}
                  style={{
                    width: 30,
                    height: 30,
                    background: "rgba(4,11,6,0.9)",
                    border: "1px solid #1a3320",
                    color: "#5a8068",
                    fontFamily: "var(--font-raj), sans-serif",
                    fontSize: 16,
                    fontWeight: 700,
                    borderRadius: 3,
                    cursor: "pointer",
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#00bb66";
                    (e.currentTarget as HTMLButtonElement).style.color = "#00ff88";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "#1a3320";
                    (e.currentTarget as HTMLButtonElement).style.color = "#5a8068";
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div data-export-ignore style={{ position: "absolute", bottom: 16, right: 16, display: "flex", gap: 12, zIndex: 20 }}>
            {[
              [String(nodes.length), "NODES"],
              [String(edges.length), "EDGES"],
              [`${Math.max(...nodes.map((n) => n.detail?.threat ?? 0), 0)}%`, "MAX THREAT"],
            ].map(([val, label]) => (
              <div
                key={label}
                style={{
                  background: "rgba(4,11,6,0.85)",
                  border: "1px solid #1a3320",
                  borderRadius: 4,
                  padding: "8px 12px",
                  textAlign: "center",
                }}
              >
                <div style={{ fontFamily: RAJ, fontSize: 20, fontWeight: 700, color: "#00ff88", lineHeight: 1 }}>{val}</div>
                <div style={{ fontSize: 8, color: "#5a8068", letterSpacing: 2, marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {!internalSelected && (
          <div data-export-ignore style={{ position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)", fontFamily: FONT, fontSize: 9, color: "#1a4a2a", letterSpacing: 2, textTransform: "uppercase", pointerEvents: "none" }}>
            ◈ click a node for details ◈
          </div>
        )}

        {narrowPanel && internalSelected ? (
          <div
            data-export-ignore
            role="presentation"
            onClick={() => {
              setInternalSelected(null);
              onNodeClick(null);
            }}
            style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 25 }}
          />
        ) : null}

        {internalSelected ? (
          <DetailPanel
            node={internalSelected}
            edges={edges}
            overlay={narrowPanel}
            onClose={() => {
              setInternalSelected(null);
              onNodeClick(null);
            }}
            analysisSources={analysisSources}
            polymarketArticleTitle={articleTitle}
            polymarketArticleContext={polymarketContext}
          />
        ) : null}
      </div>

      {articleTitle ? (
        <div style={{ padding: "6px 1rem 8px", borderTop: "1px solid #1a1a2a", flexShrink: 0, background: "rgba(10,4,18,0.55)" }}>
          <PolymarketWidget query={articleTitle} context={polymarketContext} variant="board" />
        </div>
      ) : null}
    </div>
  );
}
