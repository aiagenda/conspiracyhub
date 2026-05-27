"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, ReactNode } from "react";
import Link from "next/link";
import PolymarketWidget from "@/components/PolymarketWidget";
import { combinePolymarketQuery } from "@/lib/polymarketQuery";
import {
  maxNodeDisplayScore,
  nodeDisplayScore,
  nodeScoreColor,
  nodeScoreHint,
  nodeScoreLabelLong,
  nodeScoreLabelShort,
} from "@/lib/nodeScoreLabels";
import { shouldShowFederalSpending } from "@/lib/federalSpending";
import type { Edge, Node, NodeType, OracleAnalysis, OracleSource } from "@/types";

const FONT = "'Share Tech Mono', monospace";
const RAJ = "'Rajdhani', sans-serif";

const IB_ZOOM_MIN = 0.3;
const IB_ZOOM_MAX = 4;

function clampIbScale(scale: number): number {
  return Math.max(IB_ZOOM_MIN, Math.min(IB_ZOOM_MAX, scale));
}

function zoomTransformAtPoint(
  t: { x: number; y: number; scale: number },
  mx: number,
  my: number,
  newScale: number,
) {
  const scale = clampIbScale(newScale);
  const factor = scale / t.scale;
  return {
    x: mx + (t.x - mx) * factor,
    y: my + (t.y - my) * factor,
    scale,
  };
}

function clientToSvgPoint(
  clientX: number,
  clientY: number,
  rect: DOMRect,
  t: { x: number; y: number; scale: number },
) {
  const sx = ((clientX - rect.left) / rect.width) * 1000;
  const sy = ((clientY - rect.top) / rect.height) * 640;
  return {
    svgX: sx,
    svgY: sy,
    graphX: (sx - t.x) / t.scale,
    graphY: (sy - t.y) / t.scale,
  };
}

type IbTouchGesture =
  | { kind: "pan"; startX: number; startY: number; origX: number; origY: number }
  | {
      kind: "pinch";
      startDist: number;
      midX: number;
      midY: number;
      origX: number;
      origY: number;
      origScale: number;
    }
  | { kind: "node"; nodeId: string; offsetX: number; offsetY: number; startClientX: number; startClientY: number; moved: boolean };

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

function graphNodeDimensions(node: Node, mobile: boolean) {
  const m = mobile ? 1.5 : 1;
  const isCenter = node.id === "center";
  const isTheory = node.type === "theory";
  const labelLen = (node.label || "").length;
  const w = (isCenter ? 148 : isTheory ? 156 : Math.max(118, Math.min(156, labelLen * 7.8))) * m;
  const h = (isCenter ? 68 : isTheory ? 66 : 58) * m;
  return { w, h, isCenter, isTheory, m };
}

function computeFitTransform(
  nodes: Node[],
  mobile: boolean,
): { x: number; y: number; scale: number } {
  if (!nodes.length) return { x: 0, y: 0, scale: 1 };
  const viewW = 1000;
  const viewH = 640;
  const padding = mobile ? 24 : 40;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    const { w, h } = graphNodeDimensions(n, mobile);
    minX = Math.min(minX, n.x - w / 2);
    maxX = Math.max(maxX, n.x + w / 2);
    minY = Math.min(minY, n.y - h / 2);
    maxY = Math.max(maxY, n.y + h / 2);
  }
  const graphW = Math.max(maxX - minX, 80);
  const graphH = Math.max(maxY - minY, 80);
  const fitScale = Math.min((viewW - padding * 2) / graphW, (viewH - padding * 2) / graphH);
  const scale = clampIbScale(
    mobile ? Math.min(fitScale * 1.15, 3.8) : Math.min(fitScale, 1.12),
  );
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return {
    x: viewW / 2 - cx * scale,
    y: viewH / 2 - cy * scale,
    scale,
  };
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

