// App state: the open documents (v1 shows one), the detail mode, the tabs, and the selection. Loading itself
// lives in loader.ts; this store only records where each document is in that process.
import { create } from 'zustand';
import type { ElementKind } from '../csdl/model.ts';
import type { Resolved } from '../csdl/resolve.ts';
import type { Progress } from '../worker/load.ts';

export type DetailMode = 'friendly' | 'technical';

/** What a tab shows: an element of the model, or the list of problems. */
export type TabKind = ElementKind | 'diagnostics';

export interface Tab {
  /** Target-path ID of the element, or `problems` for the diagnostics tab. */
  id: string;
  kind: TabKind;
  /** An unpinned tab is a preview: the next preview replaces it. At most one tab is a preview. */
  pinned: boolean;
}

interface DocumentBase {
  id: string;
  name: string;
  /** Size of the source text in characters. */
  size: number;
}

export type AppDocument = DocumentBase &
  (
    | { status: 'loading'; progress: Progress | undefined }
    | { status: 'ready'; resolved: Resolved; text: string }
    | { status: 'error'; error: string }
  );

export interface StoreState {
  documents: Map<string, AppDocument>;
  activeId: string | undefined;
  detailMode: DetailMode;
  /** Target-path ID of the selected element. */
  selection: string | undefined;
  /** Open tabs of the active document, in display order. */
  tabs: Tab[];
  activeTab: string | undefined;

  /** Adds a document in the loading state and makes it the active one. */
  startLoading: (doc: DocumentBase) => void;
  setProgress: (id: string, progress: Progress) => void;
  finishLoading: (id: string, resolved: Resolved, text: string) => void;
  failLoading: (id: string, error: string) => void;
  closeDocument: (id: string) => void;
  setActive: (id: string | undefined) => void;
  setDetailMode: (mode: DetailMode) => void;
  select: (id: string | undefined) => void;
  /** Activates the tab for `target`, opening it first. Without `pin` it becomes the preview tab. */
  openTab: (target: { id: string; kind: TabKind }, pin?: boolean) => void;
  pinTab: (id: string) => void;
  closeTab: (id: string) => void;
  closeOtherTabs: (id: string) => void;
  /** Makes the tab active; without an id no tab is active. */
  activateTab: (id: string | undefined) => void;
}

const NO_TABS: Pick<StoreState, 'tabs' | 'activeTab'> = { tabs: [], activeTab: undefined };

/** The state after the active tab changed: the selection follows it. */
function activated(tabs: Tab[], activeTab: string | undefined) {
  return { tabs, activeTab, selection: activeTab };
}

/** Replaces one document, if it still exists: a load can finish after its document was closed. */
function replace(state: StoreState, id: string, next: (doc: AppDocument) => AppDocument) {
  const doc = state.documents.get(id);
  if (!doc) return state;
  return { documents: new Map(state.documents).set(id, next(doc)) };
}

export const useStore = create<StoreState>()((set) => ({
  documents: new Map(),
  activeId: undefined,
  detailMode: 'friendly',
  selection: undefined,
  ...NO_TABS,

  startLoading: (doc) =>
    set((s) => ({
      documents: new Map(s.documents).set(doc.id, {
        ...doc,
        status: 'loading',
        progress: undefined,
      }),
      activeId: doc.id,
      selection: undefined,
      ...NO_TABS,
    })),
  setProgress: (id, progress) =>
    set((s) => replace(s, id, (doc) => (doc.status === 'loading' ? { ...doc, progress } : doc))),
  finishLoading: (id, resolved, text) =>
    set((s) =>
      replace(s, id, ({ id, name, size }) => ({ id, name, size, status: 'ready', resolved, text })),
    ),
  failLoading: (id, error) =>
    set((s) =>
      replace(s, id, ({ id, name, size }) => ({ id, name, size, status: 'error', error })),
    ),
  closeDocument: (id) =>
    set((s) => {
      if (!s.documents.has(id)) return s;
      const documents = new Map(s.documents);
      documents.delete(id);
      const closedActive = s.activeId === id;
      return {
        documents,
        activeId: closedActive ? undefined : s.activeId,
        selection: closedActive ? undefined : s.selection,
        ...(closedActive && NO_TABS),
      };
    }),
  setActive: (id) => set({ activeId: id, selection: undefined, ...NO_TABS }),
  setDetailMode: (detailMode) => set({ detailMode }),
  select: (selection) => set({ selection }),
  openTab: (target, pin = false) =>
    set((s) => {
      const existing = s.tabs.find((t) => t.id === target.id);
      if (existing) {
        const tabs =
          pin && !existing.pinned
            ? s.tabs.map((t) => (t === existing ? { ...t, pinned: true } : t))
            : s.tabs;
        return activated(tabs, target.id);
      }
      const tab: Tab = { ...target, pinned: pin };
      const preview = s.tabs.findIndex((t) => !t.pinned);
      // The new preview takes the old one's place, as in VS Code.
      if (!pin && preview >= 0)
        return activated(
          s.tabs.map((t, i) => (i === preview ? tab : t)),
          tab.id,
        );
      return activated([...s.tabs, tab], tab.id);
    }),
  pinTab: (id) =>
    set((s) => ({ tabs: s.tabs.map((t) => (t.id === id ? { ...t, pinned: true } : t)) })),
  closeTab: (id) =>
    set((s) => {
      const index = s.tabs.findIndex((t) => t.id === id);
      if (index < 0) return s;
      const tabs = s.tabs.filter((t) => t.id !== id);
      if (s.activeTab !== id) return { tabs };
      // The neighbour to the right takes over, or the one to the left when the last tab closed.
      return activated(tabs, (tabs[index] ?? tabs[index - 1])?.id);
    }),
  closeOtherTabs: (id) =>
    set((s) => {
      const tab = s.tabs.find((t) => t.id === id);
      return tab ? activated([tab], id) : s;
    }),
  activateTab: (id) =>
    set((s) => (id === undefined || s.tabs.some((t) => t.id === id) ? activated(s.tabs, id) : s)),
}));

/** The active document, if there is one. */
export function selectActiveDocument(state: StoreState): AppDocument | undefined {
  return state.activeId === undefined ? undefined : state.documents.get(state.activeId);
}
