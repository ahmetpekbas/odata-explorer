import { describe, expect, it } from 'vitest';
import trippin from '../../fixtures/trippin.xml?raw';
import { load } from '../worker/load.ts';
import { buildNavigatorTree, type NavNode } from './navigator-tree.ts';

function model(xml: string) {
  const result = load(xml);
  if (!result.ok) throw new Error(result.error);
  return result.resolved.model;
}

const NS = 'Microsoft.OData.SampleService.Models.TripPin';
const names = (nodes: NavNode[]) => nodes.map((n) => n.label);
const child = (node: NavNode | undefined, label: string) =>
  node?.children.find((c) => c.label === label);

describe('buildNavigatorTree', () => {
  const [schema, ...rest] = buildNavigatorTree(model(trippin), { hideVocabularies: true });

  it('has one schema node', () => {
    expect(rest).toEqual([]);
    expect(schema).toMatchObject({ id: NS, label: NS, kind: 'schema' });
  });

  it('groups the schema members, leaving out empty groups', () => {
    expect(names(schema?.children ?? [])).toEqual([
      'Entity Types',
      'Complex Types',
      'Enum Types',
      'Actions',
      'Functions',
      'DefaultContainer',
    ]);
  });

  it('lists entity types by name with their target-path IDs', () => {
    const types = child(schema, 'Entity Types')?.children;
    expect(names(types ?? [])).toEqual([
      'Airline',
      'Airport',
      'Event',
      'Flight',
      'Person',
      'Photo',
      'PlanItem',
      'PublicTransportation',
      'Trip',
    ]);
    expect(types?.find((t) => t.label === 'Person')).toMatchObject({
      id: `${NS}.Person`,
      kind: 'entityType',
    });
  });

  it('puts the sets, singletons and imports under the container', () => {
    const container = child(schema, 'DefaultContainer');
    expect(container).toMatchObject({ id: `${NS}.DefaultContainer`, kind: 'entityContainer' });
    expect(names(container?.children ?? [])).toEqual([
      'Entity Sets',
      'Singletons',
      'Action Imports',
      'Function Imports',
    ]);
    expect(child(container, 'Entity Sets')?.children.map((c) => c.id)).toEqual([
      `${NS}.DefaultContainer/Airlines`,
      `${NS}.DefaultContainer/Airports`,
      `${NS}.DefaultContainer/People`,
      `${NS}.DefaultContainer/Photos`,
    ]);
  });

  it('lists an operation once per name', () => {
    const operations = `<?xml version="1.0"?><edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"><edmx:DataServices><Schema Namespace="N" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EntityType Name="A"><Key><PropertyRef Name="Id"/></Key><Property Name="Id" Type="Edm.Int32"/></EntityType>
      <EntityType Name="B"><Key><PropertyRef Name="Id"/></Key><Property Name="Id" Type="Edm.Int32"/></EntityType>
      <Action Name="Go" IsBound="true"><Parameter Name="p" Type="N.A"/></Action>
      <Action Name="Go" IsBound="true"><Parameter Name="p" Type="N.B"/></Action>
    </Schema></edmx:DataServices></edmx:Edmx>`;
    const [s] = buildNavigatorTree(model(operations), { hideVocabularies: true });
    expect(child(s, 'Actions')?.children).toEqual([
      { id: 'N.Go', label: 'Go', detail: '2 overloads', kind: 'action', children: [] },
    ]);
  });

  it('hides vocabulary schemas unless asked to show them', () => {
    const xml = `<?xml version="1.0"?><edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"><edmx:DataServices>
      <Schema Namespace="Org.OData.Core.V1" xmlns="http://docs.oasis-open.org/odata/ns/edm"><Term Name="T" Type="Edm.String"/></Schema>
      <Schema Namespace="N" xmlns="http://docs.oasis-open.org/odata/ns/edm"><ComplexType Name="C"/></Schema>
    </edmx:DataServices></edmx:Edmx>`;
    const m = model(xml);
    expect(names(buildNavigatorTree(m, { hideVocabularies: true }))).toEqual(['N']);
    expect(names(buildNavigatorTree(m, { hideVocabularies: false }))).toEqual([
      'Org.OData.Core.V1',
      'N',
    ]);
  });
});
