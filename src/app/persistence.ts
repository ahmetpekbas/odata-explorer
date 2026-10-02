// Recent files in IndexedDB. Metadata and text live in separate stores so the list can be shown
// without reading every document. Everything stays in this browser.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Format } from '../worker/load.ts';
import type { Tab } from './store.ts';

export interface RecentFile {
  id: string;
  name: string;
  /** Size of the source in bytes. */
  size: number;
  format: Format;
  /** Epoch milliseconds of the last time it was opened. */
  openedAt: number;
  /** The tabs that were open when the file was last used, and which one was active. */
  tabs?: Tab[];
  activeTab?: string;
}

interface Schema extends DBSchema {
  meta: { key: string; value: RecentFile; indexes: { openedAt: number; name: string } };
  text: { key: string; value: string };
}

/** The most the recent files may occupy together; the oldest are evicted beyond it. */
export const BUDGET_BYTES = 256 * 1024 * 1024;

let db: Promise<IDBPDatabase<Schema>> | undefined;

function database(): Promise<IDBPDatabase<Schema>> {
  db ??= openDB<Schema>('odata-explorer', 1, {
    upgrade(d) {
      const meta = d.createObjectStore('meta', { keyPath: 'id' });
      meta.createIndex('openedAt', 'openedAt');
      meta.createIndex('name', 'name');
      d.createObjectStore('text');
    },
  });
  return db;
}

const listeners = new Set<() => void>();

/** Calls `listener` whenever the list of recent files changes. Returns the unsubscribe function. */
export function onRecentChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const changed = () => listeners.forEach((l) => l());

/**
 * Remembers a file, replacing an earlier one of the same name, then evicts the oldest files until
 * the budget holds. Returns false, storing nothing, when the file alone exceeds the budget.
 */
export async function saveRecent(
  file: Omit<RecentFile, 'size' | 'openedAt'>,
  text: string,
  now = Date.now(),
  budget = BUDGET_BYTES,
): Promise<boolean> {
  const size = new TextEncoder().encode(text).length;
  if (size > budget) return false;
  const d = await database();
  const tx = d.transaction(['meta', 'text'], 'readwrite');
  const meta = tx.objectStore('meta');
  const texts = tx.objectStore('text');

  // Reopening the same file keeps its tabs; a new file of the same name starts without.
  let kept: Pick<RecentFile, 'tabs' | 'activeTab'> = {};
  for (const old of await meta.index('name').getAll(file.name)) {
    if (old.id === file.id) {
      kept = {
        ...(old.tabs && { tabs: old.tabs }),
        ...(old.activeTab && { activeTab: old.activeTab }),
      };
    }
    await meta.delete(old.id);
    await texts.delete(old.id);
  }
  await meta.put({ ...file, ...kept, size, openedAt: now });
  await texts.put(text, file.id);

  let total = 0;
  const all = await meta.index('openedAt').getAll();
  for (const f of all) total += f.size;
  // `all` is oldest first.
  for (const f of all) {
    if (total <= budget) break;
    await meta.delete(f.id);
    await texts.delete(f.id);
    total -= f.size;
  }
  await tx.done;
  changed();
  return true;
}

/** Remembers which tabs a file has open. Does nothing for a file that is not remembered. */
export async function saveTabs(
  id: string,
  tabs: Tab[],
  activeTab: string | undefined,
): Promise<void> {
  const d = await database();
  const tx = d.transaction('meta', 'readwrite');
  const meta = await tx.store.get(id);
  if (meta) {
    const next: RecentFile = { ...meta, tabs };
    if (activeTab === undefined) delete next.activeTab;
    else next.activeTab = activeTab;
    await tx.store.put(next);
  }
  await tx.done;
}

/** Recent files, most recently opened first. */
export async function listRecent(): Promise<RecentFile[]> {
  const d = await database();
  return (await d.getAllFromIndex('meta', 'openedAt')).reverse();
}

export async function getRecent(id: string): Promise<RecentFile | undefined> {
  return (await database()).get('meta', id);
}

/** The remembered text of a file, or undefined if it was forgotten or evicted. */
export async function getRecentText(id: string): Promise<string | undefined> {
  return (await database()).get('text', id);
}

export async function forgetRecent(id: string): Promise<void> {
  const d = await database();
  const tx = d.transaction(['meta', 'text'], 'readwrite');
  await Promise.all([
    tx.objectStore('meta').delete(id),
    tx.objectStore('text').delete(id),
    tx.done,
  ]);
  changed();
}

export async function clearRecent(): Promise<void> {
  const d = await database();
  const tx = d.transaction(['meta', 'text'], 'readwrite');
  await Promise.all([tx.objectStore('meta').clear(), tx.objectStore('text').clear(), tx.done]);
  changed();
}
