import { lazy, Suspense } from 'react';
import { Body1, makeStyles, Spinner, tokens } from '@fluentui/react-components';
import { selectActiveDocument, useStore } from '../../app/store.ts';
import type { Diagnostic } from '../../csdl/model.ts';
import { DiagnosticsPanel } from '../shell/DiagnosticsPanel.tsx';
import { ElementView } from '../views/ElementView.tsx';
import { TabStrip } from './TabStrip.tsx';

// React Flow and the layout code are large, so the diagram is a chunk of its own that loads when the
// first diagram tab opens.
const DiagramView = lazy(() => import('../diagram/DiagramView.tsx'));

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', height: '100%' },
  view: { flex: 1, minHeight: 0, overflow: 'auto' },
  empty: { padding: tokens.spacingHorizontalL },
  diagnostics: { padding: tokens.spacingHorizontalL },
  element: { padding: tokens.spacingHorizontalL },
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
  const document = useStore(selectActiveDocument);
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
        ) : document?.status === 'ready' && active.kind === 'diagram' ? (
          <Suspense fallback={<Spinner className={styles.empty} label="Loading the diagram…" />}>
            <DiagramView key={active.id} tabId={active.id} resolved={document.resolved} />
          </Suspense>
        ) : document?.status === 'ready' ? (
          <div className={styles.element}>
            <ElementView key={active.id} tab={active} resolved={document.resolved} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
