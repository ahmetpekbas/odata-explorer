import { describe, expect, it } from 'vitest';
import { parseXml } from './parse-xml.ts';
import type { Schema } from './model.ts';
import { northwindXml, trippinXml } from './test-fixtures.ts';

function counts(schemas: Schema[]) {
  const sum = (pick: (s: Schema) => number) => schemas.reduce((n, s) => n + pick(s), 0);
  const types = schemas.flatMap((s) => [...s.entityTypes, ...s.complexTypes]);
  return {
    schemas: schemas.length,
    entityTypes: sum((s) => s.entityTypes.length),
    complexTypes: sum((s) => s.complexTypes.length),
    enumTypes: sum((s) => s.enumTypes.length),
    typeDefinitions: sum((s) => s.typeDefinitions.length),
    properties: types.reduce((n, t) => n + t.properties.length, 0),
    navigationProperties: types.reduce((n, t) => n + t.navigationProperties.length, 0),
    keyProperties: schemas.reduce(
      (n, s) => n + s.entityTypes.reduce((k, t) => k + t.key.length, 0),
      0,
    ),
  };
}

describe('parseXml: types', () => {
  it('parses TripPin', () => {
    const model = parseXml(trippinXml);
    expect(model.version).toBe('4.0');
    expect(model.diagnostics).toEqual([]);
    expect(counts(model.schemas)).toEqual({
      schemas: 1,
      entityTypes: 9,
      complexTypes: 4,
      enumTypes: 1,
      typeDefinitions: 0,
      properties: 39,
      navigationProperties: 8,
      keyProperties: 6,
    });
  });

  it('parses Northwind', () => {
    const model = parseXml(northwindXml);
    expect(model.diagnostics).toEqual([]);
    expect(counts(model.schemas)).toEqual({
      schemas: 2,
      entityTypes: 26,
      complexTypes: 0,
      enumTypes: 0,
      typeDefinitions: 0,
      properties: 182,
      navigationProperties: 22,
      keyProperties: 52,
    });
  });

  it('reads type attributes, keys, enum members and navigation properties', () => {
    const [schema] = parseXml(trippinXml).schemas;
    const ns = 'Microsoft.OData.SampleService.Models.TripPin';
    expect(schema?.namespace).toBe(ns);

    const photo = schema?.entityTypes.find((t) => t.name === 'Photo');
    expect(photo).toMatchObject({ id: `${ns}.Photo`, hasStream: true, key: [{ name: 'Id' }] });

    const flight = schema?.entityTypes.find((t) => t.name === 'Flight');
    expect(flight?.baseType).toEqual({
      raw: `${ns}.PublicTransportation`,
      name: `${ns}.PublicTransportation`,
      isCollection: false,
    });
    expect(schema?.entityTypes.find((t) => t.name === 'Person')?.openType).toBe(true);

    const gender = schema?.enumTypes[0];
    expect(gender?.members.map((m) => [m.name, m.value])).toEqual([
      ['Male', '0'],
      ['Female', '1'],
      ['Unknown', '2'],
    ]);

    const friends = schema?.entityTypes
      .find((t) => t.name === 'Person')
      ?.navigationProperties.find((n) => n.name === 'Friends');
    expect(friends).toMatchObject({
      id: `${ns}.Person/Friends`,
      type: { isCollection: true, name: `${ns}.Person` },
      containsTarget: false,
    });
  });
});

