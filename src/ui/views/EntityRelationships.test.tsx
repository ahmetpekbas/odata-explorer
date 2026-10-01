import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import trippin from '../../../fixtures/trippin.xml?raw';
import { useStore } from '../../app/store.ts';
import { stubLayout } from '../../test/layout.ts';
import { loadResolved, renderView } from '../../test/views.tsx';
import { ElementView } from './ElementView.tsx';

const NS = 'Microsoft.OData.SampleService.Models.TripPin';
const initial = useStore.getInitialState();
beforeEach(() => {
  useStore.setState(initial, true);
  stubLayout();
});
afterEach(() => vi.restoreAllMocks());

function open(text: string, id: string) {
  renderView(
    <ElementView tab={{ id, kind: 'entityType', pinned: true }} resolved={loadResolved(text)} />,
  );
}

const EMPLOYEE = `<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"><edmx:DataServices><Schema Namespace="NS" xmlns="http://docs.oasis-open.org/odata/ns/edm">
<EntityType Name="Person"><Key><PropertyRef Name="Id"/></Key><Property Name="Id" Type="Edm.Int32" Nullable="false"/><NavigationProperty Name="Friends" Type="Collection(NS.Person)"/></EntityType>
<EntityType Name="Employee" BaseType="NS.Person"><Property Name="Salary" Type="Edm.Decimal"/>
<NavigationProperty Name="Boss" Type="NS.Employee" Partner="Reports"><ReferentialConstraint Property="BossId" ReferencedProperty="Id"/><OnDelete Action="Cascade"/></NavigationProperty>
<NavigationProperty Name="Reports" Type="Collection(NS.Employee)" Partner="Boss" ContainsTarget="true"/></EntityType>
<EntityContainer Name="C"><EntitySet Name="People" EntityType="NS.Person"/><Singleton Name="Me" EntityType="NS.Person" Type="NS.Person"/></EntityContainer>
</Schema></edmx:DataServices></edmx:Edmx>`;

describe('EntityRelationships', () => {
  it('shows what Person links to, with cardinality', () => {
    open(trippin, `${NS}.Person`);
    const table = screen.getByRole('table', { name: 'Navigation properties' });
    expect(screen.getByText('Links to (3)')).toBeInTheDocument();
    const row = (name: string) =>
      within(table)
        .getAllByRole('row')
        .find((r) => r.textContent?.startsWith(name));
    expect(row('Friends')).toHaveTextContent('Link to Person (many)');
    expect(row('Trips')).toHaveTextContent('Link to Trip (many) · contained');
    expect(row('Photo')).toHaveTextContent('Link to Photo');
    expect(row('Photo')).not.toHaveTextContent('(many)');
  });

  it('opens the target of a link', () => {
    open(trippin, `${NS}.Person`);
    fireEvent.click(screen.getByRole('button', { name: 'Link to Trip (many)' }));
    expect(useStore.getState().activeTab).toBe(`${NS}.Trip`);
  });

  it('shows the technical details of a link', () => {
    open(EMPLOYEE, 'NS.Employee');
    fireEvent.click(screen.getByRole('button', { name: 'Technical' }));
    const table = screen.getByRole('table', { name: 'Navigation properties' });
    const boss = within(table)
      .getAllByRole('row')
      .find((r) => r.textContent?.startsWith('Boss'));
    expect(boss).toHaveTextContent('NS.Employee');
    expect(boss).toHaveTextContent('Reports');
    expect(boss).toHaveTextContent('BossId → Id');
    expect(boss).toHaveTextContent('Cascade');
    const reports = within(table)
      .getAllByRole('row')
      .find((r) => r.textContent?.startsWith('Reports'));
    expect(reports).toHaveTextContent('Yes');
    const friends = within(table)
      .getAllByRole('row')
      .find((r) => r.textContent?.startsWith('Friends'));
    expect(friends).toHaveTextContent('Person');
  });

  it('shows base and derived types', () => {
    open(EMPLOYEE, 'NS.Person');
    expect(screen.getByRole('button', { name: 'Employee' })).toBeInTheDocument();
    expect(screen.getByText('Derived types')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Employee' }));
    expect(useStore.getState().activeTab).toBe('NS.Employee');
  });

  it('lists the base chain of a derived type', () => {
    open(trippin, `${NS}.Flight`);
    expect(screen.getByText('Inherits from')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PublicTransportation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PlanItem' })).toBeInTheDocument();
  });

  it('shows where the type is exposed', () => {
    open(trippin, `${NS}.Person`);
    expect(screen.getByText('Exposed as')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'People' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Me' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'People' }));
    expect(useStore.getState().activeTab).toBe(`${NS}.DefaultContainer/People`);
  });
});
