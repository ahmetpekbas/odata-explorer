import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import trippin from '../fixtures/trippin.xml?raw';
import { App } from './App.tsx';
import { useStore } from './app/store.ts';
import { stubSystemScheme } from './test/matchMedia.ts';
import { stubLayout } from './test/layout.ts';
import { load } from './worker/load.ts';

const NS = 'Microsoft.OData.SampleService.Models.TripPin';
const initial = useStore.getInitialState();

beforeEach(() => {
  stubSystemScheme('light');
  stubLayout();
  useStore.setState(initial, true);
  const result = load(trippin);
  if (!result.ok) throw new Error(result.error);
  const s = useStore.getState();
  s.startLoading({ id: 'd', name: 'trippin.xml', size: trippin.length });
  s.finishLoading('d', result.resolved, trippin, result.index);
});
afterEach(() => vi.restoreAllMocks());

describe('search shortcut', () => {
  it('opens the palette on Ctrl+K and shows the chosen result in a tab', async () => {
    render(<App />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const box = await screen.findByRole('combobox', { name: 'Search the model' });
    fireEvent.change(box, { target: { value: 'nearestairport' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(useStore.getState().activeTab).toBe(`${NS}.GetNearestAirport`);
    expect(useStore.getState().selection).toBe(`${NS}.GetNearestAirport`);
    await waitFor(() => expect(screen.queryByRole('combobox')).not.toBeInTheDocument());
  });

  it('opens a property in the tab of its type, with the property selected', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Search/ }));
    const box = await screen.findByRole('combobox');
    fireEvent.change(box, { target: { value: 'ConfirmationCode' } });
    fireEvent.keyDown(box, { key: 'Enter' });
    expect(useStore.getState().activeTab).toBe(`${NS}.PlanItem`);
    expect(useStore.getState().selection).toBe(`${NS}.PlanItem/ConfirmationCode`);
  });
});