describe('parseXml: declarations', () => {
  const doc = (body: string) =>
    `<edmx:Edmx Version="4.01" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"><edmx:Reference Uri="https://example.com/v.xml"><edmx:Include Namespace="Org.V" Alias="V"/><edmx:IncludeAnnotations TermNamespace="Org.V" Qualifier="q" TargetNamespace="NS"/></edmx:Reference><edmx:DataServices><Schema Namespace="NS" Alias="A" xmlns="http://docs.oasis-open.org/odata/ns/edm">${body}</Schema></edmx:DataServices></edmx:Edmx>`;

  it('parses references, includes and schema aliases', () => {
    const model = parseXml(doc(''));
    expect(model.version).toBe('4.01');
    expect(model.references).toMatchObject([
      {
        uri: 'https://example.com/v.xml',
        includes: [{ namespace: 'Org.V', alias: 'V' }],
        includeAnnotations: [{ termNamespace: 'Org.V', qualifier: 'q', targetNamespace: 'NS' }],
      },
    ]);
    expect(model.schemas[0]).toMatchObject({ namespace: 'NS', alias: 'A' });
  });

  it('parses all facets, type definitions, flags enums, constraints and OnDelete', () => {
    const model = parseXml(
      doc(`
        <TypeDefinition Name="Money" UnderlyingType="Edm.Decimal" Precision="19" Scale="4"/>
        <EnumType Name="Perm" IsFlags="true" UnderlyingType="Edm.Int64"><Member Name="R" Value="1"/><Member Name="W" Value="2"/></EnumType>
        <ComplexType Name="Addr" BaseType="A.Base" Abstract="true"><Property Name="Line" Type="Edm.String" Nullable="false" MaxLength="max" Unicode="false" DefaultValue="x"/></ComplexType>
        <EntityType Name="E"><Key><PropertyRef Name="Addr/City" Alias="City"/></Key>
          <Property Name="G" Type="Edm.Geography" SRID="variable"/>
          <Property Name="D" Type="Edm.Decimal" Precision="10" Scale="variable"/>
          <NavigationProperty Name="N" Type="Collection(A.E)" Partner="P" ContainsTarget="true">
            <ReferentialConstraint Property="a" ReferencedProperty="b"/><OnDelete Action="Cascade"/>
          </NavigationProperty>
        </EntityType>`),
    );
    const s = model.schemas[0];
    expect(s?.typeDefinitions[0]).toMatchObject({
      underlyingType: 'Edm.Decimal',
      facets: { precision: 19, scale: 4 },
    });
    expect(s?.enumTypes[0]).toMatchObject({ isFlags: true, underlyingType: 'Edm.Int64' });
    expect(s?.complexTypes[0]).toMatchObject({ abstract: true, baseType: { name: 'A.Base' } });
    expect(s?.complexTypes[0]?.properties[0]).toMatchObject({
      nullable: false,
      facets: { maxLength: 'max', unicode: false, defaultValue: 'x' },
    });
    const e = s?.entityTypes[0];
    expect(e?.key).toEqual([{ name: 'Addr/City', alias: 'City' }]);
    expect(e?.properties[0]?.facets).toEqual({ srid: 'variable' });
    expect(e?.properties[1]?.facets).toEqual({ precision: 10, scale: 'variable' });
    expect(e?.navigationProperties[0]).toMatchObject({
      partner: 'P',
      containsTarget: true,
      onDelete: 'Cascade',
      referentialConstraints: [{ property: 'a', referencedProperty: 'b' }],
    });
  });

  it('numbers enum members that omit a value', () => {
    const model = parseXml(
      doc(
        '<EnumType Name="C"><Member Name="A"/><Member Name="B" Value="5"/><Member Name="D"/></EnumType>',
      ),
    );
    expect(model.schemas[0]?.enumTypes[0]?.members.map((m) => m.value)).toEqual(['0', '5', '6']);
  });

  it('reports a missing required attribute and keeps going', () => {
    const model = parseXml(doc('<EntityType><Property Name="P" Type="Edm.String"/></EntityType>'));
    expect(model.diagnostics).toMatchObject([{ code: 'missing-attribute', severity: 'error' }]);
    expect(model.schemas[0]?.entityTypes).toHaveLength(1);
  });
});

