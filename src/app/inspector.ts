// What the annotations inspector shows: the annotations of the selected element, grouped by vocabulary.
import { shortName } from '../csdl/humanize.ts';
import type { Annotation } from '../csdl/model.ts';
import type { Resolved } from '../csdl/resolve.ts';
import { overloadsOf } from './operations.ts';

/**
 * Every annotation on the element `id`, inline ones first, then external ones (the resolver already
 * merged them in that order). An action or function tab names a group of overloads: the annotations
 * of all of them, where one written against the whole group counts once.
 */
export function annotationsOf(resolved: Resolved, id: string | undefined): Annotation[] {
  if (id === undefined) return [];
  const element = resolved.elements.get(id);
  if (element) return element.annotations;
  return [...new Set(overloadsOf(resolved, id).flatMap((op) => op.annotations))];
}

/** The vocabulary a qualified term belongs to: `Org.OData.Core.V1.Computed` -> `Org.OData.Core.V1`. */
export function vocabularyNamespace(term: string): string {
  return term.slice(0, Math.max(term.lastIndexOf('.'), 0));
}

/** A short name for a vocabulary namespace: `Org.OData.Core.V1` -> `Core`, `Ex` -> `Ex`. */
export function vocabularyName(namespace: string): string {
  const parts = namespace.split('.');
  const last = parts[parts.length - 1] ?? namespace;
  return /^v\d+$/i.test(last) && parts.length > 1 ? (parts[parts.length - 2] ?? last) : last;
}

/** The term without its vocabulary: `Org.OData.Core.V1.Computed` -> `Computed`. */
export const termName = shortName;

export interface AnnotationGroup {
  namespace: string;
  /** Short name of the vocabulary, e.g. `Core`. */
  vocabulary: string;
  annotations: Annotation[];
}

/** Groups annotations by vocabulary, in order of first appearance; each group keeps document order. */
export function groupByVocabulary(annotations: readonly Annotation[]): AnnotationGroup[] {
  const groups = new Map<string, AnnotationGroup>();
  for (const annotation of annotations) {
    const namespace = vocabularyNamespace(annotation.term);
    let group = groups.get(namespace);
    if (!group) {
      group = { namespace, vocabulary: vocabularyName(namespace), annotations: [] };
      groups.set(namespace, group);
    }
    group.annotations.push(annotation);
  }
  return [...groups.values()];
}
