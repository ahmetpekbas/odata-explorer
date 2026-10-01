import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import aliases from '../../../fixtures/aliases.xml?raw';
import trippin from '../../../fixtures/trippin.xml?raw';
import { useStore, type TabKind } from '../../app/store.ts';
import type { Resolved } from '../../csdl/resolve.ts';
import { stubLayout } from '../../test/layout.ts';
import { loadResolved, renderView } from '../../test/views.tsx';
import { bundledVocabulary } from '../../vocabularies/index.ts';
import { ElementView } from './ElementView.tsx';

const TRIPPIN = 'Microsoft.OData.SampleService.Models.TripPin';
const CORE = 'Org.OData.Core.V1';
const initial = useStore.getInitialState();
beforeEach(() => {
  useStore.setState(initial, true);
  stubLayout();
});
afterEach(() => vi.restoreAllMocks());

function open(resolved: Resolved, id: string, kind: TabKind) {
  renderView(<ElementView tab={{ id, kind, pinned: true }} resolved={resolved} />);
}
const core = () => {
  const resolved = bundledVocabulary(CORE);
  if (!resolved) throw new Error('Core vocabulary is not bundled');
  return resolved;
};
const technical = () => fireEvent.click(screen.getByRole('button', { name: 'Technical' }));
const members = () => within(screen.getByRole('table', { name: 'Members' }));

describe('complex type view', () => {
  it('has properties but no key', () => {
    open(loadResolved(trippin), `${TRIPPIN}.Location`, 'complexType');
    expect(screen.getByText('Complex type')).toBeInTheDocument();
    expect(screen.queryByText('Identified by')).not.toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Properties' });
    expect(within(table).getByText('Address')).toBeInTheDocument();
    expect(within(table).getByRole('button', { name: 'City' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EventLocation' })).toBeInTheDocument();
  });

  it('shows the open type and facets in technical mode', () => {
    open(loadResolved(trippin), `${TRIPPIN}.AirportLocation`, 'complexType');
    technical();
    expect(screen.getByText('open type')).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Properties' });
    expect(within(table).getByText('4326')).toBeInTheDocument();
    expect(within(table).getAllByText('Location').length).toBeGreaterThan(0);
  });
});

describe('enum type view', () => {
  it('lists members with their values', () => {
    open(loadResolved(trippin), `${TRIPPIN}.PersonGender`, 'enumType');
    expect(screen.getByText('A choice of exactly one of these values.')).toBeInTheDocument();
    const rows = members().getAllByRole('row').slice(1);
    expect(rows.map((r) => r.textContent)).toEqual(['Male0', 'Female1', 'Unknown2']);
  });

  it('shows IsFlags and the underlying type', () => {
    open(core(), `${CORE}.Permission`, 'enumType');
    expect(
      screen.getByText('A choice of one or more of these values at once.'),
    ).toBeInTheDocument();
    technical();
    expect(screen.getAllByText('IsFlags')).toHaveLength(2);
    expect(screen.getByText('Edm.Int32')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
  });

  it('shows the ID of each member in technical mode', () => {
    open(loadResolved(aliases), 'Org.Example.Extra.Status', 'enumType');
    technical();
    const rows = members().getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Active0Org.Example.Extra.Status/Active');
    expect(rows[1]).toHaveTextContent('Closed1Org.Example.Extra.Status/Closed');
  });
});

describe('type definition view', () => {
  it('says what it is based on, with its facets', () => {
    const resolved = loadResolved(aliases);
    open(resolved, 'Org.Example.Extra.Code', 'typeDefinition');
    expect(screen.getByText('Text (max 5)')).toBeInTheDocument();
    technical();
    expect(screen.getByText('Edm.String')).toBeInTheDocument();
    expect(screen.getByText('MaxLength')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});

describe('term view', () => {
  it('shows the type, where it applies and the default', () => {
    open(core(), `${CORE}.IsLanguageDependent`, 'term');
    const definition = screen.getByRole('heading', { name: 'Definition' })
      .parentElement as HTMLElement;
    expect(definition).toHaveTextContent('Applies toTerms, Properties');
    expect(definition).toHaveTextContent('Default valuetrue');
    expect(within(definition).getByRole('button', { name: 'Tag' })).toBeInTheDocument();
  });

  it('shows the raw type, base term and AppliesTo in technical mode', () => {
    open(loadResolved(aliases), 'Org.Example.Extra.Note', 'term');
    technical();
    const definition = screen.getByRole('heading', { name: 'Definition' })
      .parentElement as HTMLElement;
    expect(definition).toHaveTextContent('Org.Example.Extra.Code');
    expect(definition).toHaveTextContent(`${CORE}.Description`);
    expect(definition).toHaveTextContent('NullableYes');
  });

  it('opens a term whose type is a model type', () => {
    open(loadResolved(aliases), 'Org.Example.Extra.Flags', 'term');
    expect(screen.getByText('Entity types')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Status (choice)' }));
    expect(useStore.getState().activeTab).toBe('Org.Example.Extra.Status');
  });
});
