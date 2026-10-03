import { describe, expect, it } from 'vitest';
import northwind from '../../fixtures/northwind.xml?raw';
import trippin from '../../fixtures/trippin.xml?raw';
import { load } from './load.ts';
import { assemble, splitResult } from './transfer.ts';

function loaded(text: string) {
  const result = load(text);
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe('transfer', () => {
  it.each([
    ['TripPin', trippin],
    ['Northwind', northwind],
  ])('rebuilds the %s result exactly from its pieces', (_name, text) => {
    const { resolved, index } = loaded(text);
    // Pieces cross a worker boundary by structured clone; do the same here.
    const pieces = [...splitResult(resolved, index)].map((piece) => structuredClone(piece));
    const back = assemble(pieces);
    expect(back.resolved).toEqual(resolved);
    expect(back.index).toEqual(index);
    expect([...back.resolved.elements.keys()]).toEqual([...resolved.elements.keys()]);
  });

  it('sends the model head first, with the schemas emptied', () => {
    const { resolved, index } = loaded(northwind);
    const pieces = [...splitResult(resolved, index)];
    expect(pieces[0]?.kind).toBe('head');
    expect(pieces.length).toBeGreaterThan(3);
    const head = pieces[0];
    if (head?.kind !== 'head') throw new Error('no head');
    expect(head.model.schemas.every((s) => s.entityTypes.length === 0)).toBe(true);
  });

  it('fails without a model', () => {
    expect(() => assemble([])).toThrow('no model');
  });
});
