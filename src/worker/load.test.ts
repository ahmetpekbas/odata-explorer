import { describe, expect, it } from 'vitest';
import trippin from '../../fixtures/trippin.xml?raw';
import miscellaneous from '../../fixtures/csdl-schemas/miscellaneous.json?raw';
import { detectFormat, load, type Progress } from './load.ts';

describe('detectFormat', () => {
  it('looks at the first non-whitespace character', () => {
    expect(detectFormat('﻿  \n<edmx:Edmx/>')).toBe('xml');
    expect(detectFormat('\n {"$Version":"4.0"}')).toBe('json');
    expect(detectFormat('hello')).toBeUndefined();
    expect(detectFormat('  ')).toBeUndefined();
  });
});

describe('load', () => {
  it('parses and resolves XML, reporting progress by characters', () => {
    const text = trippin;
    const events: Progress[] = [];
    const result = load(text, (p) => events.push(p));
    if (!result.ok) throw new Error(result.error);
    expect(result.resolved.model.format).toBe('xml');
    expect(
      result.resolved.elements.has('Microsoft.OData.SampleService.Models.TripPin.Person'),
    ).toBe(true);
    expect(events[0]).toEqual({ stage: 'parsing', done: 0, total: text.length });
    expect(events.some((e) => e.stage === 'parsing' && e.done === text.length)).toBe(true);
    expect(events.at(-1)?.stage).toBe('resolving');
  });

  it('parses CSDL JSON', () => {
    const text = miscellaneous;
    const result = load(text);
    if (!result.ok) throw new Error(result.error);
    expect(result.resolved.model.format).toBe('json');
  });

  it('returns a result that survives structured clone', () => {
    const result = load(trippin);
    if (!result.ok) throw new Error(result.error);
    const copy = structuredClone(result.resolved);
    expect(copy.elements.size).toBe(result.resolved.elements.size);
  });

  it('reports unrecognized input as data', () => {
    const result = load('not metadata');
    expect(result).toMatchObject({ ok: false });
  });

  it('keeps syntax problems as diagnostics', () => {
    const result = load('<edmx:Edmx');
    if (!result.ok) throw new Error(result.error);
    expect(result.resolved.model.diagnostics.some((d) => d.severity === 'error')).toBe(true);
  });
});
