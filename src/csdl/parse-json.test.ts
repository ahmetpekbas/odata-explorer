import { describe, expect, it } from 'vitest';
import coreJson from '../vocabularies/Org.OData.Core.V1.json?raw';
import { parseJson } from './parse-json.ts';

const NS = 'Demo';

/** A document with one schema holding the given members. */
function doc(members: Record<string, unknown>, extra: Record<string, unknown> = {}): string {
  return JSON.stringify({ $Version: '4.01', [NS]: members, ...extra });
}

function schemaOf(text: string) {
  const model = parseJson(text);
  expect(model.diagnostics).toEqual([]);
  const [schema] = model.schemas;
  if (!schema) throw new Error('no schema');
  return schema;
}

describe('parseJson: documents', () => {
  it('parses the OASIS Core vocabulary without diagnostics', () => {
    const model = parseJson(coreJson);
    expect(model.format).toBe('json');
    expect(model.version).toBe('4.0');
    expect(model.diagnostics).toEqual([]);
    const [schema] = model.schemas;
    expect(schema?.namespace).toBe('Org.OData.Core.V1');
    expect(schema?.alias).toBe('Core');
    expect(schema?.terms.length).toBeGreaterThan(20);
    expect(schema?.annotations.map((a) => a.term)).toContain('Core.Description');
    expect(model.references.map((r) => r.includes[0]?.namespace)).toEqual([
      'Org.OData.Validation.V1',
    ]);
  });

  it('reports a syntax error with its position', () => {
    const model = parseJson('{\n  "$Version": "4.0",\n  oops\n}');
    expect(model.schemas).toEqual([]);
    expect(model.diagnostics).toHaveLength(1);
    expect(model.diagnostics[0]).toMatchObject({ severity: 'error', code: 'json-syntax' });
    expect(model.diagnostics[0]?.line).toBe(3);
  });

  it('refuses JSON that is not CSDL', () => {
    for (const text of ['[]', '{"value": []}', '42']) {
      const model = parseJson(text);
      expect(model.diagnostics.map((d) => d.code)).toEqual(['not-csdl-json']);
      expect(model.schemas).toEqual([]);
    }
  });

  it('reads references', () => {
    const model = parseJson(
      JSON.stringify({
        $Version: '4.0',
        $Reference: {
          'https://x/Core.json': {
            $Include: [{ $Namespace: 'Org.OData.Core.V1', $Alias: 'Core' }],
            $IncludeAnnotations: [{ $TermNamespace: 'T', $Qualifier: 'Q', $TargetNamespace: 'N' }],
          },
        },
      }),
    );
    expect(model.references).toEqual([
      {
        uri: 'https://x/Core.json',
        includes: [{ namespace: 'Org.OData.Core.V1', alias: 'Core' }],
        includeAnnotations: [{ termNamespace: 'T', qualifier: 'Q', targetNamespace: 'N' }],
      },
    ]);
  });
});

