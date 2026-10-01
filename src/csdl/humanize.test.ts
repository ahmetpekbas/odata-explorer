import { describe, expect, it } from 'vitest';
import {
  descriptionOf,
  enumMemberValues,
  facetEntries,
  friendlyAppliesTo,
  friendlyLink,
  friendlyType,
  hasLabel,
  labelOf,
  longDescriptionOf,
  shortName,
  technicalType,
} from './humanize.ts';
import { typeRef } from './ids.ts';
import type { Annotation, EnumType } from './model.ts';

const PRIMITIVES = [
  'Binary',
  'Boolean',
  'Byte',
  'Date',
  'DateTimeOffset',
  'Decimal',
  'Double',
  'Duration',
  'Guid',
  'Int16',
  'Int32',
  'Int64',
  'SByte',
  'Single',
  'Stream',
  'String',
  'TimeOfDay',
  'Geography',
  'GeographyPoint',
  'GeographyLineString',
  'GeographyPolygon',
  'GeographyMultiPoint',
  'GeographyMultiLineString',
  'GeographyMultiPolygon',
  'GeographyCollection',
  'Geometry',
  'GeometryPoint',
  'GeometryLineString',
  'GeometryPolygon',
  'GeometryMultiPoint',
  'GeometryMultiLineString',
  'GeometryMultiPolygon',
  'GeometryCollection',
  'PrimitiveType',
  'ComplexType',
  'EntityType',
  'Untyped',
  'AnnotationPath',
  'AnyPropertyPath',
  'ModelElementPath',
  'NavigationPropertyPath',
  'PropertyPath',
];

describe('friendlyType', () => {
  it('has a plain-language name for every Edm primitive', () => {
    for (const name of PRIMITIVES) {
      const text = friendlyType(typeRef(`Edm.${name}`));
      expect(text, name).not.toBe('');
      expect(text, name).not.toContain('Edm.');
    }
  });

  it.each([
    ['Edm.String', 'Text'],
    ['Edm.Int32', 'Whole number'],
    ['Edm.Int64', 'Whole number'],
    ['Edm.Double', 'Number'],
    ['Edm.Boolean', 'Yes/No'],
    ['Edm.Guid', 'Unique ID'],
    ['Edm.DateTimeOffset', 'Date and time'],
    ['Edm.Date', 'Date'],
    ['Edm.TimeOfDay', 'Time'],
    ['Edm.Stream', 'File'],
    ['Edm.GeographyPoint', 'Geography point'],
    ['Edm.GeometryMultiPolygon', 'Geometry multi polygon'],
    ['Edm.Geography', 'Geography shape'],
  ])('writes %s as %s', (raw, expected) => {
    expect(friendlyType(typeRef(raw))).toBe(expected);
  });

  it('shows the facets that matter to a reader', () => {
    expect(friendlyType(typeRef('Edm.String'), { maxLength: 100 })).toBe('Text (max 100)');
    expect(friendlyType(typeRef('Edm.String'), { maxLength: 'max' })).toBe(
      'Text (unlimited length)',
    );
    expect(friendlyType(typeRef('Edm.Decimal'), { precision: 10, scale: 2 })).toBe(
      'Number (10 digits, 2 decimals)',
    );
    expect(friendlyType(typeRef('Edm.Decimal'), { scale: 'variable' })).toBe('Number');
    expect(friendlyType(typeRef('Edm.Int32'), { maxLength: 5 })).toBe('Whole number');
  });

  it('wraps collections', () => {
    expect(friendlyType(typeRef('Collection(Edm.String)'))).toBe('List of Text');
    expect(friendlyType(typeRef('Collection(NS.Order)'))).toBe('List of Order');
  });

  it('names structured types by their short name', () => {
    expect(friendlyType(typeRef('Some.Namespace.Order'))).toBe('Order');
  });

  it('marks enums when it can tell them apart', () => {
    const kindOf = (name: string) => (name === 'NS.Color' ? 'enumType' : 'entityType');
    expect(friendlyType(typeRef('NS.Color'), {}, kindOf)).toBe('Color (choice)');
    expect(friendlyType(typeRef('Collection(NS.Color)'), {}, kindOf)).toBe(
      'List of Color (choice)',
    );
    expect(friendlyType(typeRef('NS.Order'), {}, kindOf)).toBe('Order');
  });
});

