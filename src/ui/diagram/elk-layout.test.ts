import { describe, expect, it } from 'vitest';
import ELK from 'elkjs/lib/elk.bundled.js';
import { elkLayout as layout, type LayoutRequest } from './elk-layout.ts';

// Node has no browser worker; the bundled build runs the layout in this thread.
const elkLayout = (request: LayoutRequest) => layout(new ELK(), request);

const size = { width: 260, height: 100 };

describe('elkLayout', () => {
  it('places linked nodes in layers, left to right, without overlap', async () => {
    const result = await elkLayout({
      nodes: [
        { id: 'A', ...size },
        { id: 'B', ...size },
        { id: 'C', ...size },
      ],
      edges: [
        { id: 'ab', source: 'A', target: 'B' },
        { id: 'ac', source: 'A', target: 'C' },
      ],
    });
    const { A, B, C } = result.nodes;
    if (!A || !B || !C) throw new Error('a node was not placed');
    expect(B.x).toBeGreaterThan(A.x + size.width);
    expect(C.x).toBe(B.x);
    expect(Math.abs(B.y - C.y)).toBeGreaterThanOrEqual(size.height);
    // Each edge is routed from the border of its source to the border of its target.
    const route = result.edges['ab'];
    expect(route?.[0]?.x).toBeCloseTo(A.x + size.width);
    expect(route?.at(-1)?.x).toBeCloseTo(B.x);
  });

  it('ignores loops and edges to nodes that are not there', async () => {
    const result = await elkLayout({
      nodes: [{ id: 'A', ...size }],
      edges: [
        { id: 'loop', source: 'A', target: 'A' },
        { id: 'gone', source: 'A', target: 'Z' },
      ],
    });
    expect(Object.keys(result.nodes)).toEqual(['A']);
    expect(result.edges).toEqual({});
  });
});
