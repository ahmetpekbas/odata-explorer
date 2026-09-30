import {
  FluentProvider,
  makeStyles,
  Text,
  tokens,
  webDarkTheme,
  webLightTheme,
} from '@fluentui/react-components';
import { openFile } from './app/loader.ts';
import { selectActiveDocument, useStore } from './app/store.ts';
import { useTheme } from './app/theme.ts';
import { DiagnosticsPanel } from './ui/shell/DiagnosticsPanel.tsx';
import { StartPage } from './ui/shell/StartPage.tsx';
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
        <ThemeMenu preference={preference} onChange={setPreference} />
      </header>
      <main className={styles.main}>
        <div className={styles.content}>
          <StartPage document={document} onOpen={(file) => void openFile(file)} />
          {document?.status === 'ready' && (
            <DiagnosticsPanel
              diagnostics={document.resolved.model.diagnostics}
              // Until the navigator exists (M4), selecting only records the target.
              onSelect={(d) => select(d.target)}
            />
          )}
        </div>
      </main>
    </FluentProvider>
  );
}
