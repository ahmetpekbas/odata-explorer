import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import trippin from '../../../fixtures/trippin.xml?raw';
import { stubLayout } from '../../test/layout.ts';
import { renderView } from '../../test/views.tsx';
import { load } from '../../worker/load.ts';
import { CommandPalette } from './CommandPalette.tsx';

const NS = 'Microsoft.OData.SampleService.Models.TripPin';
const result = load(trippin);
if (!result.ok) throw new Error(result.error);
const { index } = result;

beforeEach(() => stubLayout());
afterEach(() => vi.restoreAllMocks());

function setup() {
  const onChoose = vi.fn();
  const onOpenChange = vi.fn();
  renderView(<CommandPalette open onOpenChange={onOpenChange} index={index} onChoose={onChoose} />);
  const box = screen.getByRole('combobox', { name: 'Search the model' });
  const type = (value: string) => fireEvent.change(box, { target: { value } });
  const key = (k: string) => fireEvent.keyDown(box, { key: k });
  return { box, type, key, onChoose, onOpenChange };
}

const options = () => screen.queryAllByRole('option').map((o) => o.textContent);

describe('command palette', () => {
  it('focuses the search box and lists nothing until there is a query', async () => {
    const { box } = setup();
    await waitFor(() => expect(box).toHaveFocus());
    expect(options()).toEqual([]);
  });

  it('shows the kind and the parent of each result', () => {
    const { type } = setup();
    type('friends');
    expect(options()[0]).toBe(`FriendsNavigation property${NS}.Person`);
  });

  it('opens the best match with Enter, from the keyboard alone', () => {
    const { type, key, onChoose, onOpenChange } = setup();
    type('person');
    key('Enter');
    expect(onChoose).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'entityType', id: `${NS}.Person` }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('moves through the results with the arrow keys', () => {
    const { box, type, key, onChoose } = setup();
    type('person');
    const [first, second] = screen.getAllByRole('option');
    expect(box).toHaveAttribute('aria-activedescendant', first?.id);
    key('ArrowDown');
    expect(box).toHaveAttribute('aria-activedescendant', second?.id);
    key('ArrowUp');
    key('ArrowUp');
    expect(box).toHaveAttribute('aria-activedescendant', first?.id);
    key('ArrowDown');
    key('Enter');
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ id: `${NS}.PersonGender` }));
  });

  it('opens a result that is clicked', () => {
    const { type, onChoose } = setup();
    type('airline');
    fireEvent.click(screen.getByRole('option', { name: /^Airline\s*Entity type/ }));
    expect(onChoose).toHaveBeenCalledWith(expect.objectContaining({ id: `${NS}.Airline` }));
  });

  it('narrows the results with the kind filters', () => {
    const { type } = setup();
    type('name');
    expect(options().some((o) => o?.includes('Property'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Types' }));
    expect(screen.getByRole('button', { name: 'Types' })).toHaveAttribute('aria-pressed', 'true');
    expect(options().every((o) => !o?.includes('Property'))).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Types' }));
    expect(options().some((o) => o?.includes('Property'))).toBe(true);
  });

  it('says so when nothing matches', () => {
    const { type } = setup();
    type('zzzzzzzz');
    expect(screen.getByText('No matches.')).toBeInTheDocument();
  });
});
