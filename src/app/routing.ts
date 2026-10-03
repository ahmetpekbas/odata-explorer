// Hash routes, `#/d/<docId>/<kind>/<targetPath>`, kept in step with the store: the active tab writes
// the hash, and a hash that changes (back/forward, a pasted link) opens its tab. The document id is
// the recent-file id, so a link reopens the file from IndexedDB when it is not loaded.
import { diagramTab, diagramTypeOf } from './diagram-tab.ts';
import { openRecentById, type Parse } from './loader.ts';
import { openableTarget } from './openable.ts';
import type { Resolved } from '../csdl/resolve.ts';
import { selectActiveDocument, useStore, type StoreState } from './store.ts';

export interface Route {
  docId: string;
  tab?: { kind: string; id: string };
}

export const PROBLEMS_TAB = { id: 'problems', kind: 'diagnostics' } as const;

export function formatRoute({ docId, tab }: Route): string {
  const base = `#/d/${encodeURIComponent(docId)}`;
  if (!tab) return base;
  // Slashes, parentheses and `@` stay readable; `#` and `?` are escaped.
  const target = encodeURI(tab.id).replace(/#/g, '%23').replace(/\?/g, '%3F');
  return `${base}/${tab.kind}/${target}`;
}

export function parseRoute(hash: string): Route | undefined {
  const m = /^#\/d\/([^/]+)(?:\/([^/]+)\/(.+))?$/.exec(hash);
  if (!m?.[1]) return undefined;
  try {
    const docId = decodeURIComponent(m[1]);
    return m[2] && m[3] ? { docId, tab: { kind: m[2], id: decodeURIComponent(m[3]) } } : { docId };
  } catch {
    return undefined; // malformed percent-encoding
  }
}

/** The diagram tab a route names, when it names a structured type of the model. */
function diagramTarget({ types }: Resolved, tabId: string) {
  const typeId = diagramTypeOf(tabId);
  return typeId !== undefined && types.has(typeId) ? diagramTab(typeId) : undefined;
}

/** The route of what the store shows, or undefined when no document is ready. */
function routeOf(state: StoreState): Route | undefined {
  const doc = selectActiveDocument(state);
  if (doc?.status !== 'ready') return undefined;
  const tab = state.tabs.find((t) => t.id === state.activeTab);
  return tab ? { docId: doc.id, tab: { kind: tab.kind, id: tab.id } } : { docId: doc.id };
}

/** Starts keeping the hash and the store in step. Returns the function that stops it. */
export function startRouting(parse?: Parse): () => void {
  // A route waiting for its document to finish loading.
  let pending: Route | undefined;

  const apply = (route: Route) => {
    if (useStore.getState().activeId !== route.docId) useStore.getState().setActive(route.docId);
    const doc = selectActiveDocument(useStore.getState());
    if (doc?.status !== 'ready' || !route.tab) {
      useStore.getState().activateTab(undefined);
      return;
    }
    const target =
      route.tab.kind === 'diagnostics'
        ? PROBLEMS_TAB
        : route.tab.kind === 'diagram'
          ? diagramTarget(doc.resolved, route.tab.id)
          : openableTarget(doc.resolved, route.tab.id);
    if (target) useStore.getState().openTab(target);
  };

  const fromHash = () => {
    const route = parseRoute(location.hash);
    if (!route) return;
    const doc = useStore.getState().documents.get(route.docId);
    if (doc?.status === 'ready') {
      pending = undefined;
      apply(route);
    } else if (doc?.status === 'loading') {
      pending = route;
    } else if (!doc) {
      pending = route;
      // A link to a file that is gone leaves the start page showing.
      void openRecentById(route.docId, parse).then((id) => {
        if (id === undefined) pending = undefined;
      });
    }
  };

  /** Applies the pending route once its document is ready. Returns true while still waiting. */
  const settlePending = (state: StoreState): boolean => {
    if (!pending) return false;
    const doc = state.documents.get(pending.docId);
    if (doc?.status === 'ready') {
      const route = pending;
      pending = undefined;
      apply(route);
      return true;
    }
    if (doc?.status === 'loading' && state.activeId === pending.docId) return true;
    // Not loaded yet (the lookup is under way), unless the user moved on or the load failed.
    if (!doc && state.activeId === undefined) return true;
    pending = undefined;
    return false;
  };

  const toHash = (state: StoreState) => {
    if (settlePending(state)) return;
    const route = routeOf(state);
    const current = parseRoute(location.hash);
    if (!route) {
      if (state.activeId === undefined && location.hash !== '') {
        history.pushState(null, '', location.pathname + location.search);
      }
      return;
    }
    if (current && formatRoute(current) === formatRoute(route)) return;
    const url = location.pathname + location.search + formatRoute(route);
    // Moving to another document replaces the entry, so back does not return to a closed file.
    if (current?.docId === route.docId) history.pushState(null, '', url);
    else history.replaceState(null, '', url);
  };

  const unsubscribe = useStore.subscribe(toHash);
  addEventListener('hashchange', fromHash);
  addEventListener('popstate', fromHash);
  fromHash();
  return () => {
    unsubscribe();
    removeEventListener('hashchange', fromHash);
    removeEventListener('popstate', fromHash);
  };
}
