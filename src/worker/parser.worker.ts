// Runs the load pipeline off the main thread. The model travels back once, by structured clone.
import { expose, type ProxyMarked } from 'comlink';
import { load, type LoadResult, type Progress } from './load.ts';

const api = {
  load(text: string, onProgress?: ((progress: Progress) => void) & ProxyMarked): LoadResult {
    return load(text, onProgress);
  },
};

export type ParserApi = typeof api;

expose(api);
