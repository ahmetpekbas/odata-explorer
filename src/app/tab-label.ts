import { diagramTypeOf } from './diagram-tab.ts';
import type { Tab } from './store.ts';

/** Short name for a tab: the last segment of its target path, without an overload signature. */
export function tabLabel(tab: Pick<Tab, 'id' | 'kind'>): string {
  if (tab.kind === 'diagnostics') return 'Problems';
  const type = diagramTypeOf(tab.id);
  if (type !== undefined) return `${tabLabel({ id: type, kind: 'entityType' })} diagram`;
  const path = tab.id.replace(/\(.*$/, '');
  return path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('.')) + 1);
}
