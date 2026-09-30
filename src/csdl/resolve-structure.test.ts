import { describe, expect, it } from 'vitest';
import { parseXml } from './parse-xml.ts';
import { resolve } from './resolve.ts';
import { aliasesXml, northwindXml, trippinXml } from './test-fixtures.ts';

const load = (source: string) => resolve(parseXml(source), source);
const NS = 'Microsoft.OData.SampleService.Models.TripPin';

describe('resolver: inheritance (TripPin)', () => {
  const { model, types } = load(trippinXml);

  it('resolves documents without diagnostics', () => {
    expect(model.diagnostics).toEqual([]);
  });

  it('builds base-type chains and derived-types indexes', () => {
    expect(types.get(`${NS}.Flight`)?.baseChain).toEqual([
      `${NS}.PublicTransportation`,
      `${NS}.PlanItem`,
    ]);
    expect(types.get(`${NS}.PlanItem`)?.baseChain).toEqual([]);
    expect(types.get(`${NS}.PlanItem`)?.derived).toEqual([
      `${NS}.PublicTransportation`,
      `${NS}.Event`,
    ]);
    expect(types.get(`${NS}.PlanItem`)?.descendants.sort()).toEqual(
      [`${NS}.Event`, `${NS}.Flight`, `${NS}.PublicTransportation`].sort(),
    );
    expect(types.get(`${NS}.Flight`)?.derived).toEqual([]);
  });

  it('inherits the key and properties, base first', () => {
    const flight = types.get(`${NS}.Flight`);
    expect(flight?.key).toEqual([{ name: 'PlanItemId' }]);
    expect(flight?.keyOwner).toBe(`${NS}.PlanItem`);
    expect(flight?.propertyIds.slice(0, 4)).toEqual([
      `${NS}.PlanItem/PlanItemId`,
      `${NS}.PlanItem/ConfirmationCode`,
      `${NS}.PlanItem/StartsAt`,
      `${NS}.PlanItem/EndsAt`,
    ]);
    expect(flight?.propertyIds).toContain(`${NS}.Flight/FlightNumber`);
    expect(flight?.navigationPropertyIds).toEqual([
      `${NS}.Flight/From`,
      `${NS}.Flight/To`,
      `${NS}.Flight/Airline`,
    ]);
    expect(types.get(`${NS}.City`)?.key).toEqual([]);
  });
});

describe('resolver: exposure and bindings (TripPin)', () => {
  const { exposure, bindings, elements } = load(trippinXml);
  const C = `${NS}.DefaultContainer`;

  it('records which sets and singletons expose each type', () => {
    expect(exposure.get(`${NS}.Person`)).toEqual({
      entitySets: [`${C}/People`],
      singletons: [`${C}/Me`],
    });
    expect(exposure.get(`${NS}.Airport`)).toEqual({
      entitySets: [`${C}/Airports`],
      singletons: [],
    });
    expect(exposure.get(`${NS}.Trip`)).toBeUndefined();
  });

  it('resolves navigation bindings to properties and targets', () => {
    const people = bindings.get(`${C}/People`);
    expect(people).toHaveLength(6);
    expect(people?.[0]).toEqual({
      path: 'Friends',
      target: 'People',
      navigationId: `${NS}.Person/Friends`,
      targetId: `${C}/People`,
    });
    // A type-cast path ends in a navigation property of the derived type.
    expect(people?.[1]).toMatchObject({
      path: `${NS}.Flight/Airline`,
      navigationId: `${NS}.Flight/Airline`,
      targetId: `${C}/Airlines`,
    });
    expect(bindings.get(`${C}/Me`)).toHaveLength(6);
    expect(bindings.get(`${C}/Airports`)).toEqual([]);
    expect(elements.get(bindings.get(`${C}/Me`)?.[4]?.navigationId ?? '')?.kind).toBe(
      'navigationProperty',
    );
  });
});

