// The symbol index behind the Ctrl+K palette: one flat entry per searchable element. Built in the
// worker next to the resolver, so the UI only filters and ranks it. Pure TypeScript, no DOM.
import { annotationId, overloadGroupId } from './ids.ts';
import { labelAnnotationOf, labelOf } from './humanize.ts';
import type { Model } from './model.ts';
import { allElements } from './walk.ts';

export type SearchKind =
  | 'entityType'
  | 'complexType'
  | 'enumType'
  | 'typeDefinition'
  | 'property'
  | 'navigationProperty'
  | 'enumMember'
  | 'entitySet'
  | 'singleton'
  | 'action'
  | 'function'
  | 'actionImport'
  | 'functionImport'
  | 'term'
  | 'annotation';

export interface SearchEntry {
  kind: SearchKind;
  /** Target-path ID: the element itself, its overload group, or the label annotation. */
  id: string;
  /** What is matched and shown: the element name, or the text of a label annotation. */
  label: string;
  /** Target-path ID of the namespace or element the entry belongs to. */
  parent: string;
}

const SEARCHABLE = new Set<string>([
  'entityType',
  'complexType',
  'enumType',
  'typeDefinition',
  'property',
  'navigationProperty',
  'enumMember',
  'entitySet',
  'singleton',
  'action',
  'function',
  'actionImport',
  'functionImport',
  'term',
]);

/** The ID of the element that contains `id`: everything before the last `/`, else the namespace. */
function parentOf(id: string): string {
  const slash = id.lastIndexOf('/');
  return slash >= 0 ? id.slice(0, slash) : id.slice(0, Math.max(id.lastIndexOf('.'), 0));
}

export function buildSearchIndex(model: Model): SearchEntry[] {
  const entries: SearchEntry[] = [];
  // An action or function with several overloads is one entry, as in the navigator.
  const seen = new Set<string>();
  for (const element of allElements(model)) {
    if (SEARCHABLE.has(element.kind)) {
      const isOperation = element.kind === 'action' || element.kind === 'function';
      const id = isOperation ? overloadGroupId(element.id) : element.id;
      if (!seen.has(id)) {
        seen.add(id);
        entries.push({
          kind: element.kind as SearchKind,
          id,
          label: element.name,
          parent: parentOf(id),
        });
      }
    }
    const label = labelAnnotationOf(element);
    if (label) {
      entries.push({
        kind: 'annotation',
        id: annotationId(element.id, label.term, label.qualifier),
        label: labelOf(element),
        parent: element.id,
      });
    }
  }
  return entries;
}
