import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import aliases from '../../../fixtures/aliases.xml?raw';
import northwind from '../../../fixtures/northwind.xml?raw';
import trippin from '../../../fixtures/trippin.xml?raw';
import unresolved from '../../../fixtures/unresolved.xml?raw';
import { useStore } from '../../app/store.ts';
import { stubLayout } from '../../test/layout.ts';
import { loadResolved, renderView } from '../../test/views.tsx';
import { ElementView } from './ElementView.tsx';

const initial = useStore.getInitialState();
beforeEach(() => {
  useStore.setState(initial, true);
  stubLayout();
});
afterEach(() => vi.restoreAllMocks());

function open(
  text: string,
  pick: (namespaces: { namespace: string; hasContainer: boolean }[]) => string,
) {
  const resolved = loadResolved(text);
  const id = pick(
    resolved.model.schemas.map((s) => ({
      namespace: s.namespace,
      hasContainer: s.entityContainers.length > 0,
    })),
  );
  renderView(<ElementView tab={{ id, kind: 'schema', pinned: true }} resolved={resolved} />);
}
const first = (all: { namespace: string }[]) => all[0]?.namespace ?? '';
const facts = () => screen.getByRole('heading', { name: 'What it defines' }).parentElement;

describe('schema view', () => {
  it('shows the counts of TripPin', () => {
    open(trippin, first);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Microsoft.OData.SampleService.Models.TripPin',
    );
    const f = facts();
    expect(f).toHaveTextContent('Entity types9');
    expect(f).toHaveTextContent('Complex types4');
    expect(f).toHaveTextContent('Enum types1');
    expect(f).toHaveTextContent('Actions2');
    expect(f).toHaveTextContent('Functions4');
    expect(f).toHaveTextContent('Entity sets4');
    expect(f).toHaveTextContent('Singletons1');
    expect(f).not.toHaveTextContent('Terms');
    expect(screen.getByText(/All \d+ references resolve\./)).toBeInTheDocument();
  });

  it('shows the counts of each Northwind schema', () => {
    open(northwind, first);
    expect(facts()).toHaveTextContent('Entity types26');
    expect(facts()).not.toHaveTextContent('Entity sets');
  });

  it('shows the Northwind schema with the container', () => {
    open(northwind, (all) => all.find((s) => s.hasContainer)?.namespace ?? '');
    expect(facts()).toHaveTextContent('Entity sets26');
    expect(facts()).not.toHaveTextContent('Entity types');
  });

  it('shows the alias in technical mode', () => {
    open(aliases, () => 'Org.Example.Model');
    expect(screen.queryByText('Alias')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Technical' }));
    expect(screen.getByText('Alias')).toBeInTheDocument();
    expect(screen.getByText('alias M')).toBeInTheDocument();
    expect(screen.getByText('Overloads')).toBeInTheDocument();
  });

  it('lists the references that do not resolve', () => {
    open(unresolved, first);
    expect(screen.getByText(/could not be found/)).toBeInTheDocument();
    const list = screen.getByRole('list');
    expect(within(list).getAllByRole('listitem').length).toBeGreaterThan(0);
    const table = screen.getByRole('table', { name: 'Referenced namespaces' });
    expect(within(table).getAllByText('Not available').length).toBeGreaterThan(0);
  });

  it('shows the status of a referenced vocabulary', () => {
    open(aliases, () => 'Org.Example.Model');
    const table = screen.getByRole('table', { name: 'Referenced namespaces' });
    expect(within(table).getByText('Org.OData.Core.V1 (Core)')).toBeInTheDocument();
    expect(within(table).getByText('Built-in vocabulary')).toBeInTheDocument();
  });
});
