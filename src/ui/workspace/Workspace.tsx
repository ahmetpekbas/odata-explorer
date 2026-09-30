import { Body1, makeStyles, tokens } from '@fluentui/react-components';
import { useStore } from '../../app/store.ts';
import type { Diagnostic } from '../../csdl/model.ts';
import { DiagnosticsPanel } from '../shell/DiagnosticsPanel.tsx';
import { PlaceholderView } from './PlaceholderView.tsx';
import { TabStrip } from './TabStrip.tsx';

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', height: '100%' },
  view: { flex: 1, minHeight: 0, overflow: 'auto' },
  empty: { padding: tokens.spacingHorizontalL },
  diagnostics: { padding: tokens.spacingHorizontalL },
});

interface WorkspaceProps {
  diagnostics: readonly Diagnostic[];
  onSelectDiagnostic: (diagnostic: Diagnostic) => void;
}

/** The tab strip and the view of the active tab. */
export function Workspace({ diagnostics, onSelectDiagnostic }: WorkspaceProps) {
  const styles = useStyles();
  const tabs = useStore((s) => s.tabs);
  const activeTab = useStore((s) => s.activeTab);
  const { activateTab, pinTab, closeTab, closeOtherTabs } = useStore.getState();
  const active = tabs.find((t) => t.id === activeTab);

  return (
    <div className={styles.root}>
      <TabStrip
        tabs={tabs}
        activeTab={activeTab}
        onActivate={activateTab}
        onPin={pinTab}
        onClose={closeTab}
        onCloseOthers={closeOtherTabs}
      />
      <div className={styles.view}>
        {!active ? (
          <Body1 block className={styles.empty}>
            Choose an element in the navigator to open it here.
          </Body1>
        ) : active.kind === 'diagnostics' ? (
          <div className={styles.diagnostics}>
            <DiagnosticsPanel diagnostics={diagnostics} onSelect={onSelectDiagnostic} />
          </div>
        ) : (
          <PlaceholderView tab={active} />
        )}
      </div>
    </div>
  );
}
