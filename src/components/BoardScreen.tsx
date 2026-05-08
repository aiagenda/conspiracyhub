"use client";

import { useEffect, useMemo, useState } from "react";
import InvestigationBoard from "@/components/InvestigationBoard";
import OracleLoadingScreen from "@/components/OracleLoadingScreen";
import { MOCK_EDGES, MOCK_NODES } from "@/lib/mockData";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Edge, NewsItem, Node, OracleAnalysis, NodeType, OracleTheory } from "@/types";

const VALID_NODE_TYPES: NodeType[] = ["article", "patent", "foia", "company", "event", "person", "theory"];

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
      return {
        id: typeof n.id === "string" && n.id ? n.id : `node-${index}`,
        type: n.type ? sanitizeNodeType(n.type) : inferNodeType(safeLabel),
        x: typeof n.x === "number" ? n.x : 500,
        y: typeof n.y === "number" ? n.y : 320,
        label: safeLabel,
        sub: typeof n.sub === "string" ? n.sub : "",
        detail: {
          title: n.detail?.title ?? safeLabel,
          body: n.detail?.body ?? "",
          source: n.detail?.source ?? "Unknown source",
          threat: typeof n.detail?.threat === "number" ? n.detail.threat : 50,
          source_url: n.detail?.source_url,
          source_tier: n.detail?.source_tier ?? "B",
          source_type: n.detail?.source_type ?? "media",
          why_it_matters: n.detail?.why_it_matters ?? "",
          key_claims: Array.isArray(n.detail?.key_claims) ? n.detail.key_claims : [],
          uncertainties: Array.isArray(n.detail?.uncertainties) ? n.detail.uncertainties : [],
          counter_evidence: Array.isArray(n.detail?.counter_evidence) ? n.detail.counter_evidence : [],
          timeline: Array.isArray(n.detail?.timeline) ? n.detail.timeline : [],
          actors: Array.isArray(n.detail?.actors) ? n.detail.actors : [],
          confidence:
            typeof n.detail?.confidence === "number"
              ? Math.max(0, Math.min(100, n.detail.confidence))
              : Math.round((typeof n.detail?.threat === "number" ? n.detail.threat : 50) * 0.9),
          open_questions: Array.isArray(n.detail?.open_questions) ? n.detail.open_questions : [],
          theory_sources: Array.isArray(n.detail?.theory_sources) ? n.detail.theory_sources : [],
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

  // Claude-like constellation: distribute around center in a wide ellipse.
  const arranged = others
    .slice()
    .sort((a, b) => a.type.localeCompare(b.type) || a.label.localeCompare(b.label))
    .map((n, i) => {
      const angle = (-Math.PI * 0.85) + (i * (Math.PI * 1.7)) / Math.max(others.length - 1, 1);
      const rx = 355;
      const ry = 205;
      return {
        ...n,
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

    return {
      id,
      type: "theory",
      x: 500,
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
    /^kapcsolat$/i.test(label) ||
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
}: {
  news: NewsItem;
  initialAnalysis: OracleAnalysis | null;
}) {
  const [analysis, setAnalysis] = useState<OracleAnalysis | null>(initialAnalysis);
  const [selected, setSelected] = useState<Node | null>(analysis?.nodes?.[0] ?? MOCK_NODES[0]);
  const [loading, setLoading] = useState(!initialAnalysis);
  const [error, setError] = useState("");

  useEffect(() => {
    if (analysis) return;
    (async () => {
      try {
        setLoading(true);
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setError("No signed-in user found.");
          return;
        }
        const res = await fetch("/api/oracle", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ newsId: news.id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Oracle request failed");
        setAnalysis(data);
        setSelected(data.nodes?.[0] ?? MOCK_NODES[0]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, [analysis, news.id]);

  const graphNodes = useMemo(() => {
    const normalized = ensureCenterNode(sanitizeNodes(analysis?.nodes), news);
    const withTheories = mergeOracleTheoriesIntoNodes(normalized, analysis?.theories);
    return needsRelayout(withTheories) ? relayoutNodes(withTheories) : withTheories;
  }, [analysis, news]);

  const graphEdges = useMemo(
    () => appendTheoryEdges(sanitizeEdges(analysis?.edges, graphNodes), graphNodes),
    [analysis, graphNodes],
  );

  if (loading) {
    return <OracleLoadingScreen />;
  }

  if (error) {
    return <div className="min-h-screen bg-[#050c07] text-[#ff3333] p-6">[ERROR] {error}</div>;
  }

  const safeSelected = graphNodes.find((n) => n.id === selected?.id) ?? graphNodes[0];
  const handleNodeClick = (node: Node | null) => {
    if (!node) {
      setSelected(null);
      return;
    }
    setSelected((prev) => (prev?.id === node.id ? null : node));
  };

  return (
    <InvestigationBoard
      nodes={graphNodes}
      edges={graphEdges}
      selectedNode={selected ? safeSelected : null}
      onNodeClick={handleNodeClick}
      conclusion={analysis?.conclusion}
      verdict={analysis?.verdict}
      analysisSources={analysis?.sources}
    />
  );
}
