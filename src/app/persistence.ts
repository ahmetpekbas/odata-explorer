// Recent files in IndexedDB. Metadata and text live in separate stores so the list can be shown
// without reading every document. Everything stays in this browser.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Format } from '../worker/load.ts';

export interface RecentFile {
  id: string;
  name: string;
  /** Size of the source in bytes. */
  size: number;
  format: Format;
  /** Epoch milliseconds of the last time it was opened. */
  openedAt: number;
}

interface Schema extends DBSchema {
  meta: { key: string; value: RecentFile; indexes: { openedAt: number; name: string } };
  text: { key: string; value: string };
}

/** The most the recent files may occupy together; the oldest are evicted beyond it. */
export const BUDGET_BYTES = 50 * 1024 * 1024;

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
): Promise<boolean> {
  const size = new TextEncoder().encode(text).length;
  if (size > BUDGET_BYTES) return false;
  const d = await database();
  const tx = d.transaction(['meta', 'text'], 'readwrite');
  const meta = tx.objectStore('meta');
  const texts = tx.objectStore('text');

  for (const old of await meta.index('name').getAll(file.name)) {
    await meta.delete(old.id);
    await texts.delete(old.id);
  }
  await meta.put({ ...file, size, openedAt: now });
  await texts.put(text, file.id);

  let total = 0;
  const all = await meta.index('openedAt').getAll();
  for (const f of all) total += f.size;
  // `all` is oldest first.
  for (const f of all) {
    if (total <= BUDGET_BYTES) break;
    await meta.delete(f.id);
    await texts.delete(f.id);
    total -= f.size;
  }
  await tx.done;
  changed();
  return true;
}

/** Recent files, most recently opened first. */
export async function listRecent(): Promise<RecentFile[]> {
  const d = await database();
  return (await d.getAllFromIndex('meta', 'openedAt')).reverse();
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
