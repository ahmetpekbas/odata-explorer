import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import trippin from '../../fixtures/trippin.xml?raw';
import v2 from '../../fixtures/v2.xml?raw';
import { load } from '../worker/load.ts';
import { openRecent, openText, type Parse } from './loader.ts';
import { clearRecent, listRecent, saveTabs } from './persistence.ts';
import { selectActiveDocument, useStore } from './store.ts';

const initial = useStore.getInitialState();
const inline: Parse = (text, onProgress) => Promise.resolve(load(text, onProgress));

beforeEach(async () => {
  useStore.setState(initial, true);
  await clearRecent();
});

describe('openText', () => {
  it('makes a ready document', async () => {
    const id = await openText('trippin.xml', trippin, inline);
    expect(useStore.getState().documents.get(id)).toMatchObject({
      status: 'ready',
      name: 'trippin.xml',
      text: trippin,
    });
  });

  it('opens the schema overview of a new file, but not over restored tabs', async () => {
    await openText('trippin.xml', trippin, inline);
    const ns = 'Microsoft.OData.SampleService.Models.TripPin';
    expect(useStore.getState()).toMatchObject({
      activeTab: ns,
      tabs: [{ id: ns, kind: 'schema', pinned: false }],
    });

    useStore.setState(initial, true);
    await openText('trippin.xml', trippin, inline, 'same', { tabs: [], activeTab: undefined });
    expect(useStore.getState().tabs).toEqual([]);
  });

  it('records progress while loading', async () => {
    const seen: unknown[] = [];
    const unsubscribe = useStore.subscribe((s) => {
      const doc = selectActiveDocument(s);
      if (doc?.status === 'loading') seen.push(doc.progress);
    });
    await openText('trippin.xml', trippin, inline);
    unsubscribe();
    expect(seen.length).toBeGreaterThan(0);
  });

  it('fails an OData v2 document with the reason', async () => {
    const id = await openText('v2.xml', v2, inline);
    const doc = useStore.getState().documents.get(id);
    expect(doc).toMatchObject({ status: 'error' });
    expect(doc?.status === 'error' && doc.error).toMatch(/not supported/);
  });

  it('fails text that is not metadata', async () => {
    const id = await openText('x.txt', 'hello', inline);
    expect(useStore.getState().documents.get(id)).toMatchObject({ status: 'error' });
  });

  it('fails when the worker rejects', async () => {
    const id = await openText('x.xml', '<a/>', () => Promise.reject(new Error('worker died')));
    expect(useStore.getState().documents.get(id)).toMatchObject({
      status: 'error',
      error: 'worker died',
    });
  });

  it('remembers a loaded file and reopens it', async () => {
    await openText('trippin.xml', trippin, inline);
    await vi.waitFor(async () => expect(await listRecent()).toHaveLength(1));
    const [recent] = await listRecent();
    if (!recent) throw new Error('not remembered');
    expect(recent).toMatchObject({ name: 'trippin.xml', format: 'xml' });

    useStore.setState(initial, true);
    const id = await openRecent(recent, inline);
    expect(id && useStore.getState().documents.get(id)).toMatchObject({ status: 'ready' });
  });

  it('does not remember a failed load', async () => {
    await openText('v2.xml', v2, inline);
    expect(await listRecent()).toEqual([]);
  });

  it('cannot reopen a forgotten file', async () => {
    expect(await openRecent({ id: 'gone', name: 'gone.xml' }, inline)).toBeUndefined();
  });
});

describe('openRecent with saved tabs', () => {
  it('restores the tabs and the active one, and keeps the id of the file', async () => {
    const id = await openText('trippin.xml', trippin, inline);
    const tabs = [
      { id: 'NS.A', kind: 'entityType' as const, pinned: true },
      { id: 'NS.B', kind: 'complexType' as const, pinned: false },
    ];
    await saveTabs(id, tabs, 'NS.A');
    const [recent] = await listRecent();
    expect(recent?.id).toBe(id);

    useStore.setState(initial, true);
    expect(await openRecent(recent!, inline)).toBe(id);
    expect(useStore.getState()).toMatchObject({ tabs, activeTab: 'NS.A', selection: 'NS.A' });
    expect(await listRecent()).toMatchObject([{ id, tabs, activeTab: 'NS.A' }]);
  });
});
