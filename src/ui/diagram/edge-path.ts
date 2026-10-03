import type { Point } from './elk-layout.ts';

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** The point `by` away from `from`, towards `to`. */
const towards = (from: Point, to: Point, by: number): Point => {
  const length = distance(from, to) || 1;
  return {
    x: from.x + ((to.x - from.x) / length) * by,
    y: from.y + ((to.y - from.y) / length) * by,
  };
};

/** An SVG path through the points, its corners rounded. */
export function roundedPath(points: Point[], radius = 8): string {
  const [first, ...rest] = points;
  if (!first) return '';
  let path = `M ${first.x} ${first.y}`;
  rest.forEach((point, i) => {
    const previous = points[i];
    const next = rest[i + 1];
    if (!previous || !next) {
      path += ` L ${point.x} ${point.y}`;
      return;
    }
    // The curve starts and ends at most halfway along the segments on either side of the corner.
    const before = towards(point, previous, Math.min(radius, distance(previous, point) / 2));
    const after = towards(point, next, Math.min(radius, distance(point, next) / 2));
    path += ` L ${before.x} ${before.y} Q ${point.x} ${point.y} ${after.x} ${after.y}`;
  });
  return path;
}

/** The middle of the longest segment, where the name of an edge goes. */
export function midpoint(points: Point[]): Point {
  let best: [Point, Point] | undefined;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a && b && (!best || distance(a, b) > distance(...best))) best = [a, b];
  }
  const [a, b] = best ?? [points[0] ?? { x: 0, y: 0 }, points[0] ?? { x: 0, y: 0 }];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * Where the cardinality at one end of an edge goes: a little way along the first segment, off to the
 * side so it clears the line. `end` is the point on the node, `inner` the next point of the route.
 */
export function endLabel(end: Point, inner: Point): Point {
  const along = towards(end, inner, 18);
  const length = distance(end, inner) || 1;
  const side = { x: (inner.y - end.y) / length, y: -(inner.x - end.x) / length };
  return { x: along.x + side.x * 10, y: along.y + side.y * 10 };
}
