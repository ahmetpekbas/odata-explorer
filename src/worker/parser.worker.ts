// Runs the load pipeline off the main thread. The model travels back as many small pieces (see
// transfer.ts), so that receiving it never holds the main thread for long.
import { expose, type ProxyMarked } from 'comlink';
import { load, type Progress } from './load.ts';
import { splitResult, type Piece } from './transfer.ts';

const api = {
  /** Sends every piece through `onPiece`, in order, before it returns. */
  async load(
    text: string,
    onProgress: ((progress: Progress) => void) & ProxyMarked,
    onPiece: ((piece: Piece) => void) & ProxyMarked,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const result = load(text, onProgress);
    if (!result.ok) return result;
    // A comlink proxy call is a round trip, whatever the declared type says. Awaiting each one keeps the
    // worker from queueing megabytes ahead of what the page has taken in.
    for (const piece of splitResult(result.resolved, result.index)) {
      await (onPiece(piece) as unknown as Promise<void>);
    }
    return { ok: true };
  },
};

export type ParserApi = typeof api;

expose(api);
