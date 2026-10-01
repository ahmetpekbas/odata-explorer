import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import trippin from '../../fixtures/trippin.xml?raw';
import { load } from '../worker/load.ts';
import { openText, type Parse } from './loader.ts';
import { clearRecent, listRecent } from './persistence.ts';
import { startTabPersistence } from './tab-persistence.ts';
import { useStore } from './store.ts';

const initial = useStore.getInitialState();
const inline: Parse = (text, onProgress) => Promise.resolve(load(text, onProgress));

// A file that comes back with no tabs, so the schema overview does not open.
const none = { tabs: [], activeTab: undefined };

describe('startTabPersistence', () => {
  let stop: () => void;
  beforeEach(async () => {
    useStore.setState(initial, true);
    await clearRecent();
    stop = startTabPersistence();
  });
  afterEach(() => stop());

  it('saves tab changes of the open file', async () => {
    const id = await openText('trippin.xml', trippin, inline, undefined, none);
    useStore.getState().openTab({ id: 'NS.A', kind: 'entityType' }, true);
    useStore.getState().openTab({ id: 'NS.B', kind: 'complexType' });
    await vi.waitFor(async () =>
      expect(await listRecent()).toMatchObject([
        {
          id,
          activeTab: 'NS.B',
          tabs: [
            { id: 'NS.A', pinned: true },
            { id: 'NS.B', pinned: false },
          ],
        },
      ]),
    );
  });

  it('does not save an empty tab list when the file closes', async () => {
    const id = await openText('trippin.xml', trippin, inline, undefined, none);
    useStore.getState().openTab({ id: 'NS.A', kind: 'entityType' }, true);
    await vi.waitFor(async () => expect((await listRecent())[0]?.tabs).toHaveLength(1));
    useStore.getState().closeDocument(id);
    await new Promise((r) => setTimeout(r, 20));
    expect((await listRecent())[0]?.tabs).toHaveLength(1);
  });
});
