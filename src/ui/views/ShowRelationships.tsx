import { Button } from '@fluentui/react-components';
import { DiagramRegular } from '@fluentui/react-icons';
import { diagramTab } from '../../app/diagram-tab.ts';
import { useStore } from '../../app/store.ts';

/** Opens the relationship diagram of a type in a tab of its own. */
export function ShowRelationships({ typeId }: { typeId: string }) {
  const openTab = useStore((s) => s.openTab);
  return (
    <Button
      appearance="subtle"
      size="small"
      icon={<DiagramRegular />}
      onClick={() => openTab(diagramTab(typeId), true)}
    >
      Show relationships
    </Button>
  );
}
