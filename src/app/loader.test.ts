import { beforeEach, describe, expect, it } from 'vitest';
import trippin from '../../fixtures/trippin.xml?raw';
import v2 from '../../fixtures/v2.xml?raw';
import { load } from '../worker/load.ts';
import { openText, type Parse } from './loader.ts';
import { selectActiveDocument, useStore } from './store.ts';

const initial = useStore.getInitialState();
const inline: Parse = (text, onProgress) => Promise.resolve(load(text, onProgress));

beforeEach(() => useStore.setState(initial, true));

describe('openText', () => {
  it('makes a ready document', async () => {
    const id = await openText('trippin.xml', trippin, inline);
    expect(useStore.getState().documents.get(id)).toMatchObject({
      status: 'ready',
      name: 'trippin.xml',
      text: trippin,
    });
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
});
