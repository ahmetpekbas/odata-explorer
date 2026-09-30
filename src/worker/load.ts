// The load pipeline: detect the format, parse, resolve. Kept free of worker APIs so it runs in Vitest;
// parser.worker.ts only exposes it. Failures come back as data, never as exceptions.
import { parseJson } from '../csdl/parse-json.ts';
import { parseXml } from '../csdl/parse-xml.ts';
import type { Model } from '../csdl/model.ts';
import { resolve, type Resolved } from '../csdl/resolve.ts';
import { bundledSchemas } from '../vocabularies/index.ts';

export type Format = Model['format'];

export interface Progress {
  stage: 'parsing' | 'resolving';
  /** Characters of the text processed so far, and the total. */
  done: number;
  total: number;
}

export type LoadResult = { ok: true; resolved: Resolved } | { ok: false; error: string };

/** The format by the first non-whitespace character: `<` is XML, `{` is JSON. */
export function detectFormat(text: string): Format | undefined {
  const first = /\S/.exec(text)?.[0];
  if (first === '<') return 'xml';
  if (first === '{') return 'json';
  return undefined;
}

export function load(text: string, onProgress?: (progress: Progress) => void): LoadResult {
  try {
    const format = detectFormat(text);
    if (!format) {
      return {
        ok: false,
        error: 'Not an OData metadata document: it must start with "<" (XML) or "{" (JSON).',
      };
    }
    const total = text.length;
    onProgress?.({ stage: 'parsing', done: 0, total });
    const model =
      format === 'xml'
        ? parseXml(text, (done) => onProgress?.({ stage: 'parsing', done, total }))
        : parseJson(text);
    onProgress?.({ stage: 'resolving', done: total, total });
    return { ok: true, resolved: resolve(model, text, bundledSchemas) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