describe('parseJson: types', () => {
  const schema = schemaOf(
    doc({
      $Alias: 'D',
      Customer: {
        $Kind: 'EntityType',
        $BaseType: 'D.Person',
        $OpenType: true,
        $Key: ['ID', { Town: 'Address/City' }],
        ID: { $Type: 'Edm.Int32' },
        Name: {},
        Nick: { $Nullable: true, $MaxLength: 10, $Unicode: false, $DefaultValue: 'x' },
        Tags: { $Collection: true },
        Price: { $Type: 'Edm.Decimal', $Precision: 9, $Scale: 2 },
        Orders: {
          $Kind: 'NavigationProperty',
          $Collection: true,
          $Type: 'D.Order',
          $Partner: 'Customer',
          $ContainsTarget: true,
          $OnDelete: 'Cascade',
          $ReferentialConstraint: { ID: 'CustomerID', 'ID@Core.Description': 'ignored' },
        },
        '@Core.Description': 'A customer',
      },
      Address: { $Kind: 'ComplexType', $Abstract: true, City: {} },
      Color: {
        $Kind: 'EnumType',
        $IsFlags: true,
        $UnderlyingType: 'Edm.Byte',
        Red: 1,
        'Red@Core.Description': 'The red one',
        Blue: 2,
      },
      Money: { $Kind: 'TypeDefinition', $UnderlyingType: 'Edm.Decimal', $Scale: 2 },
      Weight: {
        $Kind: 'Term',
        $Type: 'Edm.Double',
        $AppliesTo: ['Property', 'Parameter'],
        $BaseTerm: 'D.Mass',
      },
    }),
  );

  it('applies the JSON defaults', () => {
    const [customer] = schema.entityTypes;
    const name = customer?.properties.find((p) => p.name === 'Name');
    expect(name).toMatchObject({
      id: 'Demo.Customer/Name',
      type: { raw: 'Edm.String', name: 'Edm.String', isCollection: false },
      nullable: false,
    });
    expect(customer?.properties.find((p) => p.name === 'Nick')?.nullable).toBe(true);
    expect(customer?.properties.find((p) => p.name === 'Tags')?.type).toEqual({
      raw: 'Collection(Edm.String)',
      name: 'Edm.String',
      isCollection: true,
    });
  });

  it('reads structured types, keys, facets and navigation properties', () => {
    const [customer] = schema.entityTypes;
    expect(schema.alias).toBe('D');
    expect(customer).toMatchObject({
      id: 'Demo.Customer',
      baseType: { name: 'D.Person' },
      openType: true,
      abstract: false,
      key: [{ name: 'ID' }, { name: 'Address/City', alias: 'Town' }],
    });
    expect(customer?.properties.map((p) => p.name)).toEqual([
      'ID',
      'Name',
      'Nick',
      'Tags',
      'Price',
    ]);
    expect(customer?.properties.find((p) => p.name === 'Nick')?.facets).toEqual({
      maxLength: 10,
      unicode: false,
      defaultValue: 'x',
    });
    expect(customer?.properties.find((p) => p.name === 'Price')?.facets).toEqual({
      precision: 9,
      scale: 2,
    });
    expect(customer?.navigationProperties).toEqual([
      {
        kind: 'navigationProperty',
        id: 'Demo.Customer/Orders',
        name: 'Orders',
        annotations: [],
        type: { raw: 'Collection(D.Order)', name: 'D.Order', isCollection: true },
        nullable: false,
        partner: 'Customer',
        containsTarget: true,
        referentialConstraints: [{ property: 'ID', referencedProperty: 'CustomerID' }],
        onDelete: 'Cascade',
      },
    ]);
    expect(schema.complexTypes[0]).toMatchObject({ id: 'Demo.Address', abstract: true });
  });

  it('reads enums, type definitions and terms', () => {
    const [color] = schema.enumTypes;
    expect(color).toMatchObject({ isFlags: true, underlyingType: 'Edm.Byte' });
    expect(color?.members.map((m) => [m.name, m.value])).toEqual([
      ['Red', '1'],
      ['Blue', '2'],
    ]);
    expect(color?.members[0]?.annotations[0]).toMatchObject({
      term: 'Core.Description',
      value: { kind: 'constant', value: 'The red one' },
    });
    expect(schema.typeDefinitions[0]).toMatchObject({
      id: 'Demo.Money',
      underlyingType: 'Edm.Decimal',
      facets: { scale: 2 },
    });
    expect(schema.terms[0]).toMatchObject({
      id: 'Demo.Weight',
      baseTerm: 'D.Mass',
      appliesTo: ['Property', 'Parameter'],
      nullable: false,
    });
  });
});

