"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import InvestigationBoard from "@/components/InvestigationBoard";
import OracleLoadingScreen from "@/components/OracleLoadingScreen";
import { MOCK_EDGES, MOCK_NODES } from "@/lib/mockData";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Edge, NewsItem, Node, OracleAnalysis, NodeType, OracleTheory } from "@/types";

const VALID_NODE_TYPES: NodeType[] = ["article", "patent", "foia", "company", "event", "person", "theory"];

function buildBoardPolymarketContext(news: NewsItem, analysis: OracleAnalysis | null): string {
  const parts: string[] = [];
  if (news.summary?.trim()) parts.push(news.summary.trim());
  if (news.angle?.trim()) parts.push(news.angle.trim());
  if (analysis?.conclusion?.trim()) parts.push(analysis.conclusion.trim());
  if (analysis?.theories?.length) {
    for (const t of analysis.theories.slice(0, 8)) {
      if (t.name?.trim()) parts.push(t.name.trim());
      if (t.summary?.trim()) parts.push(t.summary.trim().slice(0, 320));
    }
  }
  return parts.join(" ").slice(0, 2200);
}

/** Preserve Brave web results from DB; BoardScreen used to drop these in sanitizeNodes. */
function sanitizeBraveSources(raw: unknown): Node["detail"]["brave_sources"] {
  if (!Array.isArray(raw)) return undefined;
  const out: NonNullable<Node["detail"]["brave_sources"]> = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const x = item as Record<string, unknown>;
    const url = typeof x.url === "string" ? x.url.trim() : "";
    if (!/^https?:\/\//i.test(url)) continue;
    const title = typeof x.title === "string" && x.title.trim() ? x.title.trim() : url;
    const description = typeof x.description === "string" ? x.description : "";
    out.push({ title, url, description });
    if (out.length >= 12) break;
  }
  return out.length ? out : undefined;
}

function sanitizeNodeType(value: unknown): NodeType {
  if (typeof value !== "string") return "event";
  const normalized = value.trim().toLowerCase();
  return (VALID_NODE_TYPES.includes(normalized as NodeType) ? normalized : "event") as NodeType;
}

function inferNodeType(label: string): NodeType {
  const l = label.toLowerCase();
  if (l.includes("uspto") || l.includes("patent")) return "patent";
  if (l.includes("foia") || l.includes("cia")) return "foia";
  if (l.includes("inc") || l.includes("corp") || l.includes("organization") || l.includes("company")) return "company";
  if (l.includes("dr.") || l.includes("prof") || l.includes("director") || l.includes("person")) return "person";
  if (l.includes("study") || l.includes("event") || l.includes("forum")) return "event";
  return "event";
}

function sanitizeNodes(nodes: unknown): Node[] {
  if (!Array.isArray(nodes)) return MOCK_NODES;
  const mapped = nodes
    .map((node, index) => {
      if (!node || typeof node !== "object") return null;
      const n = node as Partial<Node>;
      const safeLabel = typeof n.label === "string" ? n.label : `NODE ${index + 1}`;
      const nodeType = n.type ? sanitizeNodeType(n.type) : inferNodeType(safeLabel);
      const confidenceNum =
        typeof n.detail?.confidence === "number"
          ? Math.max(0, Math.min(100, n.detail.confidence))
          : undefined;
      const threatNum = typeof n.detail?.threat === "number" ? n.detail.threat : undefined;
      const displayThreat =
        nodeType === "article"
          ? (threatNum ?? confidenceNum ?? 50)
          : (threatNum ?? confidenceNum ?? 0);
      return {
        id: typeof n.id === "string" && n.id ? n.id : `node-${index}`,
        type: nodeType,
        x: typeof n.x === "number" ? n.x : 500,
        y: typeof n.y === "number" ? n.y : 320,
        label: safeLabel,
        sub: typeof n.sub === "string" ? n.sub : "",
        detail: {
          title: n.detail?.title ?? safeLabel,
          body: n.detail?.body ?? "",
          source: n.detail?.source ?? "Unknown source",
          threat: displayThreat,
          excerpt: typeof n.detail?.excerpt === "string" && n.detail.excerpt.trim() ? n.detail.excerpt.trim() : undefined,
          source_url: n.detail?.source_url,
          source_tier: n.detail?.source_tier ?? "B",
          source_type: n.detail?.source_type ?? "media",
          why_it_matters: n.detail?.why_it_matters ?? "",
          key_claims: Array.isArray(n.detail?.key_claims) ? n.detail.key_claims : [],
          uncertainties: Array.isArray(n.detail?.uncertainties) ? n.detail.uncertainties : [],
          counter_evidence: Array.isArray(n.detail?.counter_evidence) ? n.detail.counter_evidence : [],
          timeline: Array.isArray(n.detail?.timeline) ? n.detail.timeline : [],
          actors: Array.isArray(n.detail?.actors) ? n.detail.actors : [],
          confidence: confidenceNum ?? (threatNum !== undefined ? Math.round(threatNum * 0.9) : undefined),
          open_questions: Array.isArray(n.detail?.open_questions) ? n.detail.open_questions : [],
          theory_sources: Array.isArray(n.detail?.theory_sources) ? n.detail.theory_sources : [],
          brave_sources: sanitizeBraveSources(n.detail?.brave_sources),
        },
      } satisfies Node;
    })
    .filter(Boolean) as Node[];
  return mapped.length ? mapped : MOCK_NODES;
}

