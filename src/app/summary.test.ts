import { describe, expect, it } from 'vitest';
import { load } from '../worker/load.ts';
import trippin from '../../fixtures/trippin.xml?raw';
import { countElements } from './summary.ts';

describe('countElements', () => {
  it('totals types and sets over the schemas', () => {
    const result = load(trippin);
    if (!result.ok) throw new Error(result.error);
    const counts = countElements(result.resolved);
    expect(counts.entityTypes).toBeGreaterThan(0);
    expect(counts.entitySets).toBeGreaterThan(0);
    expect(counts.singletons).toBe(1);
  });
});
