import { beforeEach, describe, expect, it } from 'vitest';
import type { Resolved } from '../csdl/resolve.ts';
import { selectActiveDocument, useStore } from './store.ts';

const initial = useStore.getInitialState();
const doc = { id: 'a', name: 'a.xml', size: 10 };
const resolved = {} as Resolved;

beforeEach(() => useStore.setState(initial, true));

describe('store', () => {
  it('starts empty, in friendly mode', () => {
    const s = useStore.getState();
    expect(s.documents.size).toBe(0);
    expect(s.detailMode).toBe('friendly');
    expect(selectActiveDocument(s)).toBeUndefined();
  });

  it('follows a document from loading to ready', () => {
    const s = useStore.getState();
    s.startLoading(doc);
    expect(selectActiveDocument(useStore.getState())).toMatchObject({ status: 'loading' });

    const progress = { stage: 'parsing', done: 5, total: 10 } as const;
    s.setProgress('a', progress);
    expect(selectActiveDocument(useStore.getState())).toMatchObject({ progress });

    s.finishLoading('a', resolved, 'text');
    expect(selectActiveDocument(useStore.getState())).toEqual({
      ...doc,
      status: 'ready',
      resolved,
      text: 'text',
    });
  });

  it('records a failed load', () => {
    const s = useStore.getState();
    s.startLoading(doc);
    s.failLoading('a', 'nope');
    expect(selectActiveDocument(useStore.getState())).toEqual({
      ...doc,
      status: 'error',
      error: 'nope',
    });
  });

  it('ignores updates for a document that was closed while loading', () => {
    const s = useStore.getState();
    s.startLoading(doc);
    s.closeDocument('a');
    s.setProgress('a', { stage: 'parsing', done: 1, total: 2 });
    s.finishLoading('a', resolved, 'text');
    expect(useStore.getState().documents.size).toBe(0);
    expect(useStore.getState().activeId).toBeUndefined();
  });

  it('ignores progress that arrives after the document finished', () => {
    const s = useStore.getState();
    s.startLoading(doc);
    s.finishLoading('a', resolved, 'text');
    s.setProgress('a', { stage: 'resolving', done: 2, total: 2 });
    expect(selectActiveDocument(useStore.getState())).toMatchObject({ status: 'ready' });
  });

  it('clears the selection when the active document changes', () => {
    const s = useStore.getState();
    s.startLoading(doc);
    s.select('NS.Customer');
    expect(useStore.getState().selection).toBe('NS.Customer');
    s.startLoading({ id: 'b', name: 'b.xml', size: 1 });
    expect(useStore.getState()).toMatchObject({ activeId: 'b', selection: undefined });
    expect(useStore.getState().documents.size).toBe(2);
  });

  it('keeps the selection when a background document closes', () => {
    const s = useStore.getState();
    s.startLoading(doc);
    s.startLoading({ id: 'b', name: 'b.xml', size: 1 });
    s.select('NS.Customer');
    s.closeDocument('a');
    expect(useStore.getState()).toMatchObject({ activeId: 'b', selection: 'NS.Customer' });
  });

  it('switches the detail mode', () => {
    useStore.getState().setDetailMode('technical');
    expect(useStore.getState().detailMode).toBe('technical');
  });

  it('lets one view override the mode until the global mode changes', () => {
    const s = useStore.getState();
    s.setModeOverride('NS.Customer', 'technical');
    const mode = (id: string) => {
      const state = useStore.getState();
      return state.modeOverrides[id] ?? state.detailMode;
    };
    expect(mode('NS.Customer')).toBe('technical');
    expect(mode('NS.Order')).toBe('friendly');
    s.setDetailMode('technical');
    s.setDetailMode('friendly');
    expect(mode('NS.Customer')).toBe('friendly');
  });
});