describe('friendlyLink', () => {
  it('says whether a navigation leads to one or many', () => {
    expect(friendlyLink(typeRef('NS.Customer'))).toBe('Link to Customer');
    expect(friendlyLink(typeRef('Collection(NS.Customer)'))).toBe('Link to Customer (many)');
  });
});

describe('technicalType and facetEntries', () => {
  it('keeps the qualified name', () => {
    expect(technicalType(typeRef('Collection(NS.Order)'))).toBe('Collection(NS.Order)');
  });

  it('lists the set facets in a fixed order', () => {
    expect(
      facetEntries({
        defaultValue: 'x',
        unicode: false,
        srid: 4326,
        scale: 'floating',
        precision: 3,
        maxLength: 'max',
      }),
    ).toEqual([
      ['MaxLength', 'max'],
      ['Precision', '3'],
      ['Scale', 'floating'],
      ['SRID', '4326'],
      ['Unicode', 'false'],
      ['DefaultValue', 'x'],
    ]);
    expect(facetEntries({})).toEqual([]);
  });
});

describe('friendlyAppliesTo', () => {
  it('spells out known targets', () => {
    expect(friendlyAppliesTo('EntityType')).toBe('Entity types');
    expect(friendlyAppliesTo('Whatever')).toBe('Whatever');
  });
});

describe('labels and descriptions', () => {
  const text = (term: string, value: string): Annotation => ({
    term,
    value: { kind: 'constant', type: 'string', value },
    annotations: [],
    origin: 'inline',
  });

  it('prefers Common.Label and falls back to the name', () => {
    const labelled = {
      name: 'Cust',
      annotations: [text('com.sap.vocabularies.Common.v1.Label', ' Customer ')],
    };
    expect(labelOf(labelled)).toBe('Customer');
    expect(hasLabel(labelled)).toBe(true);
    const plain = { name: 'Cust', annotations: [] };
    expect(labelOf(plain)).toBe('Cust');
    expect(hasLabel(plain)).toBe(false);
  });

  it('reads Core.Description and Core.LongDescription', () => {
    const element = {
      annotations: [
        text('Org.OData.Core.V1.Description', 'Short'),
        text('Org.OData.Core.V1.LongDescription', 'Long'),
      ],
    };
    expect(descriptionOf(element)).toBe('Short');
    expect(longDescriptionOf(element)).toBe('Long');
    expect(descriptionOf({ annotations: [] })).toBeUndefined();
  });

  it('ignores blank and non-string values', () => {
    expect(descriptionOf({ annotations: [text('Org.OData.Core.V1.Description', '  ')] })).toBe(
      undefined,
    );
    const bare: Annotation = {
      term: 'Org.OData.Core.V1.Description',
      annotations: [],
      origin: 'inline',
    };
    expect(descriptionOf({ annotations: [bare] })).toBeUndefined();
  });
});

describe('shortName', () => {
  it('drops the namespace', () => {
    expect(shortName('A.B.C')).toBe('C');
    expect(shortName('C')).toBe('C');
  });
});

describe('enumMemberValues', () => {
  const enumOf = (isFlags: boolean, values: (string | undefined)[]): EnumType => ({
    kind: 'enumType',
    id: 'NS.E',
    name: 'E',
    annotations: [],
    isFlags,
    underlyingType: 'Edm.Int32',
    members: values.map((value, i) => ({
      kind: 'enumMember',
      id: `NS.E/M${i}`,
      name: `M${i}`,
      annotations: [],
      ...(value !== undefined && { value }),
    })),
  });

  it('continues from the previous value', () => {
    expect(enumMemberValues(enumOf(false, [undefined, undefined, '10', undefined]))).toEqual([
      { value: '0', implicit: true },
      { value: '1', implicit: true },
      { value: '10', implicit: false },
      { value: '11', implicit: true },
    ]);
  });

  it('uses powers of two for flags', () => {
    expect(enumMemberValues(enumOf(true, [undefined, undefined, '3', undefined]))).toEqual([
      { value: '1', implicit: true },
      { value: '2', implicit: true },
      { value: '3', implicit: false },
      { value: '4', implicit: true },
    ]);
  });
});
