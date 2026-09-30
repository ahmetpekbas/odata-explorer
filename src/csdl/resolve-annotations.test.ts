import { describe, expect, it } from 'vitest';
import type { Annotation } from './model.ts';
import { parseXml } from './parse-xml.ts';
import { resolve } from './resolve.ts';
import { aliasesXml, trippinXml } from './test-fixtures.ts';

const DOC = `<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
<edmx:Reference Uri="core.xml"><edmx:Include Namespace="Org.OData.Core.V1" Alias="Core"/></edmx:Reference>
<edmx:DataServices><Schema Namespace="N" Alias="A" xmlns="http://docs.oasis-open.org/odata/ns/edm">
  <EntityType Name="T">
    <Key><PropertyRef Name="Id"/></Key>
    <Property Name="Id" Type="Edm.Int32"/>
    <Property Name="Name" Type="Edm.String">
      <Annotation Term="Core.Description" String="inline"/>
      <Annotation Term="Core.Description" Qualifier="short" String="inline short"/>
    </Property>
    <Property Name="Addr" Type="A.Addr"/>
  </EntityType>
  <ComplexType Name="Addr"><Property Name="City" Type="Edm.String"/></ComplexType>
  <Function Name="F" IsBound="true"><Parameter Name="t" Type="A.T"/><ReturnType Type="Edm.String"/></Function>
  <Function Name="F" IsBound="true"><Parameter Name="t" Type="A.T"/><Parameter Name="n" Type="Edm.Int32"/></Function>
  <Action Name="Act" IsBound="true"><Parameter Name="t" Type="Collection(A.T)"/></Action>
  <EntityContainer Name="C"><EntitySet Name="Ts" EntityType="A.T"/></EntityContainer>

  <Annotations Target="A.T/Name"><Annotation Term="Core.Description" Qualifier="long" String="ext long"/></Annotations>
  <Annotations Target="N.C/Ts"><Annotation Term="Core.Description" String="set"/></Annotations>
  <Annotations Target="A.F(A.T)"><Annotation Term="Core.Description" String="one overload"/></Annotations>
  <Annotations Target="A.F"><Annotation Term="Core.Description" String="all overloads"/></Annotations>
  <Annotations Target="A.F(A.T,Edm.Int32)/n"><Annotation Term="Core.Description" String="param"/></Annotations>
  <Annotations Target="A.F(A.T)/$ReturnType"><Annotation Term="Core.Description" String="return"/></Annotations>
  <Annotations Target="A.Act(Collection(A.T))"><Annotation Term="Core.Description" String="action"/></Annotations>
  <Annotations Target="A.T" Qualifier="q"><Annotation Term="Core.Description" String="qualified by block"/></Annotations>
  <Annotations Target="A.T/Name/@Core.Description#short"><Annotation Term="Core.LongDescription" String="on an annotation"/></Annotations>
  <Annotations Target="A.T/Addr/City"><Annotation Term="Core.Description" String="nested path"/></Annotations>
  <Annotations Target="A.C/Ts/Name"><Annotation Term="Core.Description" String="set override"/></Annotations>
  <Annotations Target="N.Nope"><Annotation Term="Core.Description" String="lost"/></Annotations>
  <Annotations Target="Elsewhere.X"><Annotation Term="Core.Description" String="not ours"/></Annotations>
</Schema></edmx:DataServices></edmx:Edmx>`;

const { model, elements } = resolve(parseXml(DOC), DOC);
const on = (id: string): Annotation[] => elements.get(id)?.annotations ?? [];
const strings = (list: Annotation[]) =>
  list.map((a) => (a.value?.kind === 'constant' ? a.value.value : undefined));