describe('resolver: partners', () => {
  it('pairs Northwind navigation properties in both directions', () => {
    const { model, partners } = load(northwindXml);
    expect(model.diagnostics).toEqual([]);
    const N = 'NorthwindModel';
    expect(partners.get(`${N}.Category/Products`)).toBe(`${N}.Product/Category`);
    expect(partners.get(`${N}.Product/Category`)).toBe(`${N}.Category/Products`);
    expect(partners.get(`${N}.Order/Customer`)).toBe(`${N}.Customer/Orders`);
    // Self-referential pair on Employee.
    expect(partners.get(`${N}.Employee/Employees1`)).toBe(`${N}.Employee/Employee1`);
  });

  it('follows partners declared through aliases, and pairs a one-sided declaration', () => {
    const { partners } = load(aliasesXml);
    const M = 'Org.Example.Model';
    expect(partners.get(`${M}.Customer/Orders`)).toBe(`${M}.Order/Customer`);
    expect(partners.get(`${M}.Order/Customer`)).toBe(`${M}.Customer/Orders`);

    const src = `<Edmx Version="4.0"><DataServices><Schema Namespace="N" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EntityType Name="A"><NavigationProperty Name="Bs" Type="Collection(N.B)" Partner="A"/></EntityType>
      <EntityType Name="B"><NavigationProperty Name="A" Type="N.A"/></EntityType></Schema></DataServices></Edmx>`;
    const one = load(src);
    expect(one.partners.get('N.B/A')).toBe('N.A/Bs');
  });

  it('reports a partner that does not exist', () => {
    const src = `<Edmx Version="4.0"><DataServices><Schema Namespace="N" xmlns="http://docs.oasis-open.org/odata/ns/edm">
      <EntityType Name="A"><NavigationProperty Name="Bs" Type="Collection(N.B)" Partner="Nope"/></EntityType>
      <EntityType Name="B"/></Schema></DataServices></Edmx>`;
    expect(load(src).model.diagnostics).toMatchObject([
      { code: 'unresolved-partner', target: 'N.A/Bs' },
    ]);
  });
});

describe('resolver: edge cases', () => {
  const wrap = (body: string) =>
    `<Edmx Version="4.0"><DataServices><Schema Namespace="N" xmlns="http://docs.oasis-open.org/odata/ns/edm">${body}</Schema></DataServices></Edmx>`;

  it('lets a derived type declare its own key only when the base has none', () => {
    const { types } = load(
      wrap(
        '<EntityType Name="Base" Abstract="true"/><EntityType Name="D" BaseType="N.Base"><Key><PropertyRef Name="Id"/></Key><Property Name="Id" Type="Edm.Int32"/></EntityType>',
      ),
    );
    expect(types.get('N.D')).toMatchObject({ key: [{ name: 'Id' }], keyOwner: 'N.D' });
    expect(types.get('N.Base')?.key).toEqual([]);
  });

  it('survives an inheritance cycle', () => {
    const { model, types } = load(
      wrap('<EntityType Name="A" BaseType="N.B"/><EntityType Name="B" BaseType="N.A"/>'),
    );
    expect(model.diagnostics.map((d) => d.code)).toContain('base-type-cycle');
    expect(types.get('N.A')?.baseChain).toEqual(['N.B']);
  });

  it('reports bindings that point nowhere', () => {
    const { model } = load(
      wrap(
        '<EntityType Name="A"><Key><PropertyRef Name="Id"/></Key><Property Name="Id" Type="Edm.Int32"/></EntityType><EntityContainer Name="C"><EntitySet Name="As" EntityType="N.A"><NavigationPropertyBinding Path="Nope" Target="Missing"/></EntitySet></EntityContainer>',
      ),
    );
    expect(model.diagnostics.map((d) => d.code)).toEqual([
      'unresolved-binding',
      'unresolved-binding',
    ]);
  });
});