function ensureCenterNode(nodes: Node[], news: NewsItem): Node[] {
  const hasCenter = nodes.some((n) => n.id === "center");
  if (hasCenter) return nodes;
  if (!nodes.length) return MOCK_NODES;

  const [first, ...rest] = nodes;
  const center: Node = {
    ...first,
    id: "center",
    type: "article",
    x: 500,
    y: 320,
    label: news.title.slice(0, 30).toUpperCase(),
    sub: `${news.section.toUpperCase()}\n${Math.round(news.score)}% THREAT`,
    detail: {
      title: news.title,
      body: news.summary || first.detail?.body || "",
      source: news.url || first.detail?.source || "Guardian",
      threat: typeof news.score === "number" ? news.score : first.detail?.threat ?? 60,
      excerpt: first.detail?.excerpt,
      source_url: news.url,
      source_tier: "B",
      source_type: "media",
      why_it_matters: first.detail?.why_it_matters ?? "",
      key_claims: first.detail?.key_claims ?? [],
      uncertainties: first.detail?.uncertainties ?? [],
      counter_evidence: first.detail?.counter_evidence ?? [],
      timeline: first.detail?.timeline ?? [],
      actors: first.detail?.actors ?? [],
      confidence: first.detail?.confidence ?? Math.round((typeof news.score === "number" ? news.score : 60) * 0.9),
      open_questions: first.detail?.open_questions ?? [],
      theory_sources: Array.isArray(first.detail?.theory_sources) ? first.detail.theory_sources : [],
      brave_sources: sanitizeBraveSources(first.detail?.brave_sources),
    },
  };

  return [center, ...rest.map((n, i) => ({ ...n, id: n.id || `node-${i}` }))];
}

function needsRelayout(nodes: Node[]): boolean {
  if (nodes.length < 3) return false;
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  if (width < 420 || height < 220) return true;

  // If too many nodes are close to the center, layout looks collapsed.
  const crowded = nodes.filter((n) => Math.abs(n.x - 500) < 140 && Math.abs(n.y - 320) < 90).length;
  return crowded >= Math.ceil(nodes.length * 0.5);
}

function relayoutNodes(nodes: Node[]): Node[] {
  const center = nodes.find((n) => n.id === "center");
  if (!center) return nodes;
  const others = nodes.filter((n) => n.id !== "center");
  if (!others.length) return nodes;

  // Scale ellipse radius with node count so cards never overlap (each card ~148x62px).
  const n = others.length;
  const minArcGap = 160; // px between node centers along arc
  const arcSpan = Math.PI * 1.7;
  const minRadius = (minArcGap * Math.max(n - 1, 1)) / arcSpan;
  const rx = Math.max(355, minRadius);
  const ry = Math.max(220, minRadius * 0.58);

  const arranged = others
    .slice()
    .sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label))
    .map((node, i) => {
      const angle = (-Math.PI * 0.85) + (i * arcSpan) / Math.max(n - 1, 1);
      return {
        ...node,
        x: Math.round(500 + Math.cos(angle) * rx),
        y: Math.round(320 + Math.sin(angle) * ry),
      };
    });

  return [{ ...center, x: 500, y: 320 }, ...arranged];
}