function GraphNode({
  node,
  onClick,
  selected,
  pulse,
  mobile = false,
}: {
  node: Node;
  onClick: (node: Node) => void;
  selected: boolean;
  pulse: boolean;
  mobile?: boolean;
}) {
  const c = NODE_COLORS[node.type] ?? FALLBACK_COLOR;
  const { w, h, isCenter, isTheory } = graphNodeDimensions(node, mobile);

  const maxLabelChars = Math.floor(w / (mobile ? 5.8 : 6.5));
  const displayLabel = truncate(node.label || "", maxLabelChars);

  const subLines = (node.sub || "")
    .split("\n")
    .slice(0, 2)
    .map((l) => truncate(l, Math.floor(w / (mobile ? 5 : 5.5))));

  const typeSize = mobile ? 11 : 8;
  const labelSize = (isCenter ? 15 : 13) * (mobile ? 1.05 : 1);
  const subSize = mobile ? 11 : 8;

  return (
    <g transform={`translate(${node.x}, ${node.y})`} onClick={() => onClick(node)} style={{ cursor: "pointer" }}>
      <ellipse cx={0} cy={0} rx={w * 0.6} ry={h * 0.7} fill={c.glow} style={{ animation: selected || (isCenter && pulse) ? "glowPulse 1.5s ease-in-out infinite" : "none" }} filter="blur(8px)" />
      <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={mobile ? 6 : 4} ry={mobile ? 6 : 4} fill={c.bg} stroke={c.border} strokeWidth={selected ? (mobile ? 2.5 : 2) : isCenter ? 1.5 : 1} strokeOpacity={selected ? 1 : 0.7} />
      {[[-w / 2, -h / 2, 1], [-w / 2 + 10, -h / 2, 1], [w / 2, -h / 2, -1], [w / 2 - 10, -h / 2, -1]].map(([x, y, dx], i) => (
        <line key={i} x1={Number(x)} y1={Number(y)} x2={Number(x) + Number(dx) * 8} y2={Number(y)} stroke={c.border} strokeWidth={mobile ? 2 : 1.5} strokeOpacity={0.5} />
      ))}
      <text x={0} y={-h / 2 + (mobile ? 14 : 11)} textAnchor="middle" fill={c.text} opacity={0.55} style={{ fontFamily: FONT, fontSize: typeSize, letterSpacing: 1.5 }}>
        {TYPE_LABELS[node.type] ?? "NODE"}
      </text>
      <text x={0} y={isCenter ? 4 : 2} textAnchor="middle" fill={c.text} style={{ fontFamily: RAJ, fontSize: labelSize, fontWeight: 700, letterSpacing: 0.5 }}>
        {displayLabel}
      </text>
      {subLines.map((line, i) => (
        <text key={i} x={0} y={(isCenter ? 18 : 16) + i * (mobile ? 13 : 11)} textAnchor="middle" fill={c.text} opacity={0.62} style={{ fontFamily: FONT, fontSize: subSize }}>
          {line}
        </text>
      ))}
      {selected && <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={mobile ? 6 : 4} ry={mobile ? 6 : 4} fill="none" stroke={c.border} strokeWidth={mobile ? 3.5 : 3} strokeOpacity={0.4} style={{ animation: "glowPulse 1s ease-in-out infinite" }} />}
    </g>
  );
}

function FullAnalysisModal({ node, onClose }: { node: Node; onClose: () => void }) {
  const c = NODE_COLORS[node.type] ?? FALLBACK_COLOR;
  const d = node.detail;
  const isTheory = node.type === "theory";
  const score = nodeDisplayScore(node.type, d);

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

          {score !== null ? (
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 4 }}>{nodeScoreLabelShort(node.type)}</div>
              <div style={{ fontFamily: RAJ, fontSize: 44, fontWeight: 700, color: nodeScoreColor(score), lineHeight: 1 }}>{score}%</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ height: 5, background: "#1a3320", borderRadius: 3, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", width: `${score}%`, background: nodeScoreColor(score), borderRadius: 3 }} />
              </div>
              <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", lineHeight: 1.5, marginBottom: 8 }}>{nodeScoreHint(node.type)}</div>
              <div style={{ display: "flex", gap: 6 }}>
                {d.source_tier && <span style={{ fontSize: 9, border: "1px solid #1a3320", padding: "2px 7px", borderRadius: 2, color: "#5a8068" }}>Tier {d.source_tier}</span>}
                {d.source_type && <span style={{ fontSize: 9, border: "1px solid #1a3320", padding: "2px 7px", borderRadius: 2, color: "#5a8068", textTransform: "uppercase" }}>{d.source_type}</span>}
              </div>
            </div>
          </div>
          ) : null}

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