describe('parseJson: operations and container', () => {
  const schema = schemaOf(
    doc({
      Top: [
        {
          $Kind: 'Function',
          $IsBound: true,
          $IsComposable: true,
          $EntitySetPath: 'cs',
          $Parameter: [
            { $Name: 'cs', $Collection: true, $Type: 'Demo.Customer' },
            { $Name: 'n', $Type: 'Edm.Int32', $Nullable: true },
          ],
          $ReturnType: { $Collection: true, $Type: 'Demo.Customer' },
        },
        { $Kind: 'Function' },
      ],
      Reset: [
        { $Kind: 'Action' },
        { $Kind: 'Action', $IsBound: true, $Parameter: [{ $Name: 'c', $Type: 'Demo.Customer' }] },
      ],
      Container: {
        $Kind: 'EntityContainer',
        $Extends: 'Other.Base',
        Customers: {
          $Collection: true,
          $Type: 'Demo.Customer',
          $IncludeInServiceDocument: false,
          $NavigationPropertyBinding: { Orders: 'Orders' },
        },
        Me: { $Type: 'Demo.Customer' },
        Reset: { $Action: 'Demo.Reset' },
        Top: { $Function: 'Demo.Top', $EntitySet: 'Customers', $IncludeInServiceDocument: true },
      },
    }),
  );

  it('reads overloads with signature IDs', () => {
    expect(schema.functions.map((f) => f.id)).toEqual([
      'Demo.Top(Collection(Demo.Customer),Edm.Int32)',
      'Demo.Top()',
    ]);
    const [top] = schema.functions;
    expect(top).toMatchObject({ isBound: true, isComposable: true, entitySetPath: 'cs' });
    expect(top?.parameters.map((p) => [p.id, p.nullable])).toEqual([
      ['Demo.Top(Collection(Demo.Customer),Edm.Int32)/cs', false],
      ['Demo.Top(Collection(Demo.Customer),Edm.Int32)/n', true],
    ]);
    expect(top?.returnType).toMatchObject({
      id: 'Demo.Top(Collection(Demo.Customer),Edm.Int32)/$ReturnType',
      type: { isCollection: true, name: 'Demo.Customer' },
    });
    expect(schema.actions.map((a) => a.id)).toEqual(['Demo.Reset()', 'Demo.Reset(Demo.Customer)']);
  });

  it('reads the entity container', () => {
    const [container] = schema.entityContainers;
    expect(container).toMatchObject({ id: 'Demo.Container', extends: 'Other.Base' });
    expect(container?.entitySets).toEqual([
      {
        kind: 'entitySet',
        id: 'Demo.Container/Customers',
        name: 'Customers',
        annotations: [],
        entityType: { raw: 'Demo.Customer', name: 'Demo.Customer', isCollection: false },
        includeInServiceDocument: false,
        bindings: [{ path: 'Orders', target: 'Orders' }],
      },
    ]);
    expect(container?.singletons[0]).toMatchObject({ id: 'Demo.Container/Me', bindings: [] });
    expect(container?.actionImports[0]).toMatchObject({ action: 'Demo.Reset' });
    expect(container?.functionImports[0]).toMatchObject({
      function: 'Demo.Top',
      entitySet: 'Customers',
      includeInServiceDocument: true,
    });
  });
});