function mergeOracleTheoriesIntoNodes(nodes: Node[], theories: OracleTheory[] | undefined | null): Node[] {
  const list = Array.isArray(theories) ? theories.filter((t) => t && typeof t === "object") : [];
  if (!list.length) return nodes;

  const used = new Set(nodes.map((n) => n.id));
  const extra: Node[] = list.map((t, i) => {
    const baseId = `theory-${i}`;
    let id = baseId;
    let suf = 0;
    while (used.has(id)) {
      suf += 1;
      id = `${baseId}-${suf}`;
    }
    used.add(id);

    const prob = typeof t.probability === "number" ? Math.max(0, Math.min(100, Math.round(t.probability))) : 50;
    const name =
      typeof t.name === "string" && t.name.trim().length > 0 ? t.name.trim() : `Conspiracy hypothesis ${i + 1}`;
    const label = name.length > 30 ? `${name.slice(0, 29)}…` : name;

    const realSources = Array.isArray(t.sources) ? t.sources : [];
    const realEvidence = Array.isArray(t.evidence) ? t.evidence : [];
    const realCounterEvidence = Array.isArray(t.counter_evidence) ? t.counter_evidence : [];
    const realKeyPeople = Array.isArray(t.key_people) ? t.key_people : [];
    const realTimeline = Array.isArray(t.timeline) ? t.timeline : [];
    const fullExplanation = typeof t.full_explanation === "string" && t.full_explanation.trim().length > 0
      ? t.full_explanation.trim()
      : typeof t.summary === "string" ? t.summary : "";

    const total = list.length;
    const spacing = 180;
    const startX = 500 - ((total - 1) * spacing) / 2;

    return {
      id,
      type: "theory",
      x: startX + i * spacing,
      y: 500,
      label: label.toUpperCase(),
      sub: `${prob}% PLAUSIBILITY`,
      detail: {
        title: name,
        body: fullExplanation,
        source: realSources.length > 0 ? realSources[0] : "See sources below",
        source_url: realSources.find((s) => /^https?:\/\//i.test(s)),
        source_tier: "B",
        source_type: "research",
        key_claims: realEvidence,
        theory_sources: realSources,
        confidence: prob,
        threat: prob,
        why_it_matters: typeof t.summary === "string" && t.summary !== fullExplanation
          ? t.summary
          : `This theory has ${prob}% plausibility based on available evidence.`,
        uncertainties: realCounterEvidence.length > 0
          ? realCounterEvidence
          : ["Independent verification required.", "Mainstream explanations may apply."],
        counter_evidence: realCounterEvidence,
        timeline: realTimeline,
        actors: realKeyPeople,
        open_questions: [],
        brave_sources: sanitizeBraveSources(t.brave_sources),
      },
    } satisfies Node;
  });

  return [...nodes, ...extra];
}

function appendTheoryEdges(edges: Edge[], nodes: Node[]): Edge[] {
  const center = nodes.find((n) => n.id === "center") ?? nodes[0];
  if (!center) return edges;
  const theories = nodes.filter((n) => n.type === "theory");
  if (!theories.length) return edges;

  const keys = new Set(edges.map((e) => `${e.from}|${e.to}`));
  const extra: Edge[] = [];
  for (const tn of theories) {
    const k = `${center.id}|${tn.id}`;
    const rev = `${tn.id}|${center.id}`;
    if (keys.has(k) || keys.has(rev)) continue;
    keys.add(k);
    extra.push({
      from: center.id,
      to: tn.id,
      color: "#c94dff",
      label: "Hypothesized conspiracy narrative",
      strength: 0.62,
    });
  }
  return extra.length ? [...edges, ...extra] : edges;
}

type BoardAccessBlock =
  | { kind: "sign_in" }
  | { kind: "pro_required" }
  | { kind: "error"; message: string };

function BoardAccessGate({
  block,
  backHref,
  backLabel,
}: {
  block: BoardAccessBlock;
  backHref?: string;
  backLabel?: string;
}) {
  const isError = block.kind === "error";
  const title =
    block.kind === "sign_in"
      ? "SIGN IN REQUIRED"
      : block.kind === "pro_required"
        ? "PRO SUBSCRIPTION REQUIRED"
        : "REQUEST FAILED";
  const body =
    block.kind === "sign_in"
      ? "The investigation board needs your session to load or generate the Oracle graph. Create an account or sign in, then open this article again."
      : block.kind === "pro_required"
        ? "There is no saved Oracle analysis for this story yet. Generating a new board is a PRO feature. Upgrade to run the Oracle, or check back later if someone with PRO has already generated it."
        : block.message;

  const border = isError ? "rgba(255,51,51,0.45)" : "rgba(255,170,0,0.55)";
  const glow = isError ? "rgba(255,51,51,0.08)" : "rgba(255,170,0,0.1)";
  const titleColor = isError ? "#ff8888" : "#ffcc88";
  const accent = isError ? "#ff4444" : "#ffaa33";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#050c07",
        color: "#c8e8d0",
        fontFamily: "var(--font-share-tech-mono), monospace",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: `linear-gradient(180deg, ${glow} 0%, transparent 55%)`,
          border: `1px solid ${border}`,
          borderRadius: 6,
          padding: "28px 26px 26px",
          textAlign: "center",
          boxShadow: isError
            ? "0 0 40px rgba(255,51,51,0.12)"
            : "0 0 36px rgba(255,170,0,0.14)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-raj), sans-serif",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 4,
            color: accent,
            marginBottom: 10,
          }}
        >
          {isError ? "◈ ERROR" : "⚠ ACCESS WARNING"}
        </div>
        <h1
          style={{
            fontFamily: "var(--font-raj), sans-serif",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: 2,
            color: titleColor,
            margin: "0 0 14px",
            lineHeight: 1.25,
            textTransform: "uppercase",
          }}
        >
          {title}
        </h1>
        <p style={{ fontSize: 12, color: "#8aaa96", lineHeight: 1.75, margin: "0 0 22px", textAlign: "center" }}>{body}</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "stretch" }}>
          {block.kind === "sign_in" && (
            <Link
              href="/"
              style={{
                display: "block",
                fontFamily: "var(--font-raj), sans-serif",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                padding: "11px 16px",
                border: "1px solid #00bb66",
                background: "rgba(0,255,136,0.08)",
                color: "#00ff88",
                textDecoration: "none",
                borderRadius: 4,
                textAlign: "center",
              }}
            >
              GO TO FEED — SIGN IN OR SIGN UP
            </Link>
          )}
          {block.kind === "pro_required" && (
            <Link
              href="/?auth=signup"
              style={{
                display: "block",
                fontFamily: "var(--font-raj), sans-serif",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                padding: "11px 16px",
                border: "1px solid #00bb66",
                background: "rgba(0,255,136,0.08)",
                color: "#00ff88",
                textDecoration: "none",
                borderRadius: 4,
                textAlign: "center",
              }}
            >
              REGISTER — 30-DAY ANALYST PASS FREE
            </Link>
          )}
          {backHref && (
            <Link
              href={backHref}
              style={{
                display: "block",
                fontSize: 11,
                color: "#5a8068",
                textDecoration: "none",
                border: "1px solid #1a3320",
                padding: "9px 14px",
                borderRadius: 4,
                textAlign: "center",
              }}
            >
              {backLabel ?? "← BACK"}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function inferRelationLabel(fromType: NodeType, toType: NodeType): string {
  const pair = `${fromType}->${toType}`;
  const map: Record<string, string> = {
    "article->patent": "Related patent evidence",
    "article->foia": "Historical intelligence link",
    "article->company": "Industry actor connection",
    "article->event": "Public narrative event",
    "article->person": "Expert/critic signal",
    "article->theory": "Hypothesized conspiracy narrative",
    "patent->theory": "Tech narrative overlap",
    "foia->theory": "Declassified-doc narrative hook",
    "company->theory": "Actor–narrative alignment",
    "event->theory": "Event–narrative framing",
    "person->theory": "Figure tied to narrative",
    "theory->article": "Narrative explains headline angle",
    "patent->patent": "Patent cross-reference",
    "foia->event": "Historical pattern match",
    "company->event": "Funding/public influence link",
  };
  return map[pair] ?? "Contextual relationship";
}

function normalizeEdgeLabel(raw: unknown, fromNode: Node, toNode: Node): string {
  const label = typeof raw === "string" ? raw.trim() : "";
  const isGeneric =
    !label ||
    /^connection$/i.test(label) ||
    /^link$/i.test(label);
  if (!isGeneric) return label;
  return inferRelationLabel(fromNode.type, toNode.type);
}

function sanitizeEdges(edges: unknown, nodes: Node[]): Edge[] {
  if (!Array.isArray(edges)) return MOCK_EDGES;
  const nodeIds = new Set(nodes.map((n) => n.id));
  const mapped = edges
    .map((edge) => {
      if (!edge || typeof edge !== "object") return null;
      const e = edge as Partial<Edge>;
      if (typeof e.from !== "string" || typeof e.to !== "string") return null;
      if (!nodeIds.has(e.from) || !nodeIds.has(e.to)) return null;
      const fromNode = nodes.find((n) => n.id === e.from);
      const toNode = nodes.find((n) => n.id === e.to);
      if (!fromNode || !toNode) return null;
      return {
        from: e.from,
        to: e.to,
        color: typeof e.color === "string" ? e.color : "#5a8068",
        label: normalizeEdgeLabel(e.label, fromNode, toNode),
        strength: typeof e.strength === "number" && e.strength > 0 ? e.strength : 0.5,
      } satisfies Edge;
    })
    .filter(Boolean) as Edge[];
  if (mapped.length) return mapped;

  // Fallback: auto-wire a graph around center for stable visual.
  const center = nodes.find((n) => n.id === "center") ?? nodes[0];
  return nodes
    .filter((n) => n.id !== center.id)
    .map((n, i) => ({
      from: center.id,
      to: n.id,
      color: ["#ff3333", "#ffaa00", "#5a8068", "#00bb66"][i % 4],
      label: inferRelationLabel(center.type, n.type),
      strength: 0.6,
    }));
}

export default function BoardScreen({
  news,
  initialAnalysis,
  backHref,
  backLabel,
  oracleMode = "news",
}: {
  news: NewsItem;
  initialAnalysis: OracleAnalysis | null;
  backHref?: string;
  backLabel?: string;
  oracleMode?: "news" | "generated";
}) {
  const [analysis, setAnalysis] = useState<OracleAnalysis | null>(initialAnalysis);
  const [selected, setSelected] = useState<Node | null>(analysis?.nodes?.[0] ?? MOCK_NODES[0]);
  const [loading, setLoading] = useState(!initialAnalysis);
  const [accessBlock, setAccessBlock] = useState<BoardAccessBlock | null>(null);

  const fetchOracle = useCallback(async () => {
    try {
      setAccessBlock(null);
      setLoading(true);
      const supabase = getSupabaseBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setAccessBlock({ kind: "sign_in" });
        return;
      }
      const res = await fetch("/api/oracle", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(
          oracleMode === "generated" ? { generatedArticleId: news.id } : { newsId: news.id },
        ),
      });
      let payload: { error?: string; message?: string } = {};
      try {
        payload = (await res.json()) as { error?: string; message?: string };
      } catch {
        payload = {};
      }
      if (!res.ok) {
        if (res.status === 403 && payload.error === "upgrade_required") {
          setAccessBlock({ kind: "pro_required" });
          return;
        }
        if (res.status === 401) {
          setAccessBlock({ kind: "sign_in" });
          return;
        }
        const detail = [payload.message, payload.error].filter(Boolean).join(" — ");
        setAccessBlock({
          kind: "error",
          message: detail || `Oracle request failed (${res.status}).`,
        });
        return;
      }
      setAnalysis(payload as OracleAnalysis);
      setSelected((payload as OracleAnalysis).nodes?.[0] ?? MOCK_NODES[0]);
    } catch (e) {
      setAccessBlock({
        kind: "error",
        message: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [news.id, oracleMode]);

  useEffect(() => {
    if (analysis) return;
    void fetchOracle();
  }, [analysis, fetchOracle]);

  if (loading) {
    return <OracleLoadingScreen />;
  }

  if (accessBlock) {
    return <BoardAccessGate block={accessBlock} backHref={backHref} backLabel={backLabel} />;
  }

  const normalized = ensureCenterNode(sanitizeNodes(analysis?.nodes), news);
  const withTheories = mergeOracleTheoriesIntoNodes(normalized, analysis?.theories);
  // Always relayout when theories are present so they never overlap other nodes.
  const hasTheories = withTheories.some((n) => n.type === "theory");
  const nodes = (hasTheories || needsRelayout(withTheories)) ? relayoutNodes(withTheories) : withTheories;
  const edges = appendTheoryEdges(sanitizeEdges(analysis?.edges, nodes), nodes);
  const safeSelected = nodes.find((n) => n.id === selected?.id) ?? nodes[0];
  const handleNodeClick = (node: Node | null) => {
    if (!node) {
      setSelected(null);
      return;
    }
    setSelected((prev) => (prev?.id === node.id ? null : node));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <div style={{ flex: 1, minHeight: 0 }}>
        <InvestigationBoard
          nodes={nodes}
          edges={edges}
          selectedNode={selected ? safeSelected : null}
          onNodeClick={handleNodeClick}
          conclusion={analysis?.conclusion}
          verdict={analysis?.verdict}
          analysisSources={analysis?.sources}
          articleTitle={news.title}
          polymarketContext={buildBoardPolymarketContext(news, analysis)}
          backHref={backHref}
          backLabel={backLabel}
        />
      </div>
    </div>
  );
}
