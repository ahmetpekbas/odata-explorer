// Saves the open tabs with the recent file whenever they change.
import { saveTabs } from './persistence.ts';
import { selectActiveDocument, useStore } from './store.ts';

/** Starts saving. Returns the function that stops it. */
export function startTabPersistence(): () => void {
  return useStore.subscribe((state, prev) => {
    if (state.tabs === prev.tabs && state.activeTab === prev.activeTab) return;
    // Switching documents resets the tabs; that is not the user closing them.
    if (state.activeId !== prev.activeId) return;
    const doc = selectActiveDocument(state);
    if (doc?.status !== 'ready') return;
    // Remembering is a convenience: an unavailable IndexedDB must not break the app.
    saveTabs(doc.id, state.tabs, state.activeTab).catch(() => undefined);
  });
}
