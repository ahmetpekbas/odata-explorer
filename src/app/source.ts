// The source shown for an element. XML documents have exact spans, so the fragment is the original text.
// `JSON.parse` has no positions, so a JSON element shows its subtree re-serialized: the content is
// exact, the formatting may differ from the file.
import { indexJsonSource, jsonFragment, type JsonSourceIndex } from '../csdl/json-fragment.ts';
import type { Element, Model } from '../csdl/model.ts';
import type { Resolved } from '../csdl/resolve.ts';
import { overloadsOf } from './operations.ts';

export interface SourceFragment {
  text: string;
  language: Model['format'];
  /** The fragment was cut at `MAX_FRAGMENT` characters, as a whole schema can be megabytes. */
  truncated: boolean;
}

/** Longest fragment shown: an editor stays responsive far beyond this, but nobody reads past it. */
export const MAX_FRAGMENT = 200_000;

// The JSON index keys on element identity, so it is built from the model the UI holds, once per document,
// the first time a JSON fragment is asked for.
const jsonIndexes = new WeakMap<Resolved, JsonSourceIndex>();

function jsonIndex(resolved: Resolved, text: string): JsonSourceIndex {
  let index = jsonIndexes.get(resolved);
  if (!index) {
    try {
      index = indexJsonSource(resolved.model, JSON.parse(text));
    } catch {
      index = new Map();
    }
    jsonIndexes.set(resolved, index);
  }
  return index;
}

function fragmentOf(resolved: Resolved, text: string, element: Element): string | undefined {
  if (resolved.model.format === 'json') return jsonFragment(jsonIndex(resolved, text), element);
  const { span } = element;
  return span ? text.slice(span.start, span.end) : undefined;
}

/**
 * The source of the element `id`, or of every overload when `id` names an action or function group.
 * Undefined when the model has no source for it (for example, an element the document does not contain).
 */
export function sourceOf(
  resolved: Resolved,
  text: string,
  id: string | undefined,
): SourceFragment | undefined {
  if (id === undefined) return undefined;
  const element = resolved.elements.get(id);
  const elements = element ? [element] : overloadsOf(resolved, id);
  const parts = elements.flatMap((e) => fragmentOf(resolved, text, e) ?? []);
  if (parts.length === 0) return undefined;
  const joined = parts.join('\n\n');
  const truncated = joined.length > MAX_FRAGMENT;
  return {
    text: truncated ? joined.slice(0, MAX_FRAGMENT) : joined,
    language: resolved.model.format,
    truncated,
  };
}
