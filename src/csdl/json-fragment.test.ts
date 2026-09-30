import { describe, expect, it } from 'vitest';
import miscellaneous from '../../fixtures/csdl-schemas/miscellaneous.json?raw';
import miscellaneous2 from '../../fixtures/csdl-schemas/miscellaneous2.json?raw';
import { indexJsonSource, jsonFragment } from './json-fragment.ts';
import type { Element, ElementKind } from './model.ts';
import { parseJson } from './parse-json.ts';
import { allElements } from './walk.ts';

const ALL_KINDS: ElementKind[] = [
  'schema',
  'entityType',
  'complexType',
  'enumType',
  'enumMember',
  'typeDefinition',
  'property',
  'navigationProperty',
  'term',
  'action',
  'function',
  'parameter',
  'returnType',
  'entityContainer',
  'entitySet',
  'singleton',
  'actionImport',
  'functionImport',
];

function load(text: string) {
  const model = parseJson(text);
  const root = JSON.parse(text) as Record<string, unknown>;
  const index = indexJsonSource(model, root);
  const fragment = (kind: ElementKind, id: string): unknown => {
    const element: Element | undefined = [...allElements(model)].find(
      (e) => e.kind === kind && e.id === id,
    );
    if (!element) throw new Error(`${kind} ${id} not found`);
    const json = jsonFragment(index, element);
    return json === undefined ? undefined : (JSON.parse(json) as unknown);
  };
  return { model, root, index, fragment };
}

describe('jsonFragment in a real document', () => {
  const { model, root, index } = load(miscellaneous);

  it('returns a fragment for every element', () => {
    for (const element of allElements(model)) {
      expect(jsonFragment(index, element), `${element.kind} ${element.id}`).toBeTypeOf('string');
    }
  });

  it('is the element subtree, indented', () => {
    const type = model.schemas.find((s) => s.namespace === 'org.example')?.entityTypes[0];
    if (!type) throw new Error('no type');
    const text = jsonFragment(index, type);
    const expected = (root['org.example'] as Record<string, unknown>)[type.name];
    expect(text).toBe(JSON.stringify(expected, null, 2));
    expect(text).toContain('\n  "$Kind": "EntityType"');
  });

  it('has nothing for an element of another document', () => {
    const other = load(miscellaneous2).model.schemas[0];
    if (!other) throw new Error('no schema');
    expect(jsonFragment(index, other)).toBeUndefined();
  });
});

