import type { NodeDetail, NodeType } from "@/types";

/** Display score for a board node — prefers confidence for non-article nodes. */
export function nodeDisplayScore(type: NodeType, detail: NodeDetail): number | null {
  const conf = typeof detail.confidence === "number" ? detail.confidence : null;
  const threat = typeof detail.threat === "number" ? detail.threat : null;

  if (type === "article") return threat ?? conf;
  if (type === "theory") return conf ?? threat;
  if (conf !== null) return conf;
  // Legacy boards defaulted missing scores to 50 — treat as unknown for non-article nodes.
  if (threat !== null && threat !== 50) return threat;
  return null;
}

export function nodeScoreLabelShort(type: NodeType): string {
  switch (type) {
    case "article":
      return "THREAT";
    case "theory":
      return "PLAUSIBILITY";
    case "company":
      return "RELEVANCE";
    case "person":
      return "INVOLVEMENT";
    case "event":
      return "SIGNIFICANCE";
    case "patent":
    case "foia":
      return "EVIDENCE";
    default:
      return "SIGNAL";
  }
}

export function nodeScoreLabelLong(type: NodeType): string {
  switch (type) {
    case "article":
      return "Threat level";
    case "theory":
      return "Plausibility (model)";
    case "company":
      return "Investigation relevance";
    case "person":
      return "Involvement in story";
    case "event":
      return "Event significance";
    case "patent":
    case "foia":
      return "Evidence strength";
    default:
      return "Signal strength";
  }
}

export function nodeScoreHint(type: NodeType): string {
  switch (type) {
    case "article":
      return "Conspiracy / cover-up potential of the headline — not a physical danger rating.";
    case "theory":
      return "Model estimate of how plausible this documented theory is (0–100%).";
    case "company":
      return "How strongly this company connects to the investigation — not a danger rating.";
    case "person":
      return "How central this person is to the story network — not a danger rating.";
    case "event":
      return "How significant this event is for interpreting the main story.";
    case "patent":
    case "foia":
      return "How strongly this document supports the connection map.";
    default:
      return "Model relevance score for this node in the graph.";
  }
}

export function nodeScoreColor(score: number): string {
  if (score >= 65) return "#ff3333";
  if (score >= 45) return "#ffaa00";
  return "#00bb66";
}

export function maxNodeDisplayScore(
  nodes: Array<{ type: NodeType; detail: NodeDetail }>,
): number | null {
  let max: number | null = null;
  for (const n of nodes) {
    const s = nodeDisplayScore(n.type, n.detail);
    if (s !== null && (max === null || s > max)) max = s;
  }
  return max;
}
