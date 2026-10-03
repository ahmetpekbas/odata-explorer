import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import trippin from '../../../fixtures/trippin.xml?raw';
import { diagramTab } from '../../app/diagram-tab.ts';
import { useStore } from '../../app/store.ts';
import { stubLayout } from '../../test/layout.ts';
import { loadResolved, renderView } from '../../test/views.tsx';
import DiagramView from './DiagramView.tsx';
import type { Layout } from './layout.ts';

const NS = 'Microsoft.OData.SampleService.Models.TripPin';
const resolved = loadResolved(trippin);
// jsdom has no Worker; a row of nodes stands in for the real layout.
const row: Layout = ({ nodes }) =>
  Promise.resolve({
    nodes: Object.fromEntries(nodes.map((n, i) => [n.id, { x: i * 300, y: 0 }])),
    edges: {},
  });

// jsdom has no DOMMatrixReadOnly, which React Flow reads the zoom from.
const initial = useStore.getInitialState();
beforeEach(() => {
  useStore.setState(initial, true);
  stubLayout();
  vi.stubGlobal(
    'DOMMatrixReadOnly',
    class {
      m22 = 1;
    },
  );
});
afterEach(() => vi.restoreAllMocks());

describe('DiagramView', () => {
  it('renders Person with the types one hop away', async () => {
    renderView(
      <DiagramView resolved={resolved} tabId={diagramTab(`${NS}.Person`).id} layout={row} />,
    );
    const figure = await screen.findByRole('figure', { name: `Relationships of ${NS}.Person` });
    for (const name of ['Person', 'Trip', 'Photo']) {
      expect((await screen.findAllByTitle(name)).length).toBeGreaterThan(0);
    }
    expect(figure).toBeInTheDocument();
    expect(screen.queryByTitle('Airline')).not.toBeInTheDocument();
  });

  it('shows the key and the navigation properties of a type', async () => {
    renderView(
      <DiagramView resolved={resolved} tabId={diagramTab(`${NS}.Person`).id} layout={row} />,
    );
    await screen.findAllByTitle('Person');
    expect(screen.getByTitle('UserName')).toBeInTheDocument();
    for (const name of ['Friends', 'Trips', 'Photo']) {
      expect(screen.getAllByTitle(name).length).toBeGreaterThan(0);
    }
    // Plain properties wait for the expanded view.
    expect(screen.queryByTitle('FirstName')).not.toBeInTheDocument();
  });

  it('says so when the type is not in the model', () => {
    renderView(<DiagramView resolved={resolved} tabId="diagram:NS.Nope" layout={row} />);
    expect(screen.getByText(/is not a type of this model/)).toBeInTheDocument();
  });

  describe('controls', () => {
    const show = () =>
      renderView(
        <DiagramView resolved={resolved} tabId={diagramTab(`${NS}.Person`).id} layout={row} />,
      );

    it('reaches further with more hops', async () => {
      show();
      await screen.findAllByTitle('Person');
      expect(screen.queryByTitle('PlanItem')).not.toBeInTheDocument();
      fireEvent.change(screen.getByRole('combobox', { name: 'Hops' }), { target: { value: '2' } });
      expect((await screen.findAllByTitle('PlanItem')).length).toBeGreaterThan(0);
    });

    it('lists every property when asked', async () => {
      show();
      await screen.findAllByTitle('Person');
      fireEvent.click(screen.getByRole('switch', { name: 'All properties' }));
      expect(await screen.findByTitle('FirstName')).toBeInTheDocument();
    });

    it('adds the base and derived types unless inheritance is off', async () => {
      useStore.getState().setDiagramOptions(`diagram:${NS}.PublicTransportation`, { hops: 1 });
      renderView(
        <DiagramView
          resolved={resolved}
          tabId={diagramTab(`${NS}.PublicTransportation`).id}
          layout={row}
        />,
      );
      expect((await screen.findAllByTitle('PlanItem')).length).toBeGreaterThan(0);
      expect(screen.getAllByTitle('Flight').length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('switch', { name: 'Inheritance' }));
      await waitFor(() => expect(screen.queryByTitle('PlanItem')).not.toBeInTheDocument());
    });

    it('keeps the settings in the store, so they survive a switch of tab', async () => {
      const view = show();
      await screen.findAllByTitle('Person');
      fireEvent.change(screen.getByRole('combobox', { name: 'Hops' }), { target: { value: '3' } });
      view.unmount();
      show();
      expect(screen.getByRole('combobox', { name: 'Hops' })).toHaveValue('3');
    });

    it('explains how to narrow a neighborhood that is too large, and keeps the controls', () => {
      const spokes = Array.from({ length: 160 }, (_, i) => i);
      const xml = `<?xml version="1.0"?><edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx"><edmx:DataServices><Schema Namespace="Big" xmlns="http://docs.oasis-open.org/odata/ns/edm"><EntityType Name="Hub"><Key><PropertyRef Name="Id"/></Key><Property Name="Id" Type="Edm.Int32" Nullable="false"/>${spokes.map((i) => `<NavigationProperty Name="N${i}" Type="Big.S${i}"/>`).join('')}</EntityType>${spokes.map((i) => `<EntityType Name="S${i}"><Key><PropertyRef Name="Id"/></Key><Property Name="Id" Type="Edm.Int32" Nullable="false"/></EntityType>`).join('')}</Schema></edmx:DataServices></edmx:Edmx>`;
      renderView(<DiagramView resolved={loadResolved(xml)} tabId="diagram:Big.Hub" layout={row} />);
      expect(screen.getByText(/161 types are within 1 hop, more than the 150/)).toBeInTheDocument();
      expect(screen.getByRole('toolbar', { name: 'Diagram options' })).toBeInTheDocument();
      expect(screen.queryByRole('figure')).not.toBeInTheDocument();
    });
  });

  it('opens the tab of a clicked node, and pins it on a double click', async () => {
    renderView(
      <DiagramView resolved={resolved} tabId={diagramTab(`${NS}.Person`).id} layout={row} />,
    );
    const [trip] = await screen.findAllByTitle('Trip');
    const node = trip?.closest('.react-flow__node');
    if (!node) throw new Error('no node for Trip');
    fireEvent.click(node);
    expect(useStore.getState().tabs).toEqual([
      { id: `${NS}.Trip`, kind: 'entityType', pinned: false },
    ]);
    fireEvent.doubleClick(node);
    expect(useStore.getState().tabs[0]?.pinned).toBe(true);
  });
});
