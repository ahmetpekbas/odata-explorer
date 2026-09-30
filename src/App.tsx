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
    placeItems: 'center',
    padding: tokens.spacingHorizontalL,
  },
});

export function App() {
  const styles = useStyles();
  const document = useStore(selectActiveDocument);
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
        <StartPage document={document} onOpen={(file) => void openFile(file)} />
      </main>
    </FluentProvider>
  );
}
