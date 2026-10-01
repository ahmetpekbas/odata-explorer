import { useViewMode, type Tab } from '../../app/store.ts';
import { overloadsOf } from '../../app/operations.ts';
import type { Resolved } from '../../csdl/resolve.ts';
import { PlaceholderView } from '../workspace/PlaceholderView.tsx';
import { ContainerView } from './ContainerView.tsx';
import { EntitySetView } from './EntitySetView.tsx';
import { EnumTypeView } from './EnumTypeView.tsx';
import { ImportView } from './ImportView.tsx';
import { OperationView } from './OperationView.tsx';
import { StructuredTypeView } from './StructuredTypeView.tsx';
import { TermView } from './TermView.tsx';
import { TypeDefinitionView } from './TypeDefinitionView.tsx';

/** The detail view for the element of a tab. */
export function ElementView({ tab, resolved }: { tab: Tab; resolved: Resolved }) {
  const mode = useViewMode(tab.id);
  const props = { resolved, tabId: tab.id, mode };
  // An action or function tab names a group of overloads, which has no element of its own.
  if (tab.kind === 'action' || tab.kind === 'function') {
    const [first] = overloadsOf(resolved, tab.id);
    return first ? <OperationView {...props} element={first} /> : <PlaceholderView tab={tab} />;
  }
  const element = resolved.elements.get(tab.id);
  switch (element?.kind) {
    case 'entityType':
    case 'complexType':
      return <StructuredTypeView {...props} element={element} />;
    case 'enumType':
      return <EnumTypeView {...props} element={element} />;
    case 'typeDefinition':
      return <TypeDefinitionView {...props} element={element} />;
    case 'entityContainer':
      return <ContainerView {...props} element={element} />;
    case 'entitySet':
    case 'singleton':
      return <EntitySetView {...props} element={element} />;
    case 'actionImport':
    case 'functionImport':
      return <ImportView {...props} element={element} />;
    case 'term':
      return <TermView {...props} element={element} />;
    default:
      return <PlaceholderView tab={tab} />;
  }
}
