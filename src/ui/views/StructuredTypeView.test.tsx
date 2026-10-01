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

function open(id: string) {
  const resolved = loadResolved(trippin);
  renderView(<ElementView tab={{ id, kind: 'entityType', pinned: true }} resolved={resolved} />);
  return resolved;
}

const columnHeaders = () =>
  within(screen.getByRole('table', { name: 'Properties' }))
    .getAllByRole('columnheader')
    .map((h) => h.textContent);

describe('StructuredTypeView', () => {
  it('shows the key and friendly columns', () => {
    open(`${NS}.Person`);
    expect(screen.getByRole('heading', { level: 2, name: 'Person' })).toBeInTheDocument();
    expect(screen.getByText('Identified by')).toBeInTheDocument();
    expect(columnHeaders()).toEqual(['Name', 'Type', 'Required', 'Description']);
    const table = screen.getByRole('table', { name: 'Properties' });
    const userName = within(table)
      .getAllByRole('row')
      .find((r) => r.textContent?.includes('UserName'));
    expect(userName).toHaveTextContent('Text');
    expect(userName).toHaveTextContent('Required');
    expect(within(table).getByText('List of Text')).toBeInTheDocument();
  });

  it('switches the columns in technical mode', () => {
    open(`${NS}.Person`);
    fireEvent.click(screen.getByRole('button', { name: 'Technical' }));
    expect(columnHeaders()).toEqual([
      'Name',
      'Type',
      'Nullable',
      'MaxLength',
      'Precision',
      'Scale',
      'SRID',
      'Unicode',
      'DefaultValue',
    ]);
    expect(screen.getByText('open type')).toBeInTheDocument();
    expect(screen.getByText('Collection(Edm.String)')).toBeInTheDocument();
    expect(screen.getByText('Key')).toBeInTheDocument();
  });

  it('marks media entities and inherited properties', () => {
    open(`${NS}.Flight`);
    expect(columnHeaders()).toContain('Declared on');
    const table = screen.getByRole('table', { name: 'Properties' });
    expect(within(table).getAllByText('PlanItem').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Technical' }));
    expect(screen.getByText(`${NS}.PlanItem`, { selector: 'dd' })).toBeInTheDocument();
  });

  it('opens the type of a property in a tab', () => {
    open(`${NS}.Person`);
    fireEvent.click(screen.getByRole('button', { name: 'PersonGender (choice)' }));
    expect(useStore.getState().activeTab).toBe(`${NS}.PersonGender`);
  });

  it('renders only the rows in view for a type with hundreds of properties', () => {
    const properties = Array.from(
      { length: 600 },
      (_, i) => `<Property Name="P${i}" Type="Edm.String" MaxLength="50"/>`,
    ).join('');
    const xml = `<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"><edmx:DataServices><Schema Namespace="NS" xmlns="http://docs.oasis-open.org/odata/ns/edm"><EntityType Name="Big"><Key><PropertyRef Name="P0"/></Key>${properties}</EntityType></Schema></edmx:DataServices></edmx:Edmx>`;
    renderView(
      <ElementView
        tab={{ id: 'NS.Big', kind: 'entityType', pinned: true }}
        resolved={loadResolved(xml)}
      />,
    );
    const table = screen.getByRole('table', { name: 'Properties' });
    expect(table).toHaveAttribute('aria-rowcount', '601');
    const rendered = within(table).getAllByRole('row').length;
    expect(rendered).toBeGreaterThan(1);
    expect(rendered).toBeLessThan(60);
    expect(screen.getByText('Properties (600)')).toBeInTheDocument();
    expect(within(table).getAllByText('Text (max 50)').length).toBeGreaterThan(0);
  });
});
