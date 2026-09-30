import { describe, expect, it } from 'vitest';
import { parseXml } from '../csdl/parse-xml.ts';
import { resolve } from '../csdl/resolve.ts';
import { aliasesXml } from '../csdl/test-fixtures.ts';
import { BUNDLED_NAMESPACES, bundledSchemas, bundledVocabulary, lookupTerm } from './index.ts';

describe('bundled vocabularies', () => {
  it('bundles the nine standard vocabularies', () => {
    expect([...BUNDLED_NAMESPACES].sort()).toEqual(
      [
        'Aggregation',
        'Authorization',
        'Capabilities',
        'Core',
        'JSON',
        'Measures',
        'Repeatability',
        'Temporal',
        'Validation',
      ].map((n) => `Org.OData.${n}.V1`),
    );
  });

  it.each(BUNDLED_NAMESPACES)('parses and resolves %s without errors', (namespace) => {
    const vocabulary = bundledVocabulary(namespace);
    expect(vocabulary?.model.schemas.map((s) => s.namespace)).toEqual([namespace]);
    const problems = vocabulary?.model.diagnostics.filter((d) => d.severity !== 'info');
    expect(problems).toEqual([]);
  });

  it('looks up a term definition', () => {
    const term = lookupTerm('Org.OData.Core.V1.Description');
    expect(term).toMatchObject({ kind: 'term', name: 'Description', type: { name: 'Edm.String' } });
    // The definition carries its own documentation.
    const doc = term?.annotations.find((a) => a.term === 'Org.OData.Core.V1.Description');
    expect(doc?.value).toMatchObject({ kind: 'constant', type: 'string' });
    expect(lookupTerm('Org.OData.Capabilities.V1.InsertRestrictions')?.type.name).toBe(
      'Org.OData.Capabilities.V1.InsertRestrictionsType',
    );
    expect(lookupTerm('Org.OData.Core.V1.NoSuchTerm')).toBeUndefined();
    expect(lookupTerm('Other.Term')).toBeUndefined();
  });

  it('resolves a fixture that references Core offline', () => {
    const { model, elements } = resolve(parseXml(aliasesXml), aliasesXml, bundledSchemas);
    expect(model.diagnostics).toEqual([]);
    expect(elements.get('Org.Example.Model.Customer/Permissions')).toMatchObject({
      type: { name: 'Org.OData.Core.V1.Permission' },
    });
  });

  it('reports references it cannot resolve, and types missing from a bundled vocabulary', () => {
    const src = `<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
      <edmx:Reference Uri="https://example.com/mine.xml"><edmx:Include Namespace="My.Vocab" Alias="My"/></edmx:Reference>
      <edmx:Reference Uri="core.xml"><edmx:Include Namespace="Org.OData.Core.V1" Alias="Core"/></edmx:Reference>
      <edmx:DataServices><Schema Namespace="N" xmlns="http://docs.oasis-open.org/odata/ns/edm">
        <ComplexType Name="C"><Property Name="A" Type="My.Thing"/><Property Name="B" Type="Core.Nope"/></ComplexType>
      </Schema></edmx:DataServices></edmx:Edmx>`;
    const { model } = resolve(parseXml(src), src, bundledSchemas);
    expect(model.diagnostics.map((d) => [d.code, d.severity, d.line])).toEqual([
      ['unresolved-reference', 'warning', 2],
      ['unresolved-type', 'error', 5],
    ]);
    expect(model.diagnostics[0]?.message).toContain('My.Vocab');
    expect(model.diagnostics[1]?.message).toContain('Org.OData.Core.V1.Nope');
    // Types of the unresolved reference are kept, just not checked.
    expect(model.schemas[0]?.complexTypes[0]?.properties[0]?.type.name).toBe('My.Vocab.Thing');
  });
});
