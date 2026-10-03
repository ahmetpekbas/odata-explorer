import type { Graph } from '../../csdl/graph.ts';
import type { Size } from './size.ts';

export interface Point {
  x: number;
  y: number;
}

const GAP = 60;

/** The position of every node, by ID. Asynchronous because the real layout will run in a worker. */
export function layoutGraph(graph: Graph, sizes: Map<string, Size>): Promise<Map<string, Point>> {
  const columns = Math.max(1, Math.ceil(Math.sqrt(graph.nodes.length)));
  const positions = new Map<string, Point>();
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  graph.nodes.forEach((node, i) => {
    const size = sizes.get(node.id) ?? { width: 0, height: 0 };
    if (i > 0 && i % columns === 0) {
      x = 0;
      y += rowHeight + GAP;
      rowHeight = 0;
    }
    positions.set(node.id, { x, y });
    x += size.width + GAP;
    rowHeight = Math.max(rowHeight, size.height);
  });
  return Promise.resolve(positions);
}
