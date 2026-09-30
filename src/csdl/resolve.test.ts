import { describe, expect, it } from 'vitest';
import { parseXml } from './parse-xml.ts';
import { resolve } from './resolve.ts';
import { aliasesXml, coreOnly, northwindXml, trippinXml, unresolvedXml } from './test-fixtures.ts';

const load = (source: string) => resolve(parseXml(source), source, coreOnly);

describe('resolver: names', () => {
  const { model, elements } = load(aliasesXml);
  const [m, x] = model.schemas;

  it('resolves an alias-heavy document without diagnostics', () => {
    expect(model.diagnostics).toEqual([]);
  });

  it('turns aliases into namespaces in every type reference', () => {
    const customer = m?.entityTypes[0];
    const types = Object.fromEntries(customer?.properties.map((p) => [p.name, p.type]) ?? []);
    expect(types.Status).toEqual({
      raw: 'X.Status',
      name: 'Org.Example.Extra.Status',
      isCollection: false,
    });
    expect(types.Others).toEqual({
      raw: 'Collection(X.Address)',
      name: 'Org.Example.Extra.Address',
      isCollection: true,
    });
    expect(types.Permissions?.name).toBe('Org.OData.Core.V1.Permission');
    expect(customer?.navigationProperties[0]?.type.name).toBe('Org.Example.Model.Order');
    // A full namespace stays as it is.
    expect(m?.entityTypes[1]?.navigationProperties[0]?.type.name).toBe(
      'Org.Example.Model.Customer',
    );
    expect(m?.entityTypes[2]?.baseType?.name).toBe('Org.Example.Model.Customer');
    expect(x?.entityTypes[0]?.baseType?.name).toBe('Org.Example.Model.Customer');
  });

  it('qualifies types of terms, containers and imports', () => {
    expect(x?.terms.map((t) => [t.type.name, t.baseTerm])).toEqual([
      ['Org.Example.Extra.Status', undefined],
      ['Org.Example.Extra.Code', 'Org.OData.Core.V1.Description'],
    ]);
    const container = m?.entityContainers[0];
    expect(container?.entitySets.map((s) => s.entityType.name)).toEqual([
      'Org.Example.Model.Customer',
      'Org.Example.Model.Order',
    ]);
    expect(container?.actionImports[0]?.action).toBe('Org.Example.Model.Reset');
  });

  it('qualifies terms, record types, enum members and casts inside annotations', () => {
    const block = m?.annotationBlocks[0];
    expect(block?.annotations.map((a) => a.term)).toEqual([
      'Org.OData.Core.V1.Description',
      'Org.Example.Extra.Flags',
    ]);
    expect(block?.annotations[1]?.value).toMatchObject({
      value: 'Org.Example.Extra.Status/Active',
    });

    const [cast, record] = x?.entityTypes[0]?.annotations ?? [];
    expect(cast?.term).toBe('Org.OData.Core.V1.Description');
    expect(cast?.value).toMatchObject({ kind: 'cast', type: { name: 'Org.Example.Extra.Code' } });
    expect(record?.value).toMatchObject({
      type: 'Org.Example.Model.Info',
      properties: [
        { value: { value: 'Org.Example.Extra.Status/Active Org.Example.Extra.Status/Closed' } },
      ],
    });
  });

  it('recomputes overload IDs from qualified parameter types', () => {
    const ids = [...(m?.actions ?? []), ...(m?.functions ?? [])].map((o) => o.id);
    expect(ids).toEqual([
      'Org.Example.Model.Reset(Org.Example.Model.Customer)',
      'Org.Example.Model.Reset(Org.Example.Model.Order)',
      'Org.Example.Model.Top(Collection(Org.Example.Model.Customer),Edm.Int32)',
    ]);
    const top = m?.functions[0];
    expect(top?.parameters.map((p) => p.id)).toEqual([
      'Org.Example.Model.Top(Collection(Org.Example.Model.Customer),Edm.Int32)/customers',
      'Org.Example.Model.Top(Collection(Org.Example.Model.Customer),Edm.Int32)/count',
    ]);
    expect(top?.returnType?.id).toBe(
      'Org.Example.Model.Top(Collection(Org.Example.Model.Customer),Edm.Int32)/$ReturnType',
    );
  });

  it('indexes every element by its final ID', () => {
    expect(elements.get('Org.Example.Model.Customer/Orders')?.kind).toBe('navigationProperty');
    expect(elements.get('Org.Example.Model.Reset(Org.Example.Model.Order)')?.kind).toBe('action');
    expect(elements.get('Org.Example.Model.Reset(Org.Example.Model.Order)/order')?.kind).toBe(
      'parameter',
    );
    expect(elements.get('Org.Example.Model.Container/Customers')?.kind).toBe('entitySet');
    expect(elements.get('Org.Example.Extra.Status/Closed')?.kind).toBe('enumMember');
    expect(elements.get('M.Customer')).toBeUndefined();
  });
});

describe('resolver: unresolved references', () => {
  const { model } = load(unresolvedXml);
  const messages = model.diagnostics.map((d) => [d.code, d.target, d.message]);

  it('reports every unresolvable reference, and only those', () => {
    expect(messages).toEqual([
      ['unresolved-reference', undefined, expect.stringContaining('Other.Model')],
      ['unresolved-type', 'Broken.Bad', expect.stringContaining('Broken.Missing')],
      ['unresolved-type', 'Broken.Bad/NoNamespace', expect.stringContaining('not qualified')],
      ['unresolved-type', 'Broken.Bad/UnknownNamespace', expect.stringContaining('Nowhere')],
      ['unresolved-type', 'Broken.Bad/NotEdm', expect.stringContaining('Edm.Strng')],
      ['unresolved-type', 'Broken.Bad/Lost', expect.stringContaining('Broken.Gone')],
      ['unresolved-type', 'Broken.F()/$ReturnType', expect.stringContaining('Broken.NoSuchType')],
    ]);
  });

  it('accepts types from an included namespace whose content is not available', () => {
    const external = model.schemas[0]?.entityTypes[0]?.properties[1];
    expect(external?.type.name).toBe('Other.Model.Thing');
    expect(model.diagnostics.some((d) => d.target === 'Broken.Fine/External')).toBe(false);
  });

  it('still produces the whole model', () => {
    expect(model.schemas[0]?.entityTypes.map((t) => t.name)).toEqual(['Fine', 'Bad']);
  });

  it('locates diagnostics in the source', () => {
    expect(model.diagnostics.every((d) => d.line !== undefined && d.column !== undefined)).toBe(
      true,
    );
    expect(model.diagnostics[0]).toMatchObject({ code: 'unresolved-reference', line: 3 });
  });
});

describe('resolver: real documents', () => {
  it('resolves TripPin and Northwind cleanly', () => {
    for (const source of [trippinXml, northwindXml]) {
      const { model, elements } = load(source);
      expect(model.diagnostics).toEqual([]);
      expect(elements.size).toBeGreaterThan(50);
    }
  });

  it('reports duplicate aliases and duplicate IDs', () => {
    const src = `<Edmx Version="4.0"><DataServices>
      <Schema Namespace="A" Alias="Z" xmlns="http://docs.oasis-open.org/odata/ns/edm"><EntityType Name="T"/><EntityType Name="T"/></Schema>
      <Schema Namespace="B" Alias="Z" xmlns="http://docs.oasis-open.org/odata/ns/edm"/></DataServices></Edmx>`;
    const codes = load(src).model.diagnostics.map((d) => d.code);
    expect(codes).toContain('duplicate-alias');
    expect(codes).toContain('duplicate-id');
  });
});