const FEDERAL_SPENDING_COLLAPSED = 12;

function FederalAwardRow({
  award,
}: {
  award: {
    awardId: string;
    amountFormatted: string;
    agency: string;
    recipient?: string;
    startDate: string;
    description: string;
    usaspendingUrl: string;
  };
}) {
  return (
    <a
      href={award.usaspendingUrl}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "block",
        marginBottom: 8,
        padding: "9px 11px",
        border: "1px solid rgba(255,170,0,0.22)",
        borderRadius: 4,
        background: "rgba(255,170,0,0.04)",
        textDecoration: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
        <span style={{ fontFamily: RAJ, fontSize: 15, fontWeight: 700, color: "#ffcc66" }}>{award.amountFormatted}</span>
        <span style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 1 }}>{award.startDate || "—"}</span>
      </div>
      {award.recipient ? (
        <div style={{ fontFamily: FONT, fontSize: 10, color: "#9ac8b0", marginBottom: 3 }}>{award.recipient}</div>
      ) : null}
      <div style={{ fontFamily: FONT, fontSize: 11, color: "#c8e8d0", marginBottom: 3 }}>{award.agency}</div>
      {award.description ? (
        <div style={{ ...IB_TYPE.bodySm, color: "#7aaa8a", lineHeight: 1.5 }}>{award.description}</div>
      ) : null}
      <div style={{ fontFamily: FONT, fontSize: 9, color: "#00bb66", marginTop: 4, letterSpacing: 1 }}>↗ View on USASpending</div>
    </a>
  );
}