describe('annotation attachment', () => {
  it('keeps inline annotations first, stamped with their own element as target', () => {
    const name = on('N.T/Name');
    expect(name.map((a) => [a.origin, a.qualifier, a.target])).toEqual([
      ['inline', undefined, 'N.T/Name'],
      ['inline', 'short', 'N.T/Name'],
      ['external', 'long', 'N.T/Name'],
      ['external', undefined, 'N.C/Ts/Name'],
    ]);
    expect(name.map((a) => a.term)).toEqual(Array(4).fill('Org.OData.Core.V1.Description'));
  });

  it('attaches an external target on a property through an alias', () => {
    expect(strings(on('N.T/Name'))).toContain('ext long');
  });

  it('attaches external targets on an entity set', () => {
    const set = on('N.C/Ts');
    expect(strings(set)).toEqual(['set']);
    expect(set[0]).toMatchObject({ origin: 'external', target: 'N.C/Ts' });
  });

  it('attaches to one overload, or to all of them', () => {
    const one = 'N.F(N.T)';
    const other = 'N.F(N.T,Edm.Int32)';
    expect(strings(on(one))).toEqual(['one overload', 'all overloads']);
    expect(on(one).find((a) => strings([a])[0] === 'one overload')?.target).toBe(one);
    expect(strings(on(other))).toEqual(['all overloads']);
    expect(on(other)[0]?.target).toBe('N.F');
  });

  it('attaches to parameters and return types of a single overload', () => {
    expect(strings(on('N.F(N.T,Edm.Int32)/n'))).toEqual(['param']);
    expect(strings(on('N.F(N.T)/$ReturnType'))).toEqual(['return']);
    expect(strings(on('N.F(N.T)/t'))).toEqual([]);
  });

  it('matches bound action overloads by binding type, including collections', () => {
    expect(strings(on('N.Act(Collection(N.T))'))).toEqual(['action']);
  });

  it('copies a block qualifier onto its annotations', () => {
    const t = on('N.T');
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ qualifier: 'q', origin: 'external', target: 'N.T' });
  });

  it('attaches an annotation to another annotation by term and qualifier', () => {
    const [plain, short] = on('N.T/Name');
    expect(plain?.annotations).toEqual([]);
    expect(short?.annotations).toHaveLength(1);
    expect(short?.annotations[0]).toMatchObject({
      term: 'Org.OData.Core.V1.LongDescription',
      origin: 'external',
      target: 'N.T/Name/@Org.OData.Core.V1.Description#short',
    });
  });

  it('attaches nested targets to the property they end in, keeping the full path', () => {
    const city = on('N.Addr/City');
    expect(strings(city)).toEqual(['nested path']);
    expect(city[0]?.target).toBe('N.T/Addr/City');
  });

  it('attaches set-level overrides of a property, keeping the full path', () => {
    const override = on('N.T/Name').find((a) => strings([a])[0] === 'set override');
    expect(override).toMatchObject({ origin: 'external', target: 'N.C/Ts/Name' });
  });

  it('reports targets that match nothing, and targets in other documents', () => {
    const lost = model.diagnostics.filter((d) => d.code.includes('annotation-target'));
    expect(lost.map((d) => [d.severity, d.code])).toEqual([
      ['warning', 'unresolved-annotation-target'],
      ['info', 'external-annotation-target'],
    ]);
    expect(lost.every((d) => d.line !== undefined)).toBe(true);
  });
});

describe('annotation attachment: documents', () => {
  it('attaches the external annotations in the alias fixture', () => {
    const { model: m, elements: e } = resolve(parseXml(aliasesXml), aliasesXml);
    expect(m.diagnostics).toEqual([]);
    const customer = e.get('Org.Example.Model.Customer');
    expect(customer?.annotations.map((a) => [a.term, a.origin])).toEqual([
      ['Org.OData.Core.V1.Description', 'external'],
      ['Org.Example.Extra.Flags', 'external'],
    ]);
  });

  it('leaves TripPin inline annotations in place and stamped', () => {
    const { model: m, elements: e } = resolve(parseXml(trippinXml), trippinXml);
    expect(m.diagnostics).toEqual([]);
    const people = e.get('Microsoft.OData.SampleService.Models.TripPin.DefaultContainer/People');
    expect(people?.annotations).toHaveLength(5);
    expect(people?.annotations.every((a) => a.origin === 'inline' && a.target === people.id)).toBe(
      true,
    );
  });
});
