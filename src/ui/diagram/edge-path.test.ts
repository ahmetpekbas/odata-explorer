import { describe, expect, it } from 'vitest';
import { endLabel, midpoint, roundedPath } from './edge-path.ts';

describe('roundedPath', () => {
  it('is a straight line for two points', () => {
    expect(
      roundedPath([
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ]),
    ).toBe('M 0 0 L 100 0');
  });

  it('rounds the corners, never further than halfway along a short segment', () => {
    const path = roundedPath(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 10 },
        { x: 200, y: 10 },
      ],
      8,
    );
    expect(path).toBe('M 0 0 L 92 0 Q 100 0 100 5 L 100 5 Q 100 10 108 10 L 200 10');
  });

  it('has nothing to draw without points', () => {
    expect(roundedPath([])).toBe('');
  });
});

describe('midpoint', () => {
  it('is the middle of the longest segment', () => {
    expect(
      midpoint([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 100 },
      ]),
    ).toEqual({ x: 10, y: 50 });
  });
});

describe('endLabel', () => {
  it('sits along the first segment, to one side of it', () => {
    const label = endLabel({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(label.x).toBe(18);
    expect(Math.abs(label.y)).toBe(10);
  });
});
