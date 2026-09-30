import {
  Button,
  FluentProvider,
  makeStyles,
  Text,
  tokens,
  webDarkTheme,
  webLightTheme,
} from '@fluentui/react-components';
import { openFile, openRecent } from './app/loader.ts';
import { selectActiveDocument, useStore } from './app/store.ts';
import { useTheme } from './app/theme.ts';
import { DiagnosticsPanel } from './ui/shell/DiagnosticsPanel.tsx';
import { RecentFiles } from './ui/shell/RecentFiles.tsx';
import { StartPage } from './ui/shell/StartPage.tsx';
import { Shell } from './ui/shell/Shell.tsx';
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
  const select = useStore((s) => s.select);
  const closeDocument = useStore((s) => s.closeDocument);
  const { preference, setPreference, scheme } = useTheme();

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
          navigator={null}
          workspace={
            <DiagnosticsPanel
              diagnostics={document.resolved.model.diagnostics}
              onSelect={(d) => select(d.target)}
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
