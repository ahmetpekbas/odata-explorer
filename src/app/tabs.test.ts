import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store.ts';

const initial = useStore.getInitialState();
beforeEach(() => useStore.setState(initial, true));

const a = { id: 'NS.A', kind: 'entityType' } as const;
const b = { id: 'NS.B', kind: 'entityType' } as const;
const c = { id: 'NS.C', kind: 'complexType' } as const;
const ids = () => useStore.getState().tabs.map((t) => t.id);
const pinned = () =>
  useStore
    .getState()
    .tabs.filter((t) => t.pinned)
    .map((t) => t.id);
const active = () => useStore.getState().activeTab;

describe('tabs', () => {
  it('opens a single click as a preview and replaces it with the next one', () => {
    const s = useStore.getState();
    s.openTab(a);
    s.openTab(b);
    expect(ids()).toEqual(['NS.B']);
    expect(pinned()).toEqual([]);
    expect(active()).toBe('NS.B');
    expect(useStore.getState().selection).toBe('NS.B');
  });

  it('keeps pinned tabs and puts the preview in the old preview slot', () => {
    const s = useStore.getState();
    s.openTab(a, true);
    s.openTab(b);
    s.openTab(c, true);
    expect(ids()).toEqual(['NS.A', 'NS.B', 'NS.C']);
    s.openTab({ id: 'NS.D', kind: 'enumType' });
    expect(ids()).toEqual(['NS.A', 'NS.D', 'NS.C']);
    expect(pinned()).toEqual(['NS.A', 'NS.C']);
  });

  it('pins a preview when it is opened again with a double-click', () => {
    const s = useStore.getState();
    s.openTab(a);
    s.openTab(a, true);
    expect(pinned()).toEqual(['NS.A']);
    s.openTab(b);
    expect(ids()).toEqual(['NS.A', 'NS.B']);
  });

  it('does not unpin a pinned tab when it is clicked again', () => {
    const s = useStore.getState();
    s.openTab(a, true);
    s.openTab(a);
    expect(pinned()).toEqual(['NS.A']);
  });

  it('pins a tab explicitly', () => {
    const s = useStore.getState();
    s.openTab(a);
    s.pinTab('NS.A');
    s.openTab(b);
    expect(ids()).toEqual(['NS.A', 'NS.B']);
  });

  it('activates the right neighbour when the active tab closes, else the left', () => {
    const s = useStore.getState();
    s.openTab(a, true);
    s.openTab(b, true);
    s.openTab(c, true);
    s.activateTab('NS.B');
    s.closeTab('NS.B');
    expect(active()).toBe('NS.C');
    s.closeTab('NS.C');
    expect(active()).toBe('NS.A');
    s.closeTab('NS.A');
    expect(active()).toBeUndefined();
    expect(useStore.getState().selection).toBeUndefined();
  });

  it('keeps the active tab when another one closes', () => {
    const s = useStore.getState();
    s.openTab(a, true);
    s.openTab(b, true);
    s.closeTab('NS.A');
    expect(active()).toBe('NS.B');
    expect(ids()).toEqual(['NS.B']);
  });

  it('closes the other tabs and activates the one that is left', () => {
    const s = useStore.getState();
    s.openTab(a, true);
    s.openTab(b, true);
    s.openTab(c);
    s.closeOtherTabs('NS.A');
    expect(ids()).toEqual(['NS.A']);
    expect(active()).toBe('NS.A');
  });

  it('starts without tabs when another document becomes active', () => {
    const s = useStore.getState();
    s.openTab(a, true);
    s.startLoading({ id: 'x', name: 'x.xml', size: 1 });
    expect(useStore.getState()).toMatchObject({ tabs: [], activeTab: undefined });
  });
});