function FederalSpendingPanel({ node }: { node: Node }) {
  const d = node.detail;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<{
    panelTitle: string;
    sourceNote: string;
    totalAmountFormatted: string;
    totalCount: number;
    mode: string;
    awards: Array<{
      awardId: string;
      amountFormatted: string;
      agency: string;
      recipient: string;
      startDate: string;
      description: string;
      usaspendingUrl: string;
    }>;
  } | null>(null);

  const queryName = d.title || node.label;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setExpanded(false);

    const params = new URLSearchParams({
      name: queryName,
      nodeType: node.type,
      label: node.label,
      title: d.title || node.label,
    });
    if (d.source) params.set("source", d.source);
    if (d.source_type) params.set("sourceType", d.source_type);

    fetch(`/api/federal-spending?${params}`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load federal spending");
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load US federal spending data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [node.type, node.label, queryName, d.title, d.source, d.source_type]);

  const visibleAwards =
    data && !expanded && data.awards.length > FEDERAL_SPENDING_COLLAPSED
      ? data.awards.slice(0, FEDERAL_SPENDING_COLLAPSED)
      : data?.awards ?? [];

  return (
    <DetailSection title={data?.panelTitle ?? "Federal spending (US)"} accent="#ffaa00">
      <div style={{ ...IB_TYPE.bodySm, color: "#5a8068", marginBottom: 10, lineHeight: 1.55 }}>
        {data?.sourceNote ?? "Public US federal data from "}
        {!data?.sourceNote ? (
          <>
            <a href="https://www.usaspending.gov" target="_blank" rel="noreferrer" style={{ color: "#00bb66" }}>
              USASpending.gov
            </a>
            . No API key required.
          </>
        ) : null}
      </div>
      {loading ? (
        <div style={{ ...IB_TYPE.bodySm, color: "#5a8068" }}>Loading all matching federal awards…</div>
      ) : error ? (
        <div style={{ ...IB_TYPE.bodySm, color: "#ff6666" }}>{error}</div>
      ) : !data || data.awards.length === 0 ? (
        <div style={{ ...IB_TYPE.bodySm, color: "#5a8068" }}>
          No matching US federal awards for &ldquo;{queryName}&rdquo;.
        </div>
      ) : (
        <>
          <div style={{ fontFamily: RAJ, fontSize: 18, fontWeight: 700, color: "#ffaa00", marginBottom: 10 }}>
            {data.totalAmountFormatted} total · {data.totalCount} award{data.totalCount === 1 ? "" : "s"}
          </div>
          {visibleAwards.map((award) => (
            <FederalAwardRow key={award.awardId} award={award} />
          ))}
          {data.awards.length > FEDERAL_SPENDING_COLLAPSED ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                width: "100%",
                marginTop: 4,
                padding: "8px 12px",
                border: "1px solid rgba(255,170,0,0.35)",
                borderRadius: 4,
                background: "rgba(255,170,0,0.06)",
                color: "#ffcc66",
                fontFamily: FONT,
                fontSize: 10,
                letterSpacing: 1.5,
                cursor: "pointer",
                textTransform: "uppercase",
              }}
            >
              {expanded
                ? `Show less ▲`
                : `Show all ${data.totalCount} awards (+${data.totalCount - FEDERAL_SPENDING_COLLAPSED} more) ▼`}
            </button>
          ) : null}
        </>
      )}
    </DetailSection>
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
  const score = nodeDisplayScore(node.type, d);

  return (
    <>
    <div
      className={`ib-detail-panel${overlay ? " ib-detail-overlay" : ""}`}
      style={overlay ? {
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        maxHeight: "82dvh",
        background: "#06110a",
        borderTop: `2px solid ${c.border}`,
        borderRadius: "20px 20px 0 0",
        display: "flex",
        flexDirection: "column",
        animation: "slideUp 0.32s cubic-bezier(0.32,0.72,0,1)",
        zIndex: 50,
        boxShadow: "0 -16px 48px rgba(0,0,0,0.7)",
      } : {
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
      {overlay ? (
        <>
          {/* Drag handle */}
          <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px", flexShrink: 0 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
          </div>
          {/* Bottom sheet header */}
          <div style={{ padding: "4px 16px 10px", flexShrink: 0, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "2px 8px", background: c.glow, border: `1px solid ${c.border}`, borderRadius: 3, marginBottom: 6 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: c.text, opacity: 0.8 }} />
                <span style={{ fontFamily: FONT, fontSize: 9, color: c.text, letterSpacing: 2, textTransform: "uppercase" }}>{TYPE_LABELS[node.type] ?? "NODE"}</span>
              </div>
              <div style={{ fontFamily: RAJ, fontSize: 20, fontWeight: 700, color: c.text, lineHeight: 1.2, letterSpacing: 0.5 }}>{node.label}</div>
              {score !== null ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
                  <div style={{ fontFamily: RAJ, fontSize: 22, fontWeight: 700, color: nodeScoreColor(score), lineHeight: 1 }}>{score}%</div>
                  <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.08)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${score}%`, background: nodeScoreColor(score), borderRadius: 2, transition: "width 0.4s ease" }} />
                  </div>
                  <span style={{ fontFamily: FONT, fontSize: 8, color: "#5a8068", letterSpacing: 1.5, flexShrink: 0 }}>{nodeScoreLabelShort(node.type)}</span>
                </div>
              ) : null}
            </div>
            <button type="button" data-export-ignore onClick={onClose} style={{ flexShrink: 0, width: 36, height: 36, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#7aaa8a", fontFamily: FONT, fontSize: 16, borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
              ✕
            </button>
          </div>
          <div style={{ height: 1, background: `linear-gradient(to right, transparent, ${c.border}, transparent)`, flexShrink: 0 }} />
        </>
      ) : (
        /* Desktop side panel header */
        <div style={{ padding: "14px 16px", borderBottom: "1px solid #1a3320", background: "#050c07", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 10, color: c.text, letterSpacing: 3, opacity: 0.7 }}>{TYPE_LABELS[node.type] ?? "NODE"}</div>
            <div style={{ ...IB_TYPE.panelTitle, color: c.text, marginTop: 3 }}>{node.label}</div>
          </div>
          <button type="button" data-export-ignore onClick={onClose} style={{ background: "transparent", border: "1px solid #1a3320", color: "#5a8068", fontFamily: FONT, fontSize: 11, padding: "4px 10px", borderRadius: 3, cursor: "pointer", letterSpacing: 1 }}>
            ✕
          </button>
        </div>
      )}

      <div className="ib-detail-panel-scroll" style={overlay ? { flex: 1, overflowY: "auto", padding: "16px 16px 36px", WebkitOverflowScrolling: "touch" } as React.CSSProperties : { flex: 1, overflowY: "auto", padding: "18px 20px" }}>
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

        {score !== null ? (
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", letterSpacing: 2, marginBottom: 5, textTransform: "uppercase" }}>
            {nodeScoreLabelLong(node.type)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontFamily: RAJ, fontSize: 28, fontWeight: 700, color: nodeScoreColor(score) }}>{score}%</div>
            <div style={{ flex: 1, height: 3, background: "#1a3320", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${score}%`, background: nodeScoreColor(score), borderRadius: 2 }} />
            </div>
          </div>
          <div style={{ fontFamily: FONT, fontSize: 9, color: "#5a8068", lineHeight: 1.55, marginTop: 6 }}>{nodeScoreHint(node.type)}</div>
        </div>
        ) : null}

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

            {shouldShowFederalSpending(node.type as NodeType) ? (
              <FederalSpendingPanel node={node} />
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

      <div style={{ padding: "12px 14px", borderTop: "1px solid #1a3320", flexShrink: 0, paddingBottom: overlay ? "max(14px, env(safe-area-inset-bottom, 0px))" : "12px" }}>
        <button
          type="button"
          data-export-ignore
          onClick={() => setShowFullAnalysis(true)}
          style={{
            width: "100%",
            padding: overlay ? "13px" : "9px",
            background: overlay ? c.bg : "transparent",
            border: `1px solid ${c.border}`,
            color: c.text,
            fontFamily: RAJ,
            fontSize: overlay ? 14 : 12,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            borderRadius: overlay ? 8 : 3,
            cursor: "pointer",
            transition: "all 0.15s",
            boxShadow: overlay ? `0 0 12px ${c.glow}` : "none",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${c.bg}`; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = overlay ? c.bg : "transparent"; }}
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
  const [legendOpen, setLegendOpen] = useState(false);

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
  const transformRef = useRef(transform);
  const localNodesRef = useRef(localNodes);
  const touchGestureRef = useRef<IbTouchGesture | null>(null);
  const handleNodeClickRef = useRef<(node: Node) => void>(() => {});
  transformRef.current = transform;
  localNodesRef.current = localNodes;
  handleNodeClickRef.current = (node: Node) => {
    const next = internalSelected?.id === node.id ? null : node;
    setInternalSelected(next);
    onNodeClick(next);
  };
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

  useEffect(() => {
    if (!nodes.length) return;
    if (narrowPanel) {
      setTransform(computeFitTransform(nodes, true));
    } else {
      setTransform({ x: 0, y: 0, scale: 1 });
    }
  }, [graphStructureKey, narrowPanel, nodes]);

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

  const resetView = useCallback(() => {
    if (narrowPanel && localNodes.length) {
      setTransform(computeFitTransform(localNodes, true));
    } else {
      setTransform({ x: 0, y: 0, scale: 1 });
    }
  }, [narrowPanel, localNodes]);

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
      setTransform((t) => zoomTransformAtPoint(t, mx, my, t.scale * delta));
    };
    svg.addEventListener("wheel", wheelHandler, { passive: false });
    return () => svg.removeEventListener("wheel", wheelHandler);
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const touchDist = (a: Touch, b: Touch) =>
      Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const rect = svg.getBoundingClientRect();
        const t = transformRef.current;
        const [a, b] = [e.touches[0], e.touches[1]];
        const mid = clientToSvgPoint((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, rect, t);
        touchGestureRef.current = {
          kind: "pinch",
          startDist: touchDist(a, b),
          midX: mid.svgX,
          midY: mid.svgY,
          origX: t.x,
          origY: t.y,
          origScale: t.scale,
        };
        dragState.current = null;
        setSvgDragActive(false);
        return;
      }

      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const hit = document.elementFromPoint(touch.clientX, touch.clientY);
      const nodeGroup = hit?.closest?.("[data-node]") as SVGGElement | null;
      const rect = svg.getBoundingClientRect();
      const t = transformRef.current;
      const pt = clientToSvgPoint(touch.clientX, touch.clientY, rect, t);

      if (nodeGroup) {
        const nodeId = nodeGroup.getAttribute("data-node-id");
        const node = localNodesRef.current.find((n) => n.id === nodeId);
        if (nodeId && node) {
          touchGestureRef.current = {
            kind: "node",
            nodeId,
            offsetX: pt.graphX - node.x,
            offsetY: pt.graphY - node.y,
            startClientX: touch.clientX,
            startClientY: touch.clientY,
            moved: false,
          };
          e.preventDefault();
          return;
        }
      }

      touchGestureRef.current = {
        kind: "pan",
        startX: touch.clientX,
        startY: touch.clientY,
        origX: t.x,
        origY: t.y,
      };
      setSvgDragActive(true);
      e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      const g = touchGestureRef.current;
      if (!g) return;
      e.preventDefault();

      if (g.kind === "pinch" && e.touches.length >= 2) {
        const rect = svg.getBoundingClientRect();
        const [a, b] = [e.touches[0], e.touches[1]];
        const dist = touchDist(a, b);
        if (g.startDist <= 0) return;
        const newScale = clampIbScale(g.origScale * (dist / g.startDist));
        const factor = newScale / g.origScale;
        setTransform({
          x: g.midX + (g.origX - g.midX) * factor,
          y: g.midY + (g.origY - g.midY) * factor,
          scale: newScale,
        });
        return;
      }

      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const rect = svg.getBoundingClientRect();
      const t = transformRef.current;

      if (g.kind === "pan") {
        const dx = touch.clientX - g.startX;
        const dy = touch.clientY - g.startY;
        const scaleX = 1000 / rect.width;
        const scaleY = 640 / rect.height;
        setTransform((prev) => ({
          ...prev,
          x: g.origX + dx * scaleX,
          y: g.origY + dy * scaleY,
        }));
        return;
      }

      if (g.kind === "node") {
        const dx = touch.clientX - g.startClientX;
        const dy = touch.clientY - g.startClientY;
        if (Math.hypot(dx, dy) > 6) {
          g.moved = true;
          const pt = clientToSvgPoint(touch.clientX, touch.clientY, rect, t);
          setLocalNodes((prev) =>
            prev.map((n) =>
              n.id === g.nodeId
                ? { ...n, x: pt.graphX - g.offsetX, y: pt.graphY - g.offsetY }
                : n,
            ),
          );
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length >= 2) return;
      if (e.touches.length === 1 && touchGestureRef.current?.kind === "pinch") {
        const touch = e.touches[0];
        const rect = svg.getBoundingClientRect();
        const t = transformRef.current;
        touchGestureRef.current = {
          kind: "pan",
          startX: touch.clientX,
          startY: touch.clientY,
          origX: t.x,
          origY: t.y,
        };
        setSvgDragActive(true);
        return;
      }
      // Tap on node — fire click handler if finger barely moved
      if (touchGestureRef.current?.kind === "node" && !touchGestureRef.current.moved) {
        const tappedId = touchGestureRef.current.nodeId;
        const tappedNode = localNodesRef.current.find((n) => n.id === tappedId);
        if (tappedNode) {
          handleNodeClickRef.current(tappedNode);
        }
      }
      touchGestureRef.current = null;
      setSvgDragActive(false);
    };

    svg.addEventListener("touchstart", onTouchStart, { passive: false });
    svg.addEventListener("touchmove", onTouchMove, { passive: false });
    svg.addEventListener("touchend", onTouchEnd);
    svg.addEventListener("touchcancel", onTouchEnd);
    return () => {
      svg.removeEventListener("touchstart", onTouchStart);
      svg.removeEventListener("touchmove", onTouchMove);
      svg.removeEventListener("touchend", onTouchEnd);
      svg.removeEventListener("touchcancel", onTouchEnd);
    };
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
          className="ib-verdict-bar"
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
            <span className="ib-verdict-conclusion" style={{ fontFamily: FONT, fontSize: 10, color: "#7aaa8a", flex: 1, minWidth: 0, lineHeight: 1.55 }}>{conclusion}</span>
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

      <div ref={boardRef} className="ib-board-canvas" style={{ flex: 1, position: "relative", overflow: "hidden", touchAction: "none" }}>
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
          <div data-export-ignore className="ib-zoom-controls" style={{ position: "absolute", bottom: 16, left: 16, zIndex: 20, display: "flex", flexDirection: "column", gap: 4 }}>
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
        <div data-export-ignore className="ib-zoom-hint" style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: "#2a4030", letterSpacing: 2, zIndex: 20, fontFamily: FONT }}>
          {Math.round(transform.scale * 100)}% · {narrowPanel ? "PINCH TO ZOOM · DRAG TO PAN" : "PINCH OR +/- TO ZOOM · DRAG TO PAN"}
        </div>

        <svg
          className="ib-main-svg"
          ref={svgRef}
          viewBox="0 0 1000 640"
          style={{ width: internalSelected && !narrowPanel ? "calc(100% - var(--ib-panel-w))" : "100%", height: "100%", transition: "width 0.25s ease", position: "absolute", inset: 0, cursor: svgDragActive ? "grabbing" : "grab", touchAction: "none" }}
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
            <g key={node.id} data-node="true" data-node-id={node.id} onMouseDown={(e) => handleNodeMouseDown(e, node.id)} style={{ cursor: "grab" }}>
              <GraphNode node={node} onClick={handleNodeClick} selected={internalSelected?.id === node.id} pulse={pulse} mobile={narrowPanel} />
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
                        <text x={mx} y={my + 2} textAnchor="middle" fill={e.color} opacity={0.9} style={{ fontFamily: FONT, fontSize: narrowPanel ? 11 : 9, letterSpacing: 0.5 }}>
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

        {narrowPanel ? (
          <button
            type="button"
            data-export-ignore
            className="ib-legend-toggle"
            onClick={() => setLegendOpen((o) => !o)}
            style={{
              position: "absolute",
              bottom: 16,
              left: 56,
              zIndex: 20,
              background: legendOpen ? "rgba(0,255,136,0.08)" : "rgba(4,11,6,0.9)",
              border: `1px solid ${legendOpen ? "#00bb66" : "#1a3320"}`,
              color: legendOpen ? "#00ff88" : "#5a8068",
              fontFamily: FONT,
              fontSize: 9,
              letterSpacing: 1.5,
              padding: "8px 10px",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            {legendOpen ? "HIDE LEGEND" : "LEGEND"}
          </button>
        ) : null}

        <div
          data-export-ignore
          className={`ib-connection-legend${legendOpen ? " ib-connection-legend--open" : ""}`}
          style={{ position: "absolute", bottom: 16, left: 16, display: "flex", flexDirection: "column", gap: 5, background: "rgba(4,11,6,0.85)", border: "1px solid #1a3320", borderRadius: 4, padding: "10px 12px" }}
        >
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
            className="ib-board-stats ib-board-stats--selected"
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
                [`${maxNodeDisplayScore(nodes) ?? 0}%`, "TOP SIGNAL"],
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
            <div data-export-ignore className="ib-zoom-controls" style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
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
          <div data-export-ignore className="ib-board-stats ib-board-stats--overview" style={{ position: "absolute", bottom: 16, right: 16, display: "flex", gap: 12, zIndex: 20 }}>
            {[
              [String(nodes.length), "NODES"],
              [String(edges.length), "EDGES"],
              [`${maxNodeDisplayScore(nodes) ?? 0}%`, "TOP SIGNAL"],
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
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 49 }}
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
