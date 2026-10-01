import { useDeferredValue, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  Body1,
  Caption1,
  Dialog,
  DialogBody,
  DialogContent,
  DialogSurface,
  Input,
  makeStyles,
  mergeClasses,
  ToggleButton,
  tokens,
} from '@fluentui/react-components';
import { SearchRegular } from '@fluentui/react-icons';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  KIND_GROUPS,
  KIND_LABEL,
  preparedIndex,
  searchIndex,
  type SearchHit,
} from '../../app/search.ts';
import type { SearchEntry, SearchKind } from '../../csdl/search-index.ts';

const ROW_HEIGHT = 40;
const LIST_ID = 'command-palette-results';
const optionId = (i: number) => `command-palette-option-${i}`;

const useStyles = makeStyles({
  surface: { width: 'min(40rem, calc(100vw - 2rem))', maxWidth: 'none', padding: 0 },
  body: { display: 'flex', flexDirection: 'column' },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
  },
  filters: { display: 'flex', flexWrap: 'wrap', gap: tokens.spacingHorizontalXS },
  scroll: { height: '20rem', overflow: 'auto' },
  list: { position: 'relative', margin: 0, padding: 0, listStyle: 'none' },
  row: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: `${ROW_HEIGHT}px`,
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    paddingInline: tokens.spacingHorizontalS,
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorSubtleBackgroundHover },
  },
  active: { backgroundColor: tokens.colorSubtleBackgroundSelected },
  label: { flex: 'none', maxWidth: '45%' },
  kind: { flex: 'none', width: '8rem', color: tokens.colorNeutralForeground3 },
  parent: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.colorNeutralForeground3,
  },
  empty: { padding: tokens.spacingHorizontalM, color: tokens.colorNeutralForeground3 },
});

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  index: SearchEntry[];
  /** Called with the chosen entry, after the palette has closed. */
  onChoose: (entry: SearchEntry) => void;
}

/** Ctrl+K: search every symbol of the model and open it. Works from the keyboard alone. */
export function CommandPalette({ open, onOpenChange, index, onChoose }: CommandPaletteProps) {
  const styles = useStyles();
  return (
    <Dialog open={open} onOpenChange={(_, data) => onOpenChange(data.open)}>
      <DialogSurface className={styles.surface} aria-label="Search the model">
        <DialogBody className={styles.body}>
          <DialogContent className={styles.content}>
            <Palette
              index={index}
              onChoose={(entry) => {
                onOpenChange(false);
                onChoose(entry);
              }}
            />
          </DialogContent>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}

/** Mounted only while the dialog is open, so every opening starts with an empty search. */
function Palette({ index, onChoose }: Pick<CommandPaletteProps, 'index' | 'onChoose'>) {
  const styles = useStyles();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<ReadonlySet<string>>(new Set());
  const [active, setActive] = useState(0);
  const deferredQuery = useDeferredValue(query);

  const kinds = useMemo(
    () =>
      new Set<SearchKind>(KIND_GROUPS.filter((g) => groups.has(g.label)).flatMap((g) => g.kinds)),
    [groups],
  );
  const hits: SearchHit[] = useMemo(
    () => searchIndex(preparedIndex(index), deferredQuery, { kinds }),
    [index, deferredQuery, kinds],
  );
  const current = Math.min(active, Math.max(hits.length - 1, 0));

  // The dialog moves the focus to its surface when it opens; the search box takes it from there.
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  const scrollRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns functions the React Compiler cannot memoize; nothing here depends on that.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: hits.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });
  const { scrollToIndex } = virtualizer;
  useEffect(() => {
    if (hits.length > 0) scrollToIndex(current);
  }, [current, hits.length, scrollToIndex]);

  const move = (to: number) => setActive(Math.max(0, Math.min(to, hits.length - 1)));
  const onKeyDown = (e: KeyboardEvent) => {
    const page = Math.floor((scrollRef.current?.clientHeight || 320) / ROW_HEIGHT);
    switch (e.key) {
      case 'ArrowDown':
        move(current + 1);
        break;
      case 'ArrowUp':
        move(current - 1);
        break;
      case 'PageDown':
        move(current + page);
        break;
      case 'PageUp':
        move(current - page);
        break;
      case 'Enter': {
        const hit = hits[current];
        if (hit) onChoose(hit.entry);
        break;
      }
      default:
        return;
    }
    e.preventDefault();
  };

  return (
    <>
      <Input
        ref={inputRef}
        autoFocus
        role="combobox"
        aria-label="Search the model"
        aria-expanded={hits.length > 0}
        aria-controls={LIST_ID}
        aria-activedescendant={hits.length > 0 ? optionId(current) : undefined}
        aria-autocomplete="list"
        placeholder="Search types, properties, sets, operations, terms…"
        contentBefore={<SearchRegular />}
        value={query}
        onChange={(_, data) => {
          setQuery(data.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      <div className={styles.filters} role="group" aria-label="Filter by kind">
        {KIND_GROUPS.map(({ label }) => (
          <ToggleButton
            key={label}
            size="small"
            shape="circular"
            checked={groups.has(label)}
            onClick={() => {
              const next = new Set(groups);
              if (!next.delete(label)) next.add(label);
              setGroups(next);
              setActive(0);
            }}
          >
            {label}
          </ToggleButton>
        ))}
      </div>
      <div ref={scrollRef} className={styles.scroll}>
        {deferredQuery.trim() !== '' && hits.length === 0 && (
          <Body1 className={styles.empty}>No matches.</Body1>
        )}
        <ul
          id={LIST_ID}
          role="listbox"
          aria-label="Results"
          className={styles.list}
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((row) => {
            const hit = hits[row.index];
            if (!hit) return null;
            const { entry } = hit;
            return (
              <li
                key={`${entry.kind}:${entry.id}`}
                id={optionId(row.index)}
                role="option"
                aria-selected={row.index === current}
                className={mergeClasses(styles.row, row.index === current && styles.active)}
                style={{ transform: `translateY(${row.start}px)` }}
                // Clicking a result must not take the focus out of the search box.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onChoose(entry)}
              >
                <Body1 className={styles.label} truncate wrap={false}>
                  {entry.label}
                </Body1>
                <Caption1 className={styles.kind}>{KIND_LABEL[entry.kind]}</Caption1>
                <Caption1 className={styles.parent} title={entry.parent}>
                  {entry.parent}
                </Caption1>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
