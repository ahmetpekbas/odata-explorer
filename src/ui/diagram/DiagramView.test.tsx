import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import trippin from '../../../fixtures/trippin.xml?raw';
import { diagramTab } from '../../app/diagram-tab.ts';
import { stubLayout } from '../../test/layout.ts';
import { loadResolved, renderView } from '../../test/views.tsx';
import DiagramView from './DiagramView.tsx';

const NS = 'Microsoft.OData.SampleService.Models.TripPin';
const resolved = loadResolved(trippin);

// jsdom has no DOMMatrixReadOnly, which React Flow reads the zoom from.
beforeEach(() => {
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
    renderView(<DiagramView resolved={resolved} tabId={diagramTab(`${NS}.Person`).id} />);
    const figure = await screen.findByRole('figure', { name: `Relationships of ${NS}.Person` });
    for (const name of ['Person', 'Trip', 'Photo']) {
      expect((await screen.findAllByTitle(name)).length).toBeGreaterThan(0);
    }
    expect(figure).toBeInTheDocument();
    expect(screen.queryByTitle('Airline')).not.toBeInTheDocument();
  });

  it('shows the key and the navigation properties of a type', async () => {
    renderView(<DiagramView resolved={resolved} tabId={diagramTab(`${NS}.Person`).id} />);
    await screen.findAllByTitle('Person');
    expect(screen.getByTitle('UserName')).toBeInTheDocument();
    for (const name of ['Friends', 'Trips', 'Photo']) {
      expect(screen.getAllByTitle(name).length).toBeGreaterThan(0);
    }
    // Plain properties wait for the expanded view.
    expect(screen.queryByTitle('FirstName')).not.toBeInTheDocument();
  });

  it('says so when the type is not in the model', () => {
    renderView(<DiagramView resolved={resolved} tabId="diagram:NS.Nope" />);
    expect(screen.getByText(/is not a type of this model/)).toBeInTheDocument();
  });
});
