import { useViewMode, type Tab } from '../../app/store.ts';
import type { Resolved } from '../../csdl/resolve.ts';
import { PlaceholderView } from '../workspace/PlaceholderView.tsx';
import { EnumTypeView } from './EnumTypeView.tsx';
import { StructuredTypeView } from './StructuredTypeView.tsx';
import { TermView } from './TermView.tsx';
import { TypeDefinitionView } from './TypeDefinitionView.tsx';

/** The detail view for the element of a tab. */
export function ElementView({ tab, resolved }: { tab: Tab; resolved: Resolved }) {
  const mode = useViewMode(tab.id);
  const element = resolved.elements.get(tab.id);
  const props = { resolved, tabId: tab.id, mode };
  switch (element?.kind) {
    case 'entityType':
    case 'complexType':
      return <StructuredTypeView {...props} element={element} />;
    case 'enumType':
      return <EnumTypeView {...props} element={element} />;
    case 'typeDefinition':
      return <TypeDefinitionView {...props} element={element} />;
    case 'term':
      return <TermView {...props} element={element} />;
    default:
      return <PlaceholderView tab={tab} />;
  }
}
