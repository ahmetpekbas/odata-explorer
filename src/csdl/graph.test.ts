import { describe, expect, it } from 'vitest';
import { load } from '../worker/load.ts';
import { buildGraph } from './graph.ts';
import type { Resolved } from './resolve.ts';
import { northwindXml, trippinXml } from './test-fixtures.ts';

const NS = 'Microsoft.OData.SampleService.Models.TripPin';

function resolved(text: string): Resolved {
  const result = load(text);
  if (!result.ok) throw new Error(result.error);
  return result.resolved;
}

const trippin = resolved(trippinXml);
const northwind = resolved(northwindXml);
const names = (g: { nodes: { name: string }[] }) => g.nodes.map((n) => n.name).sort();

describe('buildGraph', () => {
  it('shows the types one hop from Person, with the edges between them', () => {
    const g = buildGraph(trippin, `${NS}.Person`, { hops: 1, inheritance: true });
    expect(names(g)).toEqual(['Person', 'Photo', 'Trip']);
    expect(g.edges.map((e) => [e.label, e.kind, e.targetCardinality]).sort()).toEqual([
      ['Friends', 'navigation', '*'],
      ['Photo', 'navigation', '0..1'],
      ['Photos', 'navigation', '*'],
      ['Trips', 'containment', '*'],
    ]);
    const friends = g.edges.find((e) => e.label === 'Friends');
    expect(friends).toMatchObject({ source: `${NS}.Person`, target: `${NS}.Person` });
  });

  it('describes a node by its key, properties and navigation properties', () => {
    const g = buildGraph(trippin, `${NS}.Person`, { hops: 1, inheritance: true });
    const person = g.nodes.find((n) => n.name === 'Person');
    expect(person?.key).toEqual(['UserName']);
    expect(person?.properties[0]).toEqual({ name: 'UserName', type: 'String' });
    expect(person?.navigations.map((n) => n.name)).toEqual(['Friends', 'Trips', 'Photo']);
    expect(person?.navigations[0]?.type).toBe('Collection(Person)');
  });

  it('reaches further with more hops, and counts distance in both directions', () => {
    const two = buildGraph(trippin, `${NS}.Person`, { hops: 2, inheritance: false });
    expect(names(two)).toEqual(['Person', 'Photo', 'PlanItem', 'Trip']);
    const fromPhoto = buildGraph(trippin, `${NS}.Photo`, { hops: 1, inheritance: false });
    expect(names(fromPhoto)).toEqual(['Person', 'Photo', 'Trip']);
  });

  it('gives each node its inherited navigation properties', () => {
    const g = buildGraph(trippin, `${NS}.Flight`, { hops: 1, inheritance: false });
    expect(names(g)).toEqual(['Airline', 'Airport', 'Flight']);
    const flight = g.nodes.find((n) => n.name === 'Flight');
    expect(flight?.key).toEqual(['PlanItemId']);
  });

  it('adds inheritance edges from derived to base type, only when asked', () => {
    const on = buildGraph(trippin, `${NS}.PublicTransportation`, { hops: 1, inheritance: true });
    expect(names(on)).toEqual(['Flight', 'PlanItem', 'PublicTransportation']);
    const inherits = on.edges.filter((e) => e.kind === 'inheritance');
    expect(inherits.map((e) => [e.source, e.target]).sort()).toEqual([
      [`${NS}.Flight`, `${NS}.PublicTransportation`],
      [`${NS}.PublicTransportation`, `${NS}.PlanItem`],
    ]);
    const off = buildGraph(trippin, `${NS}.PublicTransportation`, { hops: 1, inheritance: false });
    expect(names(off)).toEqual(['PublicTransportation']);
  });

  it('merges a partner pair into one edge with both cardinalities', () => {
    const g = buildGraph(northwind, 'NorthwindModel.Category', { hops: 1, inheritance: false });
    const edges = g.edges.filter((e) => e.label === 'Products' || e.label === 'Category');
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({
      source: 'NorthwindModel.Category',
      target: 'NorthwindModel.Product',
      label: 'Products',
      partnerLabel: 'Category',
      targetCardinality: '*',
    });
    expect(edges[0]?.sourceCardinality).toMatch(/^(1|0\.\.1)$/);
  });

  it('returns nothing for an unknown type', () => {
    expect(buildGraph(trippin, 'NS.Nope', { hops: 1, inheritance: true }).nodes).toEqual([]);
  });

  it('refuses a neighborhood above the cap and suggests fewer hops', () => {
    const one = buildGraph(trippin, `${NS}.Person`, { hops: 1, inheritance: true });
    expect(one.total).toBe(3);
    const g = buildGraph(trippin, `${NS}.Person`, { hops: 3, inheritance: true, maxNodes: 3 });
    expect(g.nodes).toEqual([]);
    expect(g.edges).toEqual([]);
    expect(g.total).toBeGreaterThan(3);
    expect(g.hint).toContain('Show 1 hop instead');
    const tight = buildGraph(trippin, `${NS}.Person`, { hops: 1, inheritance: true, maxNodes: 2 });
    expect(tight.hint).toContain('fewer links');
  });
});
