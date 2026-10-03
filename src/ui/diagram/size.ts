import type { GraphNode } from '../../csdl/graph.ts';

export const NODE_WIDTH = 260;
export const NODE_METRICS = { header: 34, row: 22, sectionPad: 10 };

export interface Size {
  width: number;
  height: number;
}

/** The rows a node shows, in sections: its key, its navigation properties, and when expanded the rest. */
export function sectionsOf(node: GraphNode, showAll: boolean) {
  const key = new Set(node.key);
  const sections = [
    { id: 'key', rows: node.properties.filter((p) => key.has(p.name)) },
    { id: 'navigations', rows: node.navigations },
    { id: 'properties', rows: showAll ? node.properties.filter((p) => !key.has(p.name)) : [] },
  ];
  return sections.filter((s) => s.rows.length > 0);
}

/** Layout needs the size of a node before it is drawn, so the node renders to exactly this size. */
export function sizeOf(node: GraphNode, showAll: boolean): Size {
  const sections = sectionsOf(node, showAll);
  const rows = sections.reduce((n, s) => n + s.rows.length, 0);
  const { header, row, sectionPad } = NODE_METRICS;
  return { width: NODE_WIDTH, height: header + rows * row + sections.length * sectionPad };
}
