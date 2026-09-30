import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BUDGET_BYTES,
  clearRecent,
  forgetRecent,
  getRecentText,
  listRecent,
  onRecentChange,
  saveRecent,
  saveTabs,
} from './persistence.ts';

const file = (id: string, name = `${id}.xml`) => ({ id, name, format: 'xml' as const });

beforeEach(() => clearRecent());

describe('recent files', () => {
  it('saves a file with its size and lists it', async () => {
    expect(await saveRecent(file('a'), 'héllo', 100)).toBe(true);
    expect(await listRecent()).toEqual([
      { id: 'a', name: 'a.xml', format: 'xml', size: 6, openedAt: 100 },
    ]);
    expect(await getRecentText('a')).toBe('héllo');
  });

  it('lists the most recently opened first', async () => {
    await saveRecent(file('a'), 'x', 1);
    await saveRecent(file('b'), 'x', 3);
    await saveRecent(file('c'), 'x', 2);
    expect((await listRecent()).map((f) => f.id)).toEqual(['b', 'c', 'a']);
  });

  it('replaces an earlier file of the same name', async () => {
    await saveRecent(file('a', 'same.xml'), 'old', 1);
    await saveRecent(file('b', 'same.xml'), 'new', 2);
    expect((await listRecent()).map((f) => f.id)).toEqual(['b']);
    expect(await getRecentText('a')).toBeUndefined();
  });

  it('forgets one file and clears all', async () => {
    await saveRecent(file('a'), 'x', 1);
    await saveRecent(file('b'), 'x', 2);
    await forgetRecent('a');
    expect((await listRecent()).map((f) => f.id)).toEqual(['b']);
    expect(await getRecentText('a')).toBeUndefined();
    await clearRecent();
    expect(await listRecent()).toEqual([]);
    expect(await getRecentText('b')).toBeUndefined();
  });

  it('evicts the oldest files beyond the budget', async () => {
    const big = 'x'.repeat(BUDGET_BYTES / 2 - 1);
    await saveRecent(file('a'), big, 1);
    await saveRecent(file('b'), big, 2);
    await saveRecent(file('c'), big, 3);
    expect((await listRecent()).map((f) => f.id)).toEqual(['c', 'b']);
    expect(await getRecentText('a')).toBeUndefined();
  });

  it('does not store a file larger than the budget', async () => {
    await saveRecent(file('a'), 'x', 1);
    expect(await saveRecent(file('b'), 'x'.repeat(BUDGET_BYTES + 1), 2)).toBe(false);
    expect((await listRecent()).map((f) => f.id)).toEqual(['a']);
  });

  it('notifies subscribers of changes', async () => {
    const listener = vi.fn();
    const unsubscribe = onRecentChange(listener);
    await saveRecent(file('a'), 'x', 1);
    await forgetRecent('a');
    await clearRecent();
    expect(listener).toHaveBeenCalledTimes(3);
    unsubscribe();
    await clearRecent();
    expect(listener).toHaveBeenCalledTimes(3);
  });
});

describe('saved tabs', () => {
  const tabs = [
    { id: 'NS.A', kind: 'entityType' as const, pinned: true },
    { id: 'NS.B', kind: 'complexType' as const, pinned: false },
  ];

  it('stores the tabs and the active one with the file', async () => {
    await saveRecent(file('a'), 'x', 1);
    await saveTabs('a', tabs, 'NS.B');
    expect(await listRecent()).toMatchObject([{ id: 'a', tabs, activeTab: 'NS.B' }]);
    await saveTabs('a', [], undefined);
    const [saved] = await listRecent();
    expect(saved).toMatchObject({ tabs: [] });
    expect(saved).not.toHaveProperty('activeTab');
  });

  it('ignores a file that is not remembered', async () => {
    await saveTabs('nope', tabs, 'NS.A');
    expect(await listRecent()).toEqual([]);
  });

  it('keeps the tabs when the same file is saved again, but not for a new file of that name', async () => {
    await saveRecent(file('a'), 'x', 1);
    await saveTabs('a', tabs, 'NS.A');
    await saveRecent(file('a'), 'x', 2);
    expect(await listRecent()).toMatchObject([{ id: 'a', tabs, activeTab: 'NS.A' }]);
    await saveRecent({ ...file('b'), name: 'a.xml' }, 'y', 3);
    expect(await listRecent()).toEqual([
      { id: 'b', name: 'a.xml', format: 'xml', size: 1, openedAt: 3 },
    ]);
  });
});
