import { lazy, Suspense, useMemo, useState } from 'react';
import { Body1, makeStyles, Tab, TabList, tokens } from '@fluentui/react-components';
import { sourceOf } from '../../app/source.ts';
import { useStore, type DetailMode } from '../../app/store.ts';
import type { Resolved } from '../../csdl/resolve.ts';
import { AnnotationsPanel } from './AnnotationsPanel.tsx';

// CodeMirror is large, so the source panel is a chunk of its own that loads when the tab first opens.
const SourcePanel = lazy(() => import('./SourcePanel.tsx'));

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 },
  tabs: {
    padding: `0 ${tokens.spacingHorizontalS}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  body: { flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' },
  loading: { padding: tokens.spacingHorizontalM },
});

type InspectorTab = 'annotations' | 'source';

interface InspectorProps {
  resolved: Resolved;
  /** The document's text, which XML source fragments are sliced from. */
  text: string;
  /** ID of the selected element, or of the active tab. */
  id: string | undefined;
  mode: DetailMode;
}

/** Annotations and source of the selected element, in tabs. Both follow the tab and the selected row. */
export function Inspector({ resolved, text, id, mode }: InspectorProps) {
  const styles = useStyles();
  const [tab, setTab] = useState<InspectorTab>('annotations');
  const openTab = useStore((s) => s.openTab);
  // Only worked out while the source tab is showing: a JSON document is indexed on first use.
  const source = useMemo(
    () => (tab === 'source' ? sourceOf(resolved, text, id) : undefined),
    [tab, resolved, text, id],
  );
  return (
    <div className={styles.root}>
      <TabList
        className={styles.tabs}
        size="small"
        selectedValue={tab}
        onTabSelect={(_, data) => setTab(data.value as InspectorTab)}
      >
        <Tab value="annotations">Annotations</Tab>
        <Tab value="source">Source</Tab>
      </TabList>
      <div className={styles.body}>
        {tab === 'annotations' ? (
          <AnnotationsPanel resolved={resolved} id={id} mode={mode} />
        ) : (
          <Suspense fallback={<Body1 className={styles.loading}>Loading source…</Body1>}>
            <SourcePanel source={source} resolved={resolved} onOpen={openTab} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