describe('jsonFragment by element kind', () => {
  const doc = JSON.stringify({
    $Version: '4.01',
    N: {
      Customer: {
        $Kind: 'EntityType',
        $Key: ['ID'],
        ID: { $Type: 'Edm.Int32' },
        Name: { '@Core.Description': 'The name' },
        Orders: { $Kind: 'NavigationProperty', $Collection: true, $Type: 'N.Order' },
      },
      Order: { $Kind: 'EntityType', $Key: ['ID'], ID: { $Type: 'Edm.Int32' } },
      Address: { $Kind: 'ComplexType', City: {} },
      Color: { $Kind: 'EnumType', Red: 1, 'Red@Core.Description': 'Red', Blue: 2 },
      Money: { $Kind: 'TypeDefinition', $UnderlyingType: 'Edm.Decimal' },
      Weight: { $Kind: 'Term', $Type: 'Edm.Double' },
      Top: [
        { $Kind: 'Function', $ReturnType: { $Type: 'Edm.Int32' } },
        {
          $Kind: 'Function',
          $IsBound: true,
          $Parameter: [
            { $Name: 'c', $Type: 'N.Customer' },
            { $Name: 'n', $Type: 'Edm.Int32' },
          ],
          $ReturnType: { $Collection: true, $Type: 'N.Customer' },
        },
      ],
      Reset: [
        { $Kind: 'Action' },
        { $Kind: 'Action', $IsBound: true, $Parameter: [{ $Name: 'c', $Type: 'N.Customer' }] },
      ],
      Container: {
        $Kind: 'EntityContainer',
        Customers: { $Collection: true, $Type: 'N.Customer' },
        Me: { $Type: 'N.Customer' },
        Reset: { $Action: 'N.Reset' },
        Top: { $Function: 'N.Top' },
      },
    },
  });
  const { model, root, fragment } = load(doc);
  const n = root.N as Record<string, unknown>;
  const customer = n.Customer as Record<string, unknown>;
  const container = n.Container as Record<string, unknown>;

  it('covers every element kind', () => {
    expect(model.diagnostics).toEqual([]);
    expect(new Set([...allElements(model)].map((e) => e.kind))).toEqual(new Set(ALL_KINDS));
  });

  it('returns the subtree of each structural kind', () => {
    expect(fragment('schema', 'N')).toEqual(n);
    expect(fragment('entityType', 'N.Customer')).toEqual(customer);
    expect(fragment('complexType', 'N.Address')).toEqual(n.Address);
    expect(fragment('enumType', 'N.Color')).toEqual(n.Color);
    expect(fragment('typeDefinition', 'N.Money')).toEqual(n.Money);
    expect(fragment('term', 'N.Weight')).toEqual(n.Weight);
    expect(fragment('property', 'N.Customer/Name')).toEqual(customer.Name);
    expect(fragment('navigationProperty', 'N.Customer/Orders')).toEqual(customer.Orders);
    expect(fragment('entityContainer', 'N.Container')).toEqual(container);
  });

  it('gathers an enum member with its annotations', () => {
    expect(fragment('enumMember', 'N.Color/Red')).toEqual({
      Red: 1,
      'Red@Core.Description': 'Red',
    });
    expect(fragment('enumMember', 'N.Color/Blue')).toEqual({ Blue: 2 });
  });

  it('picks the overload, its parameters and its return type', () => {
    const top = n.Top as unknown[];
    expect(fragment('function', 'N.Top()')).toEqual(top[0]);
    expect(fragment('function', 'N.Top(N.Customer,Edm.Int32)')).toEqual(top[1]);
    expect(fragment('parameter', 'N.Top(N.Customer,Edm.Int32)/n')).toEqual({
      $Name: 'n',
      $Type: 'Edm.Int32',
    });
    expect(fragment('returnType', 'N.Top(N.Customer,Edm.Int32)/$ReturnType')).toEqual({
      $Collection: true,
      $Type: 'N.Customer',
    });
    const reset = n.Reset as unknown[];
    expect(fragment('action', 'N.Reset()')).toEqual(reset[0]);
    expect(fragment('action', 'N.Reset(N.Customer)')).toEqual(reset[1]);
  });

  it('returns the container members', () => {
    expect(fragment('entitySet', 'N.Container/Customers')).toEqual(container.Customers);
    expect(fragment('singleton', 'N.Container/Me')).toEqual(container.Me);
    expect(fragment('actionImport', 'N.Container/Reset')).toEqual(container.Reset);
    expect(fragment('functionImport', 'N.Container/Top')).toEqual(container.Top);
  });

  it('matches overloads by position, whatever their IDs become', () => {
    const aliased = load(
      JSON.stringify({
        $Version: '4.0',
        N: {
          $Alias: 'A',
          T: { $Kind: 'EntityType', ID: {} },
          F: [
            { $Kind: 'Function', $Parameter: [{ $Name: 'x', $Type: 'A.T' }] },
            { $Kind: 'Function', $Parameter: [{ $Name: 'y', $Type: 'Edm.Int32' }] },
          ],
        },
      }),
    );
    const [first, second] = aliased.model.schemas[0]?.functions ?? [];
    if (!first || !second) throw new Error('no functions');
    expect(JSON.parse(jsonFragment(aliased.index, first) ?? '')).toMatchObject({
      $Parameter: [{ $Name: 'x' }],
    });
    expect(JSON.parse(jsonFragment(aliased.index, second) ?? '')).toMatchObject({
      $Parameter: [{ $Name: 'y' }],
    });
  });
});
