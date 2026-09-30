// Connects the parser worker to the store: read a file, parse it off the main thread, record progress
// and the outcome.
import { proxy, wrap } from 'comlink';
import type { ParserApi } from '../worker/parser.worker.ts';
import type { LoadResult, Progress } from '../worker/load.ts';
import { useStore } from './store.ts';

export type Parse = (text: string, onProgress: (progress: Progress) => void) => Promise<LoadResult>;

let worker: Parse | undefined;

/** The parser worker, started on first use. */
const workerParse: Parse = (text, onProgress) => {
  worker ??= (() => {
    const api = wrap<ParserApi>(
      new Worker(new URL('../worker/parser.worker.ts', import.meta.url), { type: 'module' }),
    );
    return (t, p) => api.load(t, proxy(p));
  })();
  return worker(text, onProgress);
};

/** Loads `text` as a new document and returns its id. Never rejects: failures land in the store. */
export async function openText(
  name: string,
  text: string,
  parse: Parse = workerParse,
): Promise<string> {
  const id = crypto.randomUUID();
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
      store.finishLoading(id, result.resolved, text);
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
