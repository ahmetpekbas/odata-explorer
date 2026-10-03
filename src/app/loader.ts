// Connects the parser worker to the store: read a file, parse it off the main thread, record progress
// and the outcome.
import { proxy, wrap } from 'comlink';
import type { ParserApi } from '../worker/parser.worker.ts';
import type { LoadResult, Progress } from '../worker/load.ts';
import { assemble, type Piece } from '../worker/transfer.ts';
import { getRecent, getRecentText, saveRecent, type RecentFile } from './persistence.ts';
import { useStore } from './store.ts';
import { defaultSchema } from './summary.ts';

export type Parse = (text: string, onProgress: (progress: Progress) => void) => Promise<LoadResult>;

let worker: Parse | undefined;

/** The parser worker, started on first use. */
const workerParse: Parse = (text, onProgress) => {
  worker ??= (() => {
    const api = wrap<ParserApi>(
      new Worker(new URL('../worker/parser.worker.ts', import.meta.url), { type: 'module' }),
    );
    return async (text, onProgress) => {
      const pieces: Piece[] = [];
      const result = await api.load(
        text,
        proxy(onProgress),
        proxy((piece: Piece) => void pieces.push(piece)),
      );
      return result.ok ? { ok: true, ...assemble(pieces) } : result;
    };
  })();
  return worker(text, onProgress);
};

/**
 * Loads `text` as a new document and returns its id, which is also the id of its recent file: a URL
 * with that id keeps working after a reload. Never rejects: failures land in the store.
 */
export async function openText(
  name: string,
  text: string,
  parse: Parse = workerParse,
  id: string = crypto.randomUUID(),
  restored?: Pick<RecentFile, 'tabs' | 'activeTab'>,
): Promise<string> {
  const store = useStore.getState();
  store.startLoading({ id, name, size: text.length });
  try {
    const result = await parse(text, (progress) => store.setProgress(id, progress));
    if (!result.ok) {
      store.failLoading(id, result.error);
      return id;
    }
    const { model } = result.resolved;
    // Nothing to explore: a document that only has problems is a failed load, not an empty model.
    if (model.schemas.length === 0) {
      const reason = model.diagnostics.find((d) => d.severity === 'error')?.message;
      store.failLoading(id, reason ?? 'The document does not contain any schemas.');
    } else {
      // A file that comes back with its tabs keeps them; a new one opens on its schema overview, as a
      // preview that a deep link or the first click replaces.
      const overview = defaultSchema(model);
      const tabs = restored?.tabs
        ? { tabs: restored.tabs, activeTab: restored.activeTab }
        : overview && {
            tabs: [{ id: overview.id, kind: 'schema' as const, pinned: false }],
            activeTab: overview.id,
          };
      store.finishLoading(id, result.resolved, text, result.index, tabs);
      // Remembering is a convenience: a full or unavailable IndexedDB must not fail the load.
      saveRecent({ id, name, format: model.format }, text).then(
        (saved) =>
          saved || console.warn('The file is too large for the recent list (over 256 MB).'),
        (e: unknown) => console.warn('Could not add the file to the recent list.', e),
      );
    }
  } catch (e) {
    store.failLoading(id, e instanceof Error ? e.message : String(e));
  }
  return id;
}

export async function openFile(file: File, parse?: Parse): Promise<string> {
  try {
    return await openText(file.name, await file.text(), parse);
  } catch (e) {
    // Reading the file failed, so there is no document yet.
    const id = crypto.randomUUID();
    const store = useStore.getState();
    store.startLoading({ id, name: file.name, size: file.size });
    store.failLoading(id, e instanceof Error ? e.message : String(e));
    return id;
  }
}

/** Reopens a remembered file. Returns undefined when it is gone. */
export async function openRecent(
  recent: Pick<RecentFile, 'id' | 'name' | 'tabs' | 'activeTab'>,
  parse?: Parse,
): Promise<string | undefined> {
  const text = await getRecentText(recent.id);
  return text === undefined ? undefined : openText(recent.name, text, parse, recent.id, recent);
}

/** Reopens a remembered file by id, e.g. from a deep link. Returns undefined when it is gone. */
export async function openRecentById(id: string, parse?: Parse): Promise<string | undefined> {
  const recent = await getRecent(id);
  return recent && openRecent(recent, parse);
}
