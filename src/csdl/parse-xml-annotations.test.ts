import { describe, expect, it } from 'vitest';
import type { Annotation, Expression } from './model.ts';
import { parseXml } from './parse-xml.ts';
import { expressionsXml, trippinXml } from './test-fixtures.ts';

const model = parseXml(expressionsXml);
const blocks = model.schemas[0]?.annotationBlocks ?? [];
const byTerm = (target: string) => {
  const block = blocks.find((b) => b.target === target);
  return new Map(block?.annotations.map((a) => [a.term.replace('Ex.', ''), a]));
};
const value = (map: Map<string, Annotation>, term: string): Expression | undefined =>
  map.get(term)?.value;

describe('annotation parsing', () => {
  it('parses the fixture without diagnostics', () => {
    expect(model.diagnostics).toEqual([]);
    expect(blocks.map((b) => [b.target, b.annotations.length])).toEqual([
      ['Ex.Item', 17],
      ['Ex.Item/Name', 17],
      ['Ex.Item/Price', 25],
    ]);
    // The block qualifier moves onto its annotations.
    expect(blocks[0]?.annotations.every((a) => a.qualifier === 'q')).toBe(true);
    expect(blocks.flatMap((b) => b.annotations).every((a) => a.origin === 'external')).toBe(true);
  });

  it('parses inline annotations with qualifier and bare form', () => {
    const id = model.schemas[0]?.entityTypes[0]?.properties[0];
    expect(id?.annotations).toMatchObject([
      { term: 'Core.Computed', origin: 'inline', annotations: [] },
      {
        term: 'Core.Description',
        qualifier: 'short',
        origin: 'inline',
        value: { kind: 'constant', value: 'Identifier' },
      },
    ]);
    expect(id?.annotations[0]?.value).toBeUndefined();
  });

  it('parses every constant in attribute form', () => {
    const a = byTerm('Ex.Item');
    const constants = [
      ['Binary', 'binary', 'T0RhdGE='],
      ['Bool', 'bool', 'false'],
      ['Date', 'date', '2026-09-30'],
      ['DateTimeOffset', 'dateTimeOffset', '2026-09-30T12:00:00Z'],
      ['Decimal', 'decimal', '3.14'],
      ['Duration', 'duration', 'P1D'],
      ['EnumMember', 'enumMember', 'Ex.Color/Red Ex.Color/Blue'],
      ['Float', 'float', '1.5e3'],
      ['Guid', 'guid', '11111111-2222-3333-4444-555555555555'],
      ['Int', 'int', '42'],
      ['String', 'string', 'text'],
      ['TimeOfDay', 'timeOfDay', '21:45:00'],
    ] as const;
    for (const [term, type, v] of constants) {
      expect(value(a, term)).toEqual({ kind: 'constant', type, value: v });
    }
    for (const type of [
      'AnnotationPath',
      'ModelElementPath',
      'NavigationPropertyPath',
      'PropertyPath',
      'Path',
    ]) {
      expect(value(a, type)).toMatchObject({ kind: 'path', type });
    }
    expect(value(a, 'AnnotationPath')).toMatchObject({ value: 'Orders/@UI.LineItem' });
  });

  it('parses every constant and path in element form, keeping string whitespace', () => {
    const a = byTerm('Ex.Item/Name');
    expect(value(a, 'ElBool')).toEqual({ kind: 'constant', type: 'bool', value: 'true' });
    expect(value(a, 'ElInt')).toEqual({ kind: 'constant', type: 'int', value: '-7' });
    expect(value(a, 'ElFloat')).toEqual({ kind: 'constant', type: 'float', value: 'INF' });
    expect(value(a, 'ElString')).toEqual({
      kind: 'constant',
      type: 'string',
      value: ' padded text ',
    });
    expect(value(a, 'ElEnumMember')).toEqual({
      kind: 'constant',
      type: 'enumMember',
      value: 'Ex.Color/Red',
    });
    expect(value(a, 'ElPropertyPath')).toEqual({
      kind: 'path',
      type: 'PropertyPath',
      value: 'Name',
    });
    expect(value(a, 'ElAnnotationPath')).toEqual({
      kind: 'path',
      type: 'AnnotationPath',
      value: 'Orders/@UI.LineItem',
    });
    // Attribute and element forms of the same constant agree.
    const attr = byTerm('Ex.Item');
    for (const t of [
      'Binary',
      'Date',
      'DateTimeOffset',
      'Decimal',
      'Duration',
      'Guid',
      'TimeOfDay',
    ]) {
      expect(value(a, `El${t}`)).toEqual(value(attr, t));
    }
  });

  it('parses Null, Record, PropertyValue, Collection and nested annotations', () => {
    const a = byTerm('Ex.Item/Price');
    expect(value(a, 'Null')).toEqual({ kind: 'null', annotations: [] });
    expect(value(a, 'NullAnnotated')).toMatchObject({
      kind: 'null',
      annotations: [{ term: 'Core.Description' }],
    });
    expect(value(a, 'Record')).toMatchObject({
      kind: 'record',
      type: 'Ex.Info',
      annotations: [{ term: 'Core.Description', value: { value: 'rec' } }],
      properties: [
        { property: 'Title', value: { kind: 'constant', type: 'string', value: 'Hello' } },
        { property: 'Count', value: { kind: 'constant', type: 'int', value: '3' } },
        {
          property: 'Where',
          value: { kind: 'path', type: 'Path' },
          annotations: [{ term: 'Core.Description' }],
        },
      ],
    });
    expect(value(a, 'Collection')).toMatchObject({
      kind: 'collection',
      items: [
        { kind: 'constant' },
        { kind: 'constant' },
        { kind: 'record', properties: [{ property: 'P' }] },
      ],
    });
  });

  it('parses Apply, If, operators, Cast, IsOf, labeled elements and UrlRef', () => {
    const a = byTerm('Ex.Item/Price');
    expect(value(a, 'Apply')).toMatchObject({
      kind: 'apply',
      function: 'odata.concat',
      args: [{ kind: 'constant' }, { kind: 'path' }],
      annotations: [{ term: 'Core.Description' }],
    });
    expect(value(a, 'If')).toMatchObject({
      kind: 'if',
      test: { value: 'true' },
      then: { value: 'yes' },
      else: { value: 'no' },
    });
    for (const op of ['And', 'Or', 'Eq', 'Ne', 'Gt', 'Ge', 'Lt', 'Le', 'Has', 'In']) {
      expect(value(a, op)).toMatchObject({ kind: 'operator', operator: op, args: [{}, {}] });
    }
    expect(value(a, 'Not')).toMatchObject({
      kind: 'operator',
      operator: 'Not',
      args: [{ kind: 'constant' }],
    });
    expect(value(a, 'Arithmetic')).toMatchObject({
      operator: 'Add',
      args: [{ kind: 'path' }, { operator: 'Mul', args: [{}, { operator: 'Neg', args: [{}] }] }],
    });
    expect(value(a, 'Arithmetic2')).toMatchObject({
      operator: 'Div',
      args: [{ operator: 'Sub' }, { operator: 'DivBy', args: [{}, { operator: 'Mod' }] }],
    });
    expect(value(a, 'Cast')).toMatchObject({
      kind: 'cast',
      type: { name: 'Edm.Decimal', isCollection: false },
      facets: { precision: 10, scale: 2 },
      value: { kind: 'path', value: 'Price' },
    });
    expect(value(a, 'IsOf')).toMatchObject({
      kind: 'isOf',
      type: { name: 'Edm.String', isCollection: true },
      facets: { maxLength: 5 },
    });
    expect(value(a, 'Labeled')).toMatchObject({
      kind: 'labeledElement',
      name: 'Label1',
      value: { kind: 'path' },
    });
    expect(value(a, 'LabeledAttr')).toMatchObject({
      kind: 'labeledElement',
      name: 'Label2',
      value: { kind: 'constant', value: 'direct' },
    });
    expect(value(a, 'LabeledRef')).toEqual({ kind: 'labeledElementReference', name: 'Ex.Label1' });
    expect(value(a, 'UrlRef')).toMatchObject({ kind: 'urlRef', value: { kind: 'apply' } });
  });

  it('covers every Expression kind in the fixture', () => {
    const kinds = new Set<string>();
    const walk = (e: Expression | undefined) => {
      if (!e) return;
      kinds.add(e.kind);
      if (e.kind === 'record') e.properties.forEach((p) => walk(p.value));
      if (e.kind === 'collection') e.items.forEach(walk);
      if (e.kind === 'apply' || e.kind === 'operator') e.args.forEach(walk);
      if (e.kind === 'if') [e.test, e.then, e.else].forEach(walk);
      if (e.kind === 'cast' || e.kind === 'isOf') walk(e.value);
      if (e.kind === 'labeledElement' || e.kind === 'urlRef') walk(e.value);
    };
    blocks.flatMap((b) => b.annotations).forEach((a) => walk(a.value));
    expect([...kinds].sort()).toEqual(
      [
        'apply',
        'cast',
        'collection',
        'constant',
        'if',
        'isOf',
        'labeledElement',
        'labeledElementReference',
        'null',
        'operator',
        'path',
        'record',
        'urlRef',
      ].sort(),
    );
  });

  it('warns about unknown expression elements in the EDM namespace', () => {
    const m = parseXml(
      '<Edmx Version="4.0"><DataServices><Schema Namespace="N" xmlns="http://docs.oasis-open.org/odata/ns/edm"><Term Name="T" Type="Edm.String"><Annotation Term="A.B"><Bogus/></Annotation></Term></Schema></DataServices></Edmx>',
    );
    expect(m.diagnostics).toMatchObject([{ code: 'unknown-expression', severity: 'warning' }]);
  });

  it('parses the annotations in TripPin', () => {
    const schema = parseXml(trippinXml).schemas[0];
    const people = schema?.entityContainers[0]?.entitySets.find((s) => s.name === 'People');
    expect(people?.annotations.map((a) => a.term)).toEqual([
      'Org.OData.Core.V1.OptimisticConcurrency',
      'Org.OData.Core.V1.ResourcePath',
      'Org.OData.Capabilities.V1.NavigationRestrictions',
      'Org.OData.Capabilities.V1.SearchRestrictions',
      'Org.OData.Capabilities.V1.InsertRestrictions',
    ]);
    expect(people?.annotations[3]?.value).toMatchObject({
      kind: 'record',
      properties: [
        { property: 'Searchable', value: { type: 'bool', value: 'true' } },
        { property: 'UnsupportedExpressions', value: { type: 'enumMember' } },
      ],
    });
  });
});
