import {
  Button,
  FluentProvider,
  makeStyles,
  Spinner,
  Text,
  tokens,
  webDarkTheme,
  webLightTheme,
} from '@fluentui/react-components';
import { ErrorCircleRegular, KeyboardRegular, SearchRegular } from '@fluentui/react-icons';
import { useEffect, useState } from 'react';
import { useBoot } from './app/boot.ts';
import { diagramTab, diagramTypeFor } from './app/diagram-tab.ts';
import { openFile, openRecent } from './app/loader.ts';
import { openableTarget } from './app/openable.ts';
import { PROBLEMS_TAB, startRouting } from './app/routing.ts';
import { startTabPersistence } from './app/tab-persistence.ts';
import { selectActiveDocument, useStore } from './app/store.ts';
import { useTheme } from './app/theme.ts';
import { Inspector } from './ui/inspector/Inspector.tsx';
import { Navigator } from './ui/navigator/Navigator.tsx';
import { CommandPalette } from './ui/shell/CommandPalette.tsx';
import { focusActiveTab } from './ui/shell/focus.ts';
import { RecentFiles } from './ui/shell/RecentFiles.tsx';
import { StartPage } from './ui/shell/StartPage.tsx';
import { ModeToggle } from './ui/shell/ModeToggle.tsx';
import { Shell } from './ui/shell/Shell.tsx';
import { ShortcutsDialog } from './ui/shell/ShortcutsDialog.tsx';
import { Workspace } from './ui/workspace/Workspace.tsx';
import { ThemeToggle } from './ui/shell/ThemeToggle.tsx';

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
  loading: { flex: 1, display: 'grid', placeItems: 'center' },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    width: 'min(40rem, 100%)',
  },
});

/** Elements that take typed text, where a shortcut key must stay a character. */
const INPUTS = 'input, textarea, select, [contenteditable="true"], .cm-editor';

export function App() {
  const styles = useStyles();
  const document = useStore(selectActiveDocument);
  const activeTab = useStore((s) => s.activeTab);
  const selection = useStore((s) => s.selection);
  const openTab = useStore((s) => s.openTab);
  const select = useStore((s) => s.select);
  const detailMode = useStore((s) => s.detailMode);
  const setDetailMode = useStore((s) => s.setDetailMode);
  const closeDocument = useStore((s) => s.closeDocument);
  const { preference, setPreference, scheme } = useTheme();
  useEffect(() => startRouting(), []);
  useEffect(() => startTabPersistence(), []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const booting = useBoot(document);
  const ready = document?.status === 'ready';
  useEffect(() => {
    if (!ready) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    // Captured, so that the source view's editor cannot swallow the shortcut.
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [ready]);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : undefined;
      // A question mark typed into a field is text, not a request for help.
      if (e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey || target?.closest(INPUTS)) return;
      setShortcutsOpen(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    // Not `className`: Fluent copies it onto the root of every portal (tooltips, menus, dialogs), and
    // `styles.root` there is a full-height, opaque box that covers the app.
    <FluentProvider
      theme={scheme === 'dark' ? webDarkTheme : webLightTheme}
      style={{ height: '100%' }}
    >
      <div className={styles.root}>
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
            <Button
              appearance="subtle"
              icon={<KeyboardRegular />}
              aria-label="Keyboard shortcuts"
              onClick={() => setShortcutsOpen(true)}
            />
            <ThemeToggle preference={preference} onChange={setPreference} />
          </div>
        </header>
        {booting ? (
          <main className={styles.loading}>
            <Spinner label={document ? `Opening ${document.name}…` : 'Loading…'} />
          </main>
        ) : document?.status === 'ready' ? (
          <Shell
            navigator={
              <Navigator
                model={document.resolved.model}
                selectedId={activeTab}
                onOpen={(target, pin) => openTab(target, pin)}
              />
            }
            toolbar={
              <>
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<SearchRegular />}
                  onClick={() => setPaletteOpen(true)}
                >
                  Search (Ctrl+K)
                </Button>
                <Button
                  appearance="subtle"
                  size="small"
                  icon={<ErrorCircleRegular />}
                  onClick={() => openTab(PROBLEMS_TAB, true)}
                >
                  Problems ({document.resolved.model.diagnostics.length})
                </Button>
                <ModeToggle
                  mode={detailMode}
                  onChange={setDetailMode}
                  label="Detail for all views"
                />
              </>
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
            inspector={
              <Inspector
                resolved={document.resolved}
                text={document.text}
                id={selection === PROBLEMS_TAB.id ? undefined : selection}
                mode={detailMode}
              />
            }
          />
        ) : (
          <main className={styles.main}>
            <div className={styles.content}>
              <StartPage document={document} onOpen={(file) => void openFile(file)} />
              <RecentFiles onOpen={(file) => void openRecent(file)} />
            </div>
          </main>
        )}
        <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
        {document?.status === 'ready' && (
          <CommandPalette
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
            index={document.index}
            onChoose={(entry, { diagram }) => {
              // Relationships are for types and sets; any other entry opens as usual.
              const typeId = diagram ? diagramTypeFor(document.resolved, entry.id) : undefined;
              if (typeId) {
                openTab(diagramTab(typeId), true);
                focusActiveTab();
                return;
              }
              const target = openableTarget(document.resolved, entry.id);
              if (!target) return;
              openTab(target);
              // A property opens its type, with the property itself selected; a label, its element.
              select(entry.kind === 'annotation' ? entry.parent : entry.id);
              focusActiveTab();
            }}
          />
        )}
      </div>
    </FluentProvider>
  );
}
