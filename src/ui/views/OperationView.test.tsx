import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import aliases from '../../../fixtures/aliases.xml?raw';
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

describe('operation view', () => {
  it('shows a bound function with its parameters and return type', () => {
    open(`${NS}.GetFriendsTrips`, 'function');
    expect(screen.getByRole('heading', { level: 2, name: 'GetFriendsTrips' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'GetFriendsTrips(userName)' })).toBeInTheDocument();
    expect(screen.getByText('Available on')).toBeInTheDocument();
    // Once as what the function is available on, once as its binding parameter.
    expect(screen.getAllByRole('button', { name: 'Person' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'List of Trip' })).toBeInTheDocument();
    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('person (the element it runs on)Person');
    expect(rows[1]).toHaveTextContent('userNameTextRequired');
    expect(screen.getByText('Not exposed by any function import.')).toBeInTheDocument();
  });

  it('shows composability, the entity set path and the raw signature in technical mode', () => {
    open(`${NS}.GetFriendsTrips`, 'function');
    technical();
    expect(
      screen.getByRole('heading', {
        name: `GetFriendsTrips(person: ${NS}.Person, userName: Edm.String): Collection(${NS}.Trip)`,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('person/Friends/Trips')).toBeInTheDocument();
    expect(screen.getByText('IsBound').nextSibling).toHaveTextContent('true');
    expect(screen.getByText('IsComposable').nextSibling).toHaveTextContent('true');
    expect(screen.getByText('bound')).toBeInTheDocument();
    expect(screen.getByText('composable')).toBeInTheDocument();
    expect(
      within(screen.getByRole('table')).getAllByText('(binding)', { exact: false }),
    ).toHaveLength(1);
  });

  it('shows an unbound action with no parameters and the import that exposes it', () => {
    open(`${NS}.ResetDataSource`, 'action');
    expect(screen.getByText('Action', { selector: '.fui-Badge' })).toBeInTheDocument();
    expect(screen.getByText('The service itself')).toBeInTheDocument();
    expect(screen.getByText('Nothing')).toBeInTheDocument();
    expect(screen.getByText('No parameters.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'ResetDataSource' }));
    expect(useStore.getState().activeTab).toBe(`${NS}.DefaultContainer/ResetDataSource`);
  });

  it('lists every overload under one name', () => {
    open('Org.Example.Model.Reset', 'action', aliases);
    expect(
      screen
        .getAllByRole('heading', { level: 3 })
        .filter((h) => h.textContent?.startsWith('Reset(')),
    ).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'ResetAll' })).toBeInTheDocument();
  });
});

describe('import view', () => {
  it('links to the operation and the entity set', () => {
    open(`${NS}.DefaultContainer/GetNearestAirport`, 'functionImport');
    expect(screen.getByText('Function import')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Airports' }));
    expect(useStore.getState().activeTab).toBe(`${NS}.DefaultContainer/Airports`);
    fireEvent.click(screen.getByRole('button', { name: 'GetNearestAirport' }));
    expect(useStore.getState().activeTab).toBe(`${NS}.GetNearestAirport`);
  });
});
