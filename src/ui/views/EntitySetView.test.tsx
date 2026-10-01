import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import trippin from '../../../fixtures/trippin.xml?raw';
import { useStore, type TabKind } from '../../app/store.ts';
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

function open(id: string, kind: TabKind, text = trippin) {
  renderView(<ElementView tab={{ id, kind, pinned: true }} resolved={loadResolved(text)} />);
}
const technical = () => fireEvent.click(screen.getByRole('button', { name: 'Technical' }));
const rowsOf = (name: string) =>
  within(screen.getByRole('table', { name })).getAllByRole('row').slice(1);

describe('entity set view', () => {
  it('links to its type and shows its navigation bindings', () => {
    open(`${NS}.DefaultContainer/People`, 'entitySet');
    expect(screen.getByRole('heading', { level: 2, name: 'People' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Person' })).toBeInTheDocument();
    expect(screen.getByText('Navigation bindings (6)')).toBeInTheDocument();
    const rows = rowsOf('Navigation bindings');
    expect(rows[0]).toHaveTextContent('FriendsPeople');
    expect(rows[1]).toHaveTextContent('Flight/AirlineAirlines');
    fireEvent.click(within(rows[0] as HTMLElement).getByRole('button', { name: 'People' }));
    expect(useStore.getState().activeTab).toBe(`${NS}.DefaultContainer/People`);
  });

  it('shows the raw paths and whether they resolved in technical mode', () => {
    open(`${NS}.DefaultContainer/People`, 'entitySet');
    technical();
    const rows = rowsOf('Navigation bindings');
    expect(rows[1]).toHaveTextContent(`${NS}.Flight/AirlineAirlinesyes`);
    expect(screen.getByText('IncludeInServiceDocument')).toBeInTheDocument();
  });

  it('shows a singleton the same way', () => {
    open(`${NS}.DefaultContainer/Me`, 'singleton');
    expect(screen.getByText('Singleton')).toBeInTheDocument();
    expect(screen.getByText('Navigation bindings (6)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Person' })).toBeInTheDocument();
  });

  it('reports a set without bindings', () => {
    open(`${NS}.DefaultContainer/Airlines`, 'entitySet');
    expect(screen.getByText('No navigation property is bound.')).toBeInTheDocument();
  });
});

describe('container view', () => {
  it('lists the sets, singletons and imports', () => {
    open(`${NS}.DefaultContainer`, 'entityContainer');
    expect(screen.getByText('Entity sets (4)')).toBeInTheDocument();
    expect(screen.getByText('Singletons (1)')).toBeInTheDocument();
    expect(screen.getByText('Action imports (1)')).toBeInTheDocument();
    expect(screen.getByText('Function imports (1)')).toBeInTheDocument();
    expect(rowsOf('Entity sets')[0]).toHaveTextContent('PhotosPhoto');
    expect(rowsOf('Function imports')[0]).toHaveTextContent('GetNearestAirportGetNearestAirport');
    fireEvent.click(screen.getByRole('button', { name: 'Me' }));
    expect(useStore.getState().activeTab).toBe(`${NS}.DefaultContainer/Me`);
  });

  it('shows qualified names in technical mode', () => {
    open(`${NS}.DefaultContainer`, 'entityContainer');
    technical();
    expect(rowsOf('Action imports')[0]).toHaveTextContent(`ResetDataSource${NS}.ResetDataSource`);
  });

  it('shows what it extends', () => {
    const xml = `<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"><edmx:DataServices><Schema Namespace="NS" xmlns="http://docs.oasis-open.org/odata/ns/edm"><EntityContainer Name="Base"/><EntityContainer Name="Child" Extends="NS.Base"/></Schema></edmx:DataServices></edmx:Edmx>`;
    open('NS.Child', 'entityContainer', xml);
    expect(screen.getByText('Extends')).toBeInTheDocument();
    expect(screen.getByText('Nothing is exposed.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Base' }));
    expect(useStore.getState().activeTab).toBe('NS.Base');
  });
});
