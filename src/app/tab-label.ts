import type { Tab } from './store.ts';

/** Short name for a tab: the last segment of its target path, without an overload signature. */
export function tabLabel(tab: Pick<Tab, 'id' | 'kind'>): string {
  if (tab.kind === 'diagnostics') return 'Problems';
  const path = tab.id.replace(/\(.*$/, '');
  return path.slice(Math.max(path.lastIndexOf('/'), path.lastIndexOf('.')) + 1);
}