describe('parseJson: annotations', () => {
  const schema = schemaOf(
    doc({
      T: {
        $Kind: 'EntityType',
        '@Core.Description': 'text',
        '@Core.Description#Short': 'short',
        '@Core.Description@Core.IsLanguageDependent': true,
        '@UI.Hidden': true,
        '@UI.Record': {
          '@type': '#UI.Thing',
          Label: 'L',
          'Label@Core.Description': 'about the label',
          Count: 3,
          Ratio: 1.5,
          Path: { $Path: 'A/B' },
          Flag: { $Null: null },
          Items: [1, { $EnumMember: 'UI.Kind/A' }],
          '@Core.Description': 'about the record',
        },
        '@UI.Calc': {
          $If: [
            { $Eq: [{ $Path: 'X' }, 1] },
            { $Apply: ['a', 'b'], $Function: 'odata.concat' },
            null,
          ],
        },
        '@UI.Conv': { $Cast: { $Path: 'X' }, $Type: 'Edm.String', $MaxLength: 5 },
        '@UI.Label': { $LabeledElement: 'v', $Name: 'lab' },
        '@UI.Ref': { $LabeledElementReference: 'lab' },
        '@UI.Link': { $UrlRef: 'http://x' },
        '@UI.Not': { $Not: { $Path: 'Y' } },
        '@UI.Date': { $Date: '2024-01-02' },
        '@core': 'not a term',
      },
      $Annotations: {
        'Demo.T': { '@Core.LongDescription#Q': 'long' },
        'Other.X/Y': { '@Core.Description': 'elsewhere' },
      },
    }),
  );
  const annotations = schema.entityTypes[0]?.annotations ?? [];
  const byTerm = (term: string, qualifier?: string) =>
    annotations.find((a) => a.term === term && a.qualifier === qualifier);

  it('reads terms, qualifiers and annotations of annotations', () => {
    expect(annotations.map((a) => a.term)).toEqual([
      'Core.Description',
      'Core.Description',
      'UI.Hidden',
      'UI.Record',
      'UI.Calc',
      'UI.Conv',
      'UI.Label',
      'UI.Ref',
      'UI.Link',
      'UI.Not',
      'UI.Date',
    ]);
    expect(byTerm('Core.Description')).toMatchObject({
      origin: 'inline',
      value: { kind: 'constant', type: 'string', value: 'text' },
      annotations: [
        {
          term: 'Core.IsLanguageDependent',
          value: { kind: 'constant', type: 'bool', value: 'true' },
        },
      ],
    });
    expect(byTerm('Core.Description', 'Short')?.value).toMatchObject({ value: 'short' });
  });

  it('reads records and collections', () => {
    const record = byTerm('UI.Record')?.value;
    expect(record).toMatchObject({ kind: 'record', type: 'UI.Thing' });
    if (record?.kind !== 'record') throw new Error('not a record');
    expect(record.properties.map((p) => [p.property, p.value.kind])).toEqual([
      ['Label', 'constant'],
      ['Count', 'constant'],
      ['Ratio', 'constant'],
      ['Path', 'path'],
      ['Flag', 'null'],
      ['Items', 'collection'],
    ]);
    expect(record.properties[0]?.annotations[0]?.value).toMatchObject({ value: 'about the label' });
    expect(record.properties[1]?.value).toEqual({ kind: 'constant', type: 'int', value: '3' });
    expect(record.properties[2]?.value).toEqual({
      kind: 'constant',
      type: 'decimal',
      value: '1.5',
    });
    expect(record.annotations).toHaveLength(1);
  });

  it('reads the expression forms', () => {
    expect(byTerm('UI.Calc')?.value).toMatchObject({
      kind: 'if',
      test: {
        kind: 'operator',
        operator: 'Eq',
        args: [{ kind: 'path', value: 'X' }, { kind: 'constant' }],
      },
      then: { kind: 'apply', function: 'odata.concat', args: [{ value: 'a' }, { value: 'b' }] },
      else: { kind: 'null' },
    });
    expect(byTerm('UI.Conv')?.value).toMatchObject({
      kind: 'cast',
      type: { name: 'Edm.String' },
      facets: { maxLength: 5 },
      value: { kind: 'path' },
    });
    expect(byTerm('UI.Label')?.value).toMatchObject({ kind: 'labeledElement', name: 'lab' });
    expect(byTerm('UI.Ref')?.value).toEqual({ kind: 'labeledElementReference', name: 'lab' });
    expect(byTerm('UI.Link')?.value).toMatchObject({ kind: 'urlRef' });
    expect(byTerm('UI.Not')?.value).toMatchObject({
      kind: 'operator',
      operator: 'Not',
      args: [{ kind: 'path' }],
    });
    expect(byTerm('UI.Date')?.value).toEqual({
      kind: 'constant',
      type: 'date',
      value: '2024-01-02',
    });
  });

  it('reads external annotation blocks', () => {
    expect(
      schema.annotationBlocks.map((b) => [
        b.target,
        b.annotations.map((a) => [a.term, a.qualifier, a.origin]),
      ]),
    ).toEqual([
      ['Demo.T', [['Core.LongDescription', 'Q', 'external']]],
      ['Other.X/Y', [['Core.Description', undefined, 'external']]],
    ]);
  });
});

describe('parseJson: leniency', () => {
  it('reports members it cannot place and keeps going', () => {
    const model = parseJson(
      doc({
        Odd: { $Kind: 'Mystery' },
        Broken: { $Kind: 'EntityType', P: { $Kind: 'Nope' }, N: { $Kind: 'NavigationProperty' } },
        Good: { $Kind: 'ComplexType', A: {} },
        Container: { $Kind: 'EntityContainer', Set: { $Collection: true } },
      }),
    );
    expect(model.diagnostics.map((d) => d.code)).toEqual([
      'unknown-kind',
      'unknown-kind',
      'missing-attribute',
      'missing-attribute',
    ]);
    expect(model.schemas[0]?.complexTypes[0]?.properties).toHaveLength(1);
  });
});
