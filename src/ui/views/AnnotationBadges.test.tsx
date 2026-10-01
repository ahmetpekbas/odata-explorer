import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useStore, type TabKind } from '../../app/store.ts';
import { stubLayout } from '../../test/layout.ts';
import { loadResolved, renderView } from '../../test/views.tsx';
import { ElementView } from './ElementView.tsx';

const DOC = `<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
<edmx:Reference Uri="https://oasis-tcs.github.io/odata-vocabularies/vocabularies/Org.OData.Core.V1.xml"><edmx:Include Namespace="Org.OData.Core.V1" Alias="Core"/></edmx:Reference>
<edmx:Reference Uri="https://oasis-tcs.github.io/odata-vocabularies/vocabularies/Org.OData.Capabilities.V1.xml"><edmx:Include Namespace="Org.OData.Capabilities.V1" Alias="Capabilities"/></edmx:Reference>
<edmx:Reference Uri="https://oasis-tcs.github.io/odata-vocabularies/vocabularies/Org.OData.Validation.V1.xml"><edmx:Include Namespace="Org.OData.Validation.V1" Alias="Validation"/></edmx:Reference>
<edmx:DataServices><Schema Namespace="N" xmlns="http://docs.oasis-open.org/odata/ns/edm">
  <EntityType Name="Product">
    <Key><PropertyRef Name="Id"/></Key>
    <Property Name="Id" Type="Edm.Int32" Nullable="false">
      <Annotation Term="Core.Computed"/>
    </Property>
    <Property Name="Size" Type="Edm.String">
      <Annotation Term="Validation.AllowedValues"><Collection>
        <Record><PropertyValue Property="Value" String="S"/></Record>
        <Record><PropertyValue Property="Value" String="M"/></Record>
      </Collection></Annotation>
    </Property>
    <Property Name="Stock" Type="Edm.Int32">
      <Annotation Term="Validation.Minimum" Int="0"/>
      <Annotation Term="Validation.Maximum" Int="500"/>
      <Annotation Term="Core.Immutable"/>
    </Property>
    <Property Name="Plain" Type="Edm.String"/>
  </EntityType>
  <EntityType Name="Tag"><Key><PropertyRef Name="Id"/></Key><Property Name="Id" Type="Edm.Int32"/></EntityType>
  <EntityContainer Name="C">
    <EntitySet Name="Products" EntityType="N.Product">
      <Annotation Term="Capabilities.InsertRestrictions"><Record><PropertyValue Property="Insertable" Bool="false"/></Record></Annotation>
      <Annotation Term="Capabilities.SearchRestrictions"><Record><PropertyValue Property="Searchable" Bool="false"/></Record></Annotation>
      <Annotation Term="Capabilities.CountRestrictions"><Record/></Annotation>
    </EntitySet>
    <EntitySet Name="Tags" EntityType="N.Tag"/>
  </EntityContainer>
</Schema></edmx:DataServices></edmx:Edmx>`;

const resolved = loadResolved(DOC);
beforeEach(() => {
  useStore.setState(useStore.getInitialState(), true);
  stubLayout();
});

function open(id: string, kind: TabKind) {
  renderView(<ElementView tab={{ id, kind, pinned: true }} resolved={resolved} />);
}

describe('capability badges', () => {
  it('shows what an entity set allows, and the other capabilities only when switched off', () => {
    open('N.C/Products', 'entitySet');
    const badges = within(screen.getByRole('list', { name: 'Capabilities' }));
    expect(badges.getAllByRole('listitem').map((b) => b.textContent)).toEqual([
      'Not insertable',
      'Updatable',
      'Deletable',
      'Filterable',
      'Not searchable',
    ]);
  });

  it('shows no capabilities for a set without restriction annotations', () => {
    open('N.C/Tags', 'entitySet');
    expect(screen.queryByText('Capabilities')).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Capabilities' })).not.toBeInTheDocument();
  });

  it('shows them next to the sets in "Exposed as"', () => {
    open('N.Product', 'entityType');
    const exposed = screen.getByText('Exposed as').closest('section') as HTMLElement;
    expect(within(exposed).getByRole('button', { name: 'Products' })).toBeInTheDocument();
    expect(within(exposed).getByText('Not insertable')).toBeInTheDocument();
  });

  it('adds none to a set without restrictions in "Exposed as"', () => {
    open('N.Tag', 'entityType');
    const exposed = screen.getByText('Exposed as').closest('section') as HTMLElement;
    expect(within(exposed).getByRole('button', { name: 'Tags' })).toBeInTheDocument();
    expect(within(exposed).queryByRole('list')).not.toBeInTheDocument();
  });
});

describe('property notes', () => {
  const rows = () =>
    within(screen.getByRole('table', { name: 'Properties' }))
      .getAllByRole('row')
      .slice(1);

  it('marks computed and immutable properties and shows validation hints', () => {
    open('N.Product', 'entityType');
    expect(screen.getByRole('columnheader', { name: 'Notes' })).toBeInTheDocument();
    const [id, size, stock, plain] = rows();
    expect(id).toHaveTextContent('Computed');
    expect(size).toHaveTextContent('One of: S, M');
    expect(stock).toHaveTextContent('Immutable');
    expect(stock).toHaveTextContent('At least 0; At most 500');
    expect(plain).not.toHaveTextContent(/Computed|Immutable|At least/);
  });

  it('adds no column to a type without such annotations', () => {
    open('N.Tag', 'entityType');
    expect(screen.queryByRole('columnheader', { name: 'Notes' })).not.toBeInTheDocument();
  });
});
