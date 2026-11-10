import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutOracleNodes } from '../src/lib/oracleLayout';
import type { Edge, Node } from '../src/types';

/**
 * The layout exists because the model's own x/y overlapped past ~5 nodes, hiding the very
 * connections the graph is for. These guard the two properties that makes it worth having:
 * boxes never collide, and distance from the centre equals the prompt's layer depth.
 */
const node = (id: string, type: Node['type'] = 'person'): Node => ({
  id, type, x: 0, y: 0, label: id.toUpperCase(), sub: '',
  detail: { title: id, body: '', source: '', threat: 50 },
});
const edge = (from: string, to: string): Edge => ({ from, to, color: '#ff3333', label: 'linked', strength: 0.6 });

/** A node box is ~150x90; anything closer than this overlaps on screen. */
const MIN_GAP = 150;

function closestPair(nodes: Node[]): number {
  let min = Infinity;
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      min = Math.min(min, Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y));
    }
  }
  return min;
}

test('the article node anchors the centre of the canvas', () => {
  const laid = layoutOracleNodes([node('center', 'article'), node('a')], [edge('center', 'a')]);
  const centre = laid.find((n) => n.id === 'center')!;
  assert.deepEqual([centre.x, centre.y], [500, 320]);
});

test('a ring grows to fit its nodes rather than letting boxes overlap', () => {
  // Fourteen direct spokes is the case the old layout could not draw at all.
  const spokes = Array.from({ length: 14 }, (_, i) => node(`n${i}`));
  const nodes = [node('center', 'article'), ...spokes];
  const laid = layoutOracleNodes(nodes, spokes.map((s) => edge('center', s.id)));
  assert.equal(laid.length, 15);
  assert.ok(closestPair(laid) >= MIN_GAP, `closest pair was ${closestPair(laid).toFixed(0)}px`);
});

test('distance from the centre tracks the layer depth of a chain', () => {
  const nodes = [node('center', 'article'), node('l1'), node('l2'), node('l3', 'foia')];
  const laid = layoutOracleNodes(nodes, [edge('center', 'l1'), edge('l1', 'l2'), edge('l2', 'l3')]);
  const r = (id: string) => {
    const n = laid.find((x) => x.id === id)!;
    return Math.hypot(n.x - 500, n.y - 320);
  };
  assert.ok(r('l1') < r('l2'), 'layer 2 must sit outside layer 1');
  assert.ok(r('l2') < r('l3'), 'layer 3 must sit outside layer 2');
});

test('an unconnected evidence node is placed beyond everything linked, not on top of it', () => {
  const nodes = [node('center', 'article'), node('l1'), node('l2'), node('loose', 'foia')];
  const laid = layoutOracleNodes(nodes, [edge('center', 'l1'), edge('l1', 'l2')]);
  const r = (id: string) => {
    const n = laid.find((x) => x.id === id)!;
    return Math.hypot(n.x - 500, n.y - 320);
  };
  assert.ok(r('loose') > r('l2'), 'an orphan belongs outside the mapped graph');
  assert.ok(closestPair(laid) >= MIN_GAP);
});

test('layout is deterministic, so a re-render never reshuffles the board', () => {
  const nodes = [node('center', 'article'), node('b'), node('a'), node('c')];
  const edges = [edge('center', 'a'), edge('center', 'b'), edge('a', 'c')];
  assert.deepEqual(layoutOracleNodes(nodes, edges), layoutOracleNodes(nodes, edges));
});

test('edges naming a node that does not exist cannot break the layout', () => {
  const nodes = [node('center', 'article'), node('a')];
  const laid = layoutOracleNodes(nodes, [edge('center', 'ghost'), edge('a', 'center'), edge('a', 'a')]);
  assert.equal(laid.length, 2);
  assert.ok(laid.every((n) => Number.isFinite(n.x) && Number.isFinite(n.y)));
});
