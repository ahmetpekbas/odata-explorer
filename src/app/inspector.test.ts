import { describe, expect, it } from 'vitest';
import { loadResolved } from '../test/views.tsx';
import {
  annotationsOf,
  groupByVocabulary,
  vocabularyName,
  vocabularyNamespace,
} from './inspector.ts';

const DOC = `<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
<edmx:Reference Uri="core.xml"><edmx:Include Namespace="Org.OData.Core.V1" Alias="Core"/></edmx:Reference>
<edmx:DataServices><Schema Namespace="N" xmlns="http://docs.oasis-open.org/odata/ns/edm">
  <EntityType Name="T">
    <Key><PropertyRef Name="Id"/></Key>
    <Property Name="Id" Type="Edm.Int32"/>
    <Property Name="Name" Type="Edm.String">
      <Annotation Term="Core.Description" String="inline"/>
      <Annotation Term="Ex.Mine" Qualifier="q" Int="1"/>
    </Property>
  </EntityType>
  <Function Name="F" IsBound="true"><Parameter Name="t" Type="N.T"/><ReturnType Type="Edm.String"/></Function>
  <Function Name="F" IsBound="true"><Parameter Name="t" Type="N.T"/><Parameter Name="n" Type="Edm.Int32"/><ReturnType Type="Edm.String"/></Function>
  <Annotations Target="N.T/Name"><Annotation Term="Core.LongDescription" String="external"/></Annotations>
  <Annotations Target="N.F"><Annotation Term="Core.Description" String="all overloads"/></Annotations>
  <Annotations Target="N.F(N.T,Edm.Int32)"><Annotation Term="Ex.Only" Bool="true"/></Annotations>
</Schema></edmx:DataServices></edmx:Edmx>`;
const resolved = loadResolved(DOC);

describe('annotationsOf', () => {
  it('returns inline annotations first, then external ones', () => {
    const list = annotationsOf(resolved, 'N.T/Name');
    expect(list.map((a) => [a.term, a.origin])).toEqual([
      ['Org.OData.Core.V1.Description', 'inline'],
      ['Ex.Mine', 'inline'],
      ['Org.OData.Core.V1.LongDescription', 'external'],
    ]);
  });

  it('is empty without a selection, for an unknown id, and for a bare element', () => {
    expect(annotationsOf(resolved, undefined)).toEqual([]);
    expect(annotationsOf(resolved, 'N.Nope')).toEqual([]);
    expect(annotationsOf(resolved, 'N.T/Id')).toEqual([]);
  });

  it('gathers the annotations of every overload of an operation, once each', () => {
    const terms = annotationsOf(resolved, 'N.F').map((a) => a.term);
    expect(terms.sort()).toEqual(['Ex.Only', 'Org.OData.Core.V1.Description']);
  });
});

describe('groupByVocabulary', () => {
  it('groups by namespace in order of first appearance', () => {
    const groups = groupByVocabulary(annotationsOf(resolved, 'N.T/Name'));
    expect(groups.map((g) => [g.vocabulary, g.namespace, g.annotations.length])).toEqual([
      ['Core', 'Org.OData.Core.V1', 2],
      ['Ex', 'Ex', 1],
    ]);
  });
});

describe('vocabulary names', () => {
  it('drops the version and the organization', () => {
    expect(vocabularyName('Org.OData.Capabilities.V1')).toBe('Capabilities');
    expect(vocabularyName('com.sap.vocabularies.Common.v1')).toBe('Common');
    expect(vocabularyName('Ex')).toBe('Ex');
    expect(vocabularyName('')).toBe('');
    expect(vocabularyNamespace('Org.OData.Core.V1.Computed')).toBe('Org.OData.Core.V1');
    expect(vocabularyNamespace('Bare')).toBe('');
  });
});
