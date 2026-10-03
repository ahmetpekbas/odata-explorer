// Layered layout with elkjs. Takes and returns plain data; where elkjs runs is up to the caller's `ELK`.
import type { ELK, ElkExtendedEdge } from 'elkjs/lib/elk-api.js';

export interface LayoutRequest {
  nodes: { id: string; width: number; height: number }[];
  edges: { id: string; source: string; target: string }[];
}

export interface Point {
  x: number;
  y: number;
}

export interface LayoutResult {
  /** Top-left corner of every node, by ID. */
  nodes: Record<string, Point>;
  /** The route of every edge that was laid out, from the source to the target, by ID. */
  edges: Record<string, Point[]>;
}

export type Layout = (request: LayoutRequest) => Promise<LayoutResult>;

const OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '40',
  // Room between the layers for the labels on the edges.
  'elk.layered.spacing.nodeNodeBetweenLayers': '140',
  'elk.layered.spacing.edgeNodeBetweenLayers': '30',
};

export async function elkLayout(elk: ELK, { nodes, edges }: LayoutRequest): Promise<LayoutResult> {
  const ids = new Set(nodes.map((n) => n.id));
  const laidOut = await elk.layout({
    id: 'root',
    layoutOptions: OPTIONS,
    children: nodes,
    // A loop back to the same node is drawn over the top of it, outside the layout.
    edges: edges
      .filter((e) => e.source !== e.target && ids.has(e.source) && ids.has(e.target))
      .map((e) => ({ id: e.id, sources: [e.source], targets: [e.target] })),
  });
  const result: LayoutResult = { nodes: {}, edges: {} };
  for (const child of laidOut.children ?? [])
    result.nodes[child.id] = { x: child.x ?? 0, y: child.y ?? 0 };
  for (const edge of laidOut.edges ?? []) {
    const [section] = (edge as ElkExtendedEdge).sections ?? [];
    if (section) {
      result.edges[edge.id] = [section.startPoint, ...(section.bendPoints ?? []), section.endPoint];
    }
  }
  return result;
}