describe('parseXml: container and operations', () => {
  const ns = 'Microsoft.OData.SampleService.Models.TripPin';
  const schema = parseXml(trippinXml).schemas[0];

  it('parses the TripPin container', () => {
    const container = schema?.entityContainers[0];
    expect(container).toMatchObject({ id: `${ns}.DefaultContainer`, name: 'DefaultContainer' });
    expect(container?.entitySets.map((s) => s.name)).toEqual([
      'Photos',
      'People',
      'Airlines',
      'Airports',
    ]);
    expect(container?.entitySets[1]).toMatchObject({
      id: `${ns}.DefaultContainer/People`,
      entityType: { name: `${ns}.Person` },
      includeInServiceDocument: true,
    });
    expect(container?.entitySets[1]?.bindings).toHaveLength(6);
    expect(container?.entitySets[1]?.bindings[0]).toEqual({ path: 'Friends', target: 'People' });
    expect(container?.singletons).toMatchObject([
      { id: `${ns}.DefaultContainer/Me`, type: { name: `${ns}.Person` } },
    ]);
    expect(container?.singletons[0]?.bindings).toHaveLength(6);
    expect(container?.functionImports).toMatchObject([
      {
        name: 'GetNearestAirport',
        function: `${ns}.GetNearestAirport`,
        entitySet: 'Airports',
        includeInServiceDocument: true,
      },
    ]);
    expect(container?.actionImports).toMatchObject([
      { name: 'ResetDataSource', action: `${ns}.ResetDataSource` },
    ]);
  });

  it('parses functions with overload IDs, parameters and return types', () => {
    expect(schema?.functions.map((f) => f.id)).toEqual([
      `${ns}.GetFavoriteAirline(${ns}.Person)`,
      `${ns}.GetInvolvedPeople(${ns}.Trip)`,
      `${ns}.GetFriendsTrips(${ns}.Person,Edm.String)`,
      `${ns}.GetNearestAirport(Edm.Double,Edm.Double)`,
    ]);
    const fn = schema?.functions[2];
    expect(fn).toMatchObject({
      isBound: true,
      isComposable: true,
      entitySetPath: 'person/Friends/Trips',
    });
    expect(fn?.parameters.map((p) => [p.id, p.nullable])).toEqual([
      [`${ns}.GetFriendsTrips(${ns}.Person,Edm.String)/person`, false],
      [`${ns}.GetFriendsTrips(${ns}.Person,Edm.String)/userName`, false],
    ]);
    expect(fn?.returnType).toMatchObject({
      id: `${ns}.GetFriendsTrips(${ns}.Person,Edm.String)/$ReturnType`,
      type: { isCollection: true, name: `${ns}.Trip` },
    });
    expect(schema?.functions[3]).toMatchObject({ isBound: false });
  });

  it('parses actions, keying bound overloads by binding type only', () => {
    expect(
      schema?.actions.map((a) => [a.id, a.isBound, a.parameters.length, a.returnType]),
    ).toEqual([
      [`${ns}.ResetDataSource()`, false, 0, undefined],
      [`${ns}.ShareTrip(${ns}.Person)`, true, 3, undefined],
    ]);
  });

  it('parses terms and container Extends', () => {
    const model = parseXml(
      `<Edmx Version="4.0"><DataServices><Schema Namespace="NS" xmlns="http://docs.oasis-open.org/odata/ns/edm">
        <Term Name="Label" Type="Edm.String" Nullable="false" DefaultValue="x" BaseTerm="NS.Base" AppliesTo="EntityType Property" MaxLength="20"/>
        <EntityContainer Name="C" Extends="Other.C"/></Schema></DataServices></Edmx>`,
    );
    expect(model.schemas[0]?.terms[0]).toMatchObject({
      id: 'NS.Label',
      nullable: false,
      baseTerm: 'NS.Base',
      appliesTo: ['EntityType', 'Property'],
      facets: { maxLength: 20, defaultValue: 'x' },
    });
    expect(model.schemas[0]?.entityContainers[0]?.extends).toBe('Other.C');
  });
});
