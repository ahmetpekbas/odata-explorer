import {
  Body1,
  FluentProvider,
  makeStyles,
  Text,
  tokens,
  webDarkTheme,
  webLightTheme,
} from '@fluentui/react-components';
import { useTheme } from './app/theme.ts';
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
        <Body1>Open an OData $metadata document to explore its entities and relationships.</Body1>
      </main>
    </FluentProvider>
  );
}
