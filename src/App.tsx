import {
  Button,
  FluentProvider,
  makeStyles,
  Text,
  tokens,
  webDarkTheme,
  webLightTheme,
} from '@fluentui/react-components';
import { ErrorCircleRegular } from '@fluentui/react-icons';
import { useEffect } from 'react';
import { openFile, openRecent } from './app/loader.ts';
import { openableTarget } from './app/openable.ts';
import { PROBLEMS_TAB, startRouting } from './app/routing.ts';
import { selectActiveDocument, useStore } from './app/store.ts';
import { useTheme } from './app/theme.ts';
import { Navigator } from './ui/navigator/Navigator.tsx';
import { RecentFiles } from './ui/shell/RecentFiles.tsx';
import { StartPage } from './ui/shell/StartPage.tsx';
import { Shell } from './ui/shell/Shell.tsx';
import { Workspace } from './ui/workspace/Workspace.tsx';
import { ThemeMenu } from './ui/shell/ThemeMenu.tsx';

const useStyles = makeStyles({
  root: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground1,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalL}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  actions: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
  title: {
    margin: 0,
  },
  main: {
    flex: 1,
    display: 'grid',
    placeItems: 'start center',
    padding: tokens.spacingHorizontalL,
    overflow: 'auto',
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    width: 'min(40rem, 100%)',
  },
});

export function App() {
  const styles = useStyles();
  const document = useStore(selectActiveDocument);
  const activeTab = useStore((s) => s.activeTab);
  const openTab = useStore((s) => s.openTab);
  const select = useStore((s) => s.select);
  const closeDocument = useStore((s) => s.closeDocument);
  const { preference, setPreference, scheme } = useTheme();
  useEffect(() => startRouting(), []);

  return (
    <FluentProvider
      theme={scheme === 'dark' ? webDarkTheme : webLightTheme}
      className={styles.root}
    >
      <header className={styles.header}>
        <Text as="h1" size={500} weight="semibold" className={styles.title}>
          OData Explorer
        </Text>
        <div className={styles.actions}>
          {document?.status === 'ready' && (
            <Button appearance="subtle" onClick={() => closeDocument(document.id)}>
              Close {document.name}
            </Button>
          )}
          <ThemeMenu preference={preference} onChange={setPreference} />
        </div>
      </header>
      {document?.status === 'ready' ? (
        <Shell
          navigator={
            <Navigator
              model={document.resolved.model}
              selectedId={activeTab}
              onOpen={(target, pin) => openTab(target, pin)}
            />
          }
          toolbar={
            <Button
              appearance="subtle"
              size="small"
              icon={<ErrorCircleRegular />}
              onClick={() => openTab(PROBLEMS_TAB, true)}
            >
              Problems ({document.resolved.model.diagnostics.length})
            </Button>
          }
          workspace={
            <Workspace
              diagnostics={document.resolved.model.diagnostics}
              onSelectDiagnostic={(d) => {
                const target = d.target && openableTarget(document.resolved, d.target);
                if (!target || !d.target) return;
                openTab(target);
                // A property or parameter opens its type, with the element itself selected.
                select(d.target);
              }}
            />
          }
          inspector={null}
        />
      ) : (
        <main className={styles.main}>
          <div className={styles.content}>
            <StartPage document={document} onOpen={(file) => void openFile(file)} />
            <RecentFiles onOpen={(file) => void openRecent(file)} />
          </div>
        </main>
      )}
    </FluentProvider>
  );
}
