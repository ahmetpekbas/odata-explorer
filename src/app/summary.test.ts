import { describe, expect, it } from 'vitest';
import { load } from '../worker/load.ts';
import aliases from '../../fixtures/aliases.xml?raw';
import northwind from '../../fixtures/northwind.xml?raw';
import trippin from '../../fixtures/trippin.xml?raw';
import unresolved from '../../fixtures/unresolved.xml?raw';
import type { Schema } from '../csdl/model.ts';
import {
  countElements,
  countSchema,
  defaultSchema,
  referencedNamespaces,
  summarizeReferences,
  type SchemaCounts,
} from './summary.ts';

function resolvedOf(text: string) {
  const result = load(text);
  if (!result.ok) throw new Error(result.error);
  return result.resolved;
}

describe('countElements', () => {
  it('totals types and sets over the schemas', () => {
    const counts = countElements(resolvedOf(trippin));
    expect(counts.entityTypes).toBeGreaterThan(0);
    expect(counts.entitySets).toBeGreaterThan(0);
    expect(counts.singletons).toBe(1);
  });
});

type Counted = Omit<SchemaCounts, 'overloads'>;

/** Counts the elements of a document by looking at its text, independently of the model. */
function textCounts(text: string): Counted {
  const n = (tag: string) => (text.match(new RegExp(`<${tag}[ />]`, 'g')) ?? []).length;
  return {
    entityTypes: n('EntityType'),
    complexTypes: n('ComplexType'),
    enumTypes: n('EnumType'),
    typeDefinitions: n('TypeDefinition'),
    terms: n('Term'),
    actions: n('Action'),
    functions: n('Function'),
    entitySets: n('EntitySet'),
    singletons: n('Singleton'),
    actionImports: n('ActionImport'),
    functionImports: n('FunctionImport'),
  };
}

describe('countSchema', () => {
  it.each([
    ['trippin', trippin],
    ['northwind', northwind],
  ])('adds up to the elements in %s', (_, text) => {
    const total = textCounts('');
    for (const schema of resolvedOf(text).model.schemas) {
      const counts = countSchema(schema);
      for (const key of Object.keys(total) as (keyof Counted)[]) total[key] += counts[key];
    }
    expect(total).toEqual(textCounts(text));
  });

  it('counts overloads once per name', () => {
    const schema = resolvedOf(aliases).model.schemas.find((s) => s.alias === 'M') as Schema;
    expect(countSchema(schema)).toMatchObject({ actions: 1, overloads: 3 });
  });
});

describe('summarizeReferences', () => {
  it('finds no unresolved reference in a sound document', () => {
    const resolved = resolvedOf(trippin);
    const [schema] = resolved.model.schemas as [Schema];
    const summary = summarizeReferences(resolved, schema);
    expect(summary.total).toBeGreaterThan(30);
    expect(summary.unresolved).toEqual([]);
  });

  it('collects the references that cannot be resolved', () => {
    const resolved = resolvedOf(unresolved);
    const [schema] = resolved.model.schemas as [Schema];
    const summary = summarizeReferences(resolved, schema);
    const expected = resolved.model.diagnostics.filter((d) => d.code === 'unresolved-type');
    expect(expected.length).toBeGreaterThan(0);
    expect(summary.unresolved).toEqual(expected);
    expect(summary.total).toBeGreaterThanOrEqual(expected.length);
  });
});

describe('referencedNamespaces', () => {
  it('tells bundled vocabularies from missing ones', () => {
    expect(referencedNamespaces(resolvedOf(aliases))).toEqual([
      expect.objectContaining({ namespace: 'Org.OData.Core.V1', alias: 'Core', status: 'bundled' }),
    ]);
    const missing = referencedNamespaces(resolvedOf(unresolved));
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((r) => r.status === 'missing')).toBe(true);
  });
});

describe('defaultSchema', () => {
  it('is the first schema of the document', () => {
    const { model } = resolvedOf(trippin);
    expect(defaultSchema(model)?.namespace).toBe('Microsoft.OData.SampleService.Models.TripPin');
    expect(defaultSchema({ ...model, schemas: [] })).toBeUndefined();
  });

  it('skips a bundled vocabulary', () => {
    const { model } = resolvedOf(trippin);
    const [own] = model.schemas as [Schema];
    const core = { ...own, namespace: 'Org.OData.Core.V1' };
    expect(defaultSchema({ ...model, schemas: [core, own] })).toBe(own);
  });
});
