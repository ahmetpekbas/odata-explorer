import { describe, expect, it } from 'vitest';
import { parseXml } from './parse-xml.ts';
import { resolve } from './resolve.ts';
import { buildSearchIndex, type SearchKind } from './search-index.ts';
import { coreOnly, northwindXml, trippinXml } from './test-fixtures.ts';

const index = (source: string) =>
  buildSearchIndex(resolve(parseXml(source), source, coreOnly).model);

function counts(source: string): Partial<Record<SearchKind, number>> {
  const counted: Partial<Record<SearchKind, number>> = {};
  for (const entry of index(source)) counted[entry.kind] = (counted[entry.kind] ?? 0) + 1;
  return counted;
}

/** What the model holds, counted straight from its arrays rather than through the walker. */
function expected(source: string): Record<string, number> {
  const { schemas } = parseXml(source);
  const sum = (count: (s: (typeof schemas)[number]) => number) =>
    schemas.reduce((n, s) => n + count(s), 0);
  const containers = (s: (typeof schemas)[number]) => s.entityContainers;
  const names = (ops: { name: string }[]) => new Set(ops.map((o) => o.name)).size;
  return {
    entityType: sum((s) => s.entityTypes.length),
    complexType: sum((s) => s.complexTypes.length),
    enumType: sum((s) => s.enumTypes.length),
    typeDefinition: sum((s) => s.typeDefinitions.length),
    property: sum((s) =>
      [...s.entityTypes, ...s.complexTypes].reduce((n, t) => n + t.properties.length, 0),
    ),
    navigationProperty: sum((s) =>
      [...s.entityTypes, ...s.complexTypes].reduce((n, t) => n + t.navigationProperties.length, 0),
    ),
    enumMember: sum((s) => s.enumTypes.reduce((n, t) => n + t.members.length, 0)),
    entitySet: sum((s) => containers(s).reduce((n, c) => n + c.entitySets.length, 0)),
    singleton: sum((s) => containers(s).reduce((n, c) => n + c.singletons.length, 0)),
    action: sum((s) => names(s.actions)),
    function: sum((s) => names(s.functions)),
    actionImport: sum((s) => containers(s).reduce((n, c) => n + c.actionImports.length, 0)),
    functionImport: sum((s) => containers(s).reduce((n, c) => n + c.functionImports.length, 0)),
    term: sum((s) => s.terms.length),
  };
}

describe('buildSearchIndex', () => {
  it.each([
    ['TripPin', trippinXml],
    ['Northwind', northwindXml],
  ])('has as many entries as the %s model has searchable elements', (_, source) => {
    const found = counts(source);
    for (const [kind, count] of Object.entries(expected(source))) {
      expect(found[kind as SearchKind] ?? 0, kind).toBe(count);
    }
  });

  it('gives each entry its kind, target path, label and parent', () => {
    const ns = 'Microsoft.OData.SampleService.Models.TripPin';
    const entries = index(trippinXml);
    expect(entries).toContainEqual({
      kind: 'entityType',
      id: `${ns}.Person`,
      label: 'Person',
      parent: ns,
    });
    expect(entries).toContainEqual({
      kind: 'navigationProperty',
      id: `${ns}.Person/Friends`,
      label: 'Friends',
      parent: `${ns}.Person`,
    });
    expect(entries).toContainEqual({
      kind: 'enumMember',
      id: `${ns}.PersonGender/Male`,
      label: 'Male',
      parent: `${ns}.PersonGender`,
    });
    expect(entries).toContainEqual({
      kind: 'entitySet',
      id: `${ns}.DefaultContainer/People`,
      label: 'People',
      parent: `${ns}.DefaultContainer`,
    });
  });

  const overloads = `<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
<edmx:DataServices><Schema Namespace="N" xmlns="http://docs.oasis-open.org/odata/ns/edm">
  <EntityType Name="A"><Key><PropertyRef Name="Id"/></Key>
    <Property Name="Id" Type="Edm.Int32">
      <Annotation Term="com.sap.vocabularies.Common.v1.Label" String="Identifier"/>
    </Property>
  </EntityType>
  <Function Name="F"><ReturnType Type="Edm.Int32"/></Function>
  <Function Name="F"><Parameter Name="x" Type="Edm.Int32"/><ReturnType Type="Edm.Int32"/></Function>
</Schema></edmx:DataServices></edmx:Edmx>`;

  it('lists the overloads of an operation once, under the overload group', () => {
    const functions = index(overloads).filter((e) => e.kind === 'function');
    expect(functions).toEqual([{ kind: 'function', id: 'N.F', label: 'F', parent: 'N' }]);
  });

  it('indexes the text of a label annotation, pointing at the annotated element', () => {
    const [label] = index(overloads).filter((e) => e.kind === 'annotation');
    expect(label).toEqual({
      kind: 'annotation',
      id: 'N.A/Id/@com.sap.vocabularies.Common.v1.Label',
      label: 'Identifier',
      parent: 'N.A/Id',
    });
  });
});
