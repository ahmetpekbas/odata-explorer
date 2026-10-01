import { useRef, type ReactNode } from 'react';
import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useStore } from '../../app/store.ts';

const ROW_HEIGHT = 36;
const HEADER_HEIGHT = 32;
const MAX_HEIGHT = 480;

const useStyles = makeStyles({
  scroll: {
    overflow: 'auto',
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
  },
  grid: { position: 'relative', minWidth: 'max-content' },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    backgroundColor: tokens.colorNeutralBackground3,
    fontWeight: tokens.fontWeightSemibold,
  },
  row: {
    display: 'grid',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    paddingInline: tokens.spacingHorizontalM,
    boxSizing: 'border-box',
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke3}`,
  },
  selectable: {
    cursor: 'pointer',
    ':hover': { backgroundColor: tokens.colorSubtleBackgroundHover },
    ':focus-visible': { outline: `${tokens.strokeWidthThick} solid ${tokens.colorStrokeFocus2}` },
  },
  selected: { backgroundColor: tokens.colorSubtleBackgroundSelected },
  cell: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  empty: { color: tokens.colorNeutralForeground3 },
});

export interface Column<T> {
  key: string;
  header: string;
  /** A CSS grid track, e.g. `12rem` or `minmax(10rem, 1fr)`. */
  width: string;
  cell: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  label: string;
  columns: readonly Column<T>[];
  rows: readonly T[];
  /** Shown instead of the table when there are no rows. */
  emptyText?: string;
  /** The element ID of a row. Rows that have one can be selected, which the inspector follows. */
  rowId?: (row: T) => string;
}

/** A table that only renders the rows in view, so a type with hundreds of properties stays smooth. */
export function DataTable<T>({ label, columns, rows, emptyText, rowId }: DataTableProps<T>) {
  const styles = useStyles();
  const selection = useStore((s) => s.selection);
  const select = useStore((s) => s.select);
  const scrollRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns functions the React Compiler cannot memoize; nothing here depends on that.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });
  if (rows.length === 0) return emptyText ? <div className={styles.empty}>{emptyText}</div> : null;

  const template = columns.map((c) => c.width).join(' ');
  const height = Math.min(HEADER_HEIGHT + rows.length * ROW_HEIGHT, MAX_HEIGHT);
  return (
    <div ref={scrollRef} className={styles.scroll} style={{ height }}>
      <div role="table" aria-label={label} aria-rowcount={rows.length + 1} className={styles.grid}>
        <div
          role="row"
          className={mergeClasses(styles.row, styles.header)}
          style={{ gridTemplateColumns: template, height: HEADER_HEIGHT }}
        >
          {columns.map((c) => (
            <div key={c.key} role="columnheader" className={styles.cell}>
              {c.header}
            </div>
          ))}
        </div>
        <div role="rowgroup" style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((item) => {
            const row = rows[item.index];
            if (row === undefined) return null;
            const id = rowId?.(row);
            const selected = id !== undefined && id === selection;
            return (
              <div
                key={item.index}
                role="row"
                aria-rowindex={item.index + 2}
                aria-selected={id === undefined ? undefined : selected}
                tabIndex={id === undefined ? undefined : 0}
                onClick={id === undefined ? undefined : () => select(id)}
                onKeyDown={
                  id === undefined
                    ? undefined
                    : (e) => {
                        if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' '))
                          return;
                        e.preventDefault();
                        select(id);
                      }
                }
                className={mergeClasses(
                  styles.row,
                  id !== undefined && styles.selectable,
                  selected && styles.selected,
                )}
                style={{
                  gridTemplateColumns: template,
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: ROW_HEIGHT,
                  transform: `translateY(${item.start}px)`,
                }}
              >
                {columns.map((c) => (
                  <div key={c.key} role="cell" className={styles.cell}>
                    {c.cell(row)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
