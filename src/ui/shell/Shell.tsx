import { useState, type ReactNode } from 'react';
import { Button, makeStyles, tokens } from '@fluentui/react-components';
import { PanelRightContractRegular, PanelRightExpandRegular } from '@fluentui/react-icons';
import { Group, Panel, Separator, useDefaultLayout, usePanelRef } from 'react-resizable-panels';

const useStyles = makeStyles({
  root: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
  toolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: tokens.spacingHorizontalXS,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  group: { flex: 1, minHeight: 0 },
  pane: { overflow: 'auto', height: '100%' },
  separator: {
    width: '4px',
    backgroundColor: tokens.colorNeutralStroke2,
    ':hover': { backgroundColor: tokens.colorBrandStroke1 },
    ':focus-visible': { backgroundColor: tokens.colorBrandStroke1 },
  },
});

interface ShellProps {
  navigator: ReactNode;
  workspace: ReactNode;
  inspector: ReactNode;
}

/** Navigator | workspace | inspector. Pane sizes, and whether the inspector is collapsed, persist. */
export function Shell({ navigator, workspace, inspector }: ShellProps) {
  const styles = useStyles();
  const inspectorRef = usePanelRef();
  const [collapsed, setCollapsed] = useState(false);
  const layout = useDefaultLayout({
    id: 'odata-explorer:shell',
    panelIds: ['navigator', 'workspace', 'inspector'],
    storage: localStorage,
  });

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <Button
          appearance="subtle"
          size="small"
          icon={collapsed ? <PanelRightExpandRegular /> : <PanelRightContractRegular />}
          aria-label={collapsed ? 'Expand inspector' : 'Collapse inspector'}
          onClick={() =>
            collapsed ? inspectorRef.current?.expand() : inspectorRef.current?.collapse()
          }
        />
      </div>
      <Group
        orientation="horizontal"
        className={styles.group}
        defaultLayout={layout.defaultLayout}
        onLayoutChanged={layout.onLayoutChanged}
      >
        <Panel id="navigator" defaultSize="22%" minSize="12%">
          <nav className={styles.pane} aria-label="Navigator">
            {navigator}
          </nav>
        </Panel>
        <Separator className={styles.separator} />
        <Panel id="workspace" defaultSize="53%" minSize="25%">
          <main className={styles.pane}>{workspace}</main>
        </Panel>
        <Separator className={styles.separator} />
        <Panel
          id="inspector"
          panelRef={inspectorRef}
          defaultSize="25%"
          minSize="12%"
          collapsible
          collapsedSize={0}
          onResize={() => setCollapsed(inspectorRef.current?.isCollapsed() ?? false)}
        >
          <aside className={styles.pane} aria-label="Inspector">
            {inspector}
          </aside>
        </Panel>
      </Group>
    </div>
  );
}
