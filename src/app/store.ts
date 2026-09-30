// App state: the open documents (v1 shows one), the detail mode, and the selection. Loading itself
// lives in loader.ts; this store only records where each document is in that process.
import { create } from 'zustand';
import type { Resolved } from '../csdl/resolve.ts';
import type { Progress } from '../worker/load.ts';

export type DetailMode = 'friendly' | 'technical';

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

  /** Adds a document in the loading state and makes it the active one. */
  startLoading: (doc: DocumentBase) => void;
  setProgress: (id: string, progress: Progress) => void;
  finishLoading: (id: string, resolved: Resolved, text: string) => void;
  failLoading: (id: string, error: string) => void;
  closeDocument: (id: string) => void;
  setActive: (id: string | undefined) => void;
  setDetailMode: (mode: DetailMode) => void;
  select: (id: string | undefined) => void;
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

  startLoading: (doc) =>
    set((s) => ({
      documents: new Map(s.documents).set(doc.id, {
        ...doc,
        status: 'loading',
        progress: undefined,
      }),
      activeId: doc.id,
      selection: undefined,
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
      };
    }),
  setActive: (id) => set({ activeId: id, selection: undefined }),
  setDetailMode: (detailMode) => set({ detailMode }),
  select: (selection) => set({ selection }),
}));

/** The active document, if there is one. */
export function selectActiveDocument(state: StoreState): AppDocument | undefined {
  return state.activeId === undefined ? undefined : state.documents.get(state.activeId);
}
