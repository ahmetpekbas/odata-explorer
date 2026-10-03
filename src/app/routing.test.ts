import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import trippin from '../../fixtures/trippin.xml?raw';
import { load } from '../worker/load.ts';
import { openText, type Parse } from './loader.ts';
import { clearRecent } from './persistence.ts';
import { formatRoute, parseRoute, startRouting } from './routing.ts';
import { useStore } from './store.ts';

const initial = useStore.getInitialState();
const inline: Parse = (text, onProgress) => Promise.resolve(load(text, onProgress));
const NS = 'Microsoft.OData.SampleService.Models.TripPin';

describe('formatRoute and parseRoute', () => {
  it.each([
    [{ docId: 'abc' }, '#/d/abc'],
    [
      { docId: 'abc', tab: { kind: 'entityType', id: 'NS.Person' } },
      '#/d/abc/entityType/NS.Person',
    ],
    [
      { docId: 'abc', tab: { kind: 'function', id: 'NS.GetTop(Collection(NS.A),Edm.Int32)' } },
      '#/d/abc/function/NS.GetTop(Collection(NS.A),Edm.Int32)',
    ],
    [
      { docId: 'abc', tab: { kind: 'entitySet', id: 'NS.Container/Sets 1?#' } },
      '#/d/abc/entitySet/NS.Container/Sets%201%3F%23',
    ],
  ])('round-trips %j', (route, hash) => {
    expect(formatRoute(route)).toBe(hash);
    expect(parseRoute(hash)).toEqual(route);
  });

  it.each(['', '#', '#/x/abc', '#/d/', '#/d/abc/entityType', '#/d/abc/entityType/%E0%A4%A'])(
    'rejects %j',
    (hash) => {
      expect(parseRoute(hash)).toBeUndefined();
    },
  );
});

describe('startRouting', () => {
  let stop: () => void;
  beforeEach(async () => {
    useStore.setState(initial, true);
    await clearRecent();
    history.replaceState(null, '', '/');
  });
  afterEach(() => stop());

  it('writes the active tab to the hash and back to the start when the file closes', async () => {
    stop = startRouting();
    const id = await openText('trippin.xml', trippin, inline);
    expect(location.hash).toBe(`#/d/${id}/schema/${NS}`);
    useStore.getState().openTab({ id: `${NS}.Person`, kind: 'entityType' });
    expect(location.hash).toBe(`#/d/${id}/entityType/${NS}.Person`);
    useStore.getState().closeDocument(id);
    expect(location.hash).toBe('');
  });

  it('opens the tab of a hash that changes, and none for the bare document route', async () => {
    stop = startRouting();
    const id = await openText('trippin.xml', trippin, inline);
    history.pushState(null, '', `#/d/${id}/entityType/${NS}.Trip`);
    dispatchEvent(new PopStateEvent('popstate'));
    expect(useStore.getState()).toMatchObject({ activeTab: `${NS}.Trip` });

    history.pushState(null, '', `#/d/${id}`);
    dispatchEvent(new PopStateEvent('popstate'));
    expect(useStore.getState().activeTab).toBeUndefined();
  });

  it('corrects the kind and target of a link to a property', async () => {
    stop = startRouting();
    const id = await openText('trippin.xml', trippin, inline);
    history.pushState(null, '', `#/d/${id}/property/${NS}.Person/UserName`);
    dispatchEvent(new PopStateEvent('popstate'));
    expect(useStore.getState().activeTab).toBe(`${NS}.Person`);
    expect(location.hash).toBe(`#/d/${id}/entityType/${NS}.Person`);
  });

  it('reopens the remembered file of a deep link and opens its tab', async () => {
    const id = await openText('trippin.xml', trippin, inline);
    useStore.setState(initial, true);
    history.replaceState(null, '', `#/d/${id}/entitySet/${NS}.DefaultContainer/People`);
    stop = startRouting(inline);
    await vi.waitFor(() =>
      expect(useStore.getState().activeTab).toBe(`${NS}.DefaultContainer/People`),
    );
  });

  it('opens a diagram tab from its link, selecting the type, and ignores a link to a non-type', async () => {
    stop = startRouting();
    const id = await openText('trippin.xml', trippin, inline);
    history.pushState(null, '', `#/d/${id}/diagram/diagram:${NS}.Person`);
    dispatchEvent(new PopStateEvent('popstate'));
    expect(useStore.getState()).toMatchObject({
      activeTab: `diagram:${NS}.Person`,
      selection: `${NS}.Person`,
    });

    history.pushState(null, '', `#/d/${id}/diagram/diagram:${NS}.PersonGender`);
    dispatchEvent(new PopStateEvent('popstate'));
    expect(useStore.getState().activeTab).toBe(`diagram:${NS}.Person`);
  });

  it('leaves the start page alone for a link to a file that is gone', async () => {
    history.replaceState(null, '', '#/d/missing/entityType/NS.A');
    stop = startRouting();
    await new Promise((r) => setTimeout(r, 20));
    expect(useStore.getState().documents.size).toBe(0);
  });
});
