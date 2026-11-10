import type { Edge, Node } from "@/types";

/**
 * Node coordinates come from the model, which is bad at geometry: with more than about
 * five nodes its boxes overlap, and the layers the prompt asks for are not visible in
 * the result. Positions are therefore recomputed here from the graph itself, as a radial
 * tree rooted at the article node, so distance from the centre *means* the prompt's
 * layer depth. InvestigationBoard fits and scales whatever it is given
 * (`computeFitTransform`), so a layout wider than the 1000x640 canvas is safe — only the
 * relative geometry matters.
 */
const CENTER_X = 500;
const CENTER_Y = 320;
/** A node box is ~150px wide; this much arc per node keeps a ring from colliding. */
const ARC_PER_NODE = 200;
const RING_GAP = 190;
const FIRST_ANGLE = -Math.PI / 2;

function neighbourMap(nodes: Node[], edges: Edge[]): Map<string, string[]> {
  const ids = new Set(nodes.map((n) => n.id));
  const map = new Map<string, string[]>(nodes.map((n) => [n.id, []] as const));
  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) continue;
    map.get(edge.from)!.push(edge.to);
    map.get(edge.to)!.push(edge.from);
  }
  return map;
}

function rootId(nodes: Node[]): string {
  return (nodes.find((n) => n.id === "center") ?? nodes.find((n) => n.type === "article") ?? nodes[0]).id;
}

/** Recompute x/y as a radial tree. Pure and deterministic: same graph, same positions. */
export function layoutOracleNodes(nodes: Node[], edges: Edge[]): Node[] {
  if (nodes.length <= 1) {
    return nodes.map((n) => ({ ...n, x: CENTER_X, y: CENTER_Y }));
  }

  const root = rootId(nodes);
  const neighbours = neighbourMap(nodes, edges);
  const byId = new Map(nodes.map((n) => [n.id, n] as const));

  // BFS from the article node: depth is the layer, and the discovering node is the parent
  // whose angle a child is placed next to.
  const depth = new Map<string, number>([[root, 0]]);
  const parent = new Map<string, string>();
  const queue = [root];
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i];
    for (const next of [...neighbours.get(current)!].sort()) {
      if (depth.has(next)) continue;
      depth.set(next, depth.get(current)! + 1);
      parent.set(next, current);
      queue.push(next);
    }
  }

  // A node the article does not reach still has to go somewhere: it sits one ring beyond
  // everything connected, which reads correctly — it is evidence with no mapped link yet.
  const reachedMax = Math.max(0, ...[...depth.values()]);
  const orphanDepth = reachedMax + 1;
  for (const node of nodes) if (!depth.has(node.id)) depth.set(node.id, orphanDepth);

  const rings = new Map<number, string[]>();
  for (const node of nodes) {
    const d = depth.get(node.id)!;
    if (d === 0) continue;
    const ring = rings.get(d) ?? [];
    ring.push(node.id);
    rings.set(d, ring);
  }

  const angle = new Map<string, number>([[root, 0]]);
  const placed = new Map<string, { x: number; y: number }>([[root, { x: CENTER_X, y: CENTER_Y }]]);

  for (const d of [...rings.keys()].sort((a, b) => a - b)) {
    const ring = rings.get(d)!;
    // Ordering a ring by its parents' angles keeps children beside their parent, which is
    // what stops the spokes crossing; even spacing then guarantees no two boxes collide.
    ring.sort((a, b) => {
      const pa = angle.get(parent.get(a) ?? root) ?? 0;
      const pb = angle.get(parent.get(b) ?? root) ?? 0;
      return pa - pb || a.localeCompare(b);
    });
    const radius = Math.max(RING_GAP * d, (ring.length * ARC_PER_NODE) / (2 * Math.PI));
    // Odd rings are offset by half a step so a node never hides the one behind it.
    const offset = d % 2 === 0 ? Math.PI / ring.length : 0;
    ring.forEach((id, index) => {
      const theta = FIRST_ANGLE + offset + (index * 2 * Math.PI) / ring.length;
      angle.set(id, theta);
      placed.set(id, {
        x: Math.round(CENTER_X + radius * Math.cos(theta)),
        y: Math.round(CENTER_Y + radius * Math.sin(theta)),
      });
    });
  }

  return nodes.map((node) => ({ ...node, ...(placed.get(node.id) ?? { x: byId.get(node.id)!.x, y: byId.get(node.id)!.y }) }));
}
