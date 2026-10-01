import { useViewMode, type Tab } from '../../app/store.ts';
import type { Resolved } from '../../csdl/resolve.ts';
import { PlaceholderView } from '../workspace/PlaceholderView.tsx';
import { EntityTypeView } from './EntityTypeView.tsx';

/** The detail view for the element of a tab. */
export function ElementView({ tab, resolved }: { tab: Tab; resolved: Resolved }) {
  const mode = useViewMode(tab.id);
  const element = resolved.elements.get(tab.id);
  const props = { resolved, tabId: tab.id, mode };
  switch (element?.kind) {
    case 'entityType':
      return <EntityTypeView {...props} element={element} />;
    default:
      return <PlaceholderView tab={tab} />;
  }
}
