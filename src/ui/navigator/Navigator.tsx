import { useMemo, useRef, useState } from 'react';
import {
  Body1,
  FlatTree,
  FlatTreeItem,
  makeStyles,
  SearchBox,
  Switch,
  tokens,
  TreeItemLayout,
  useHeadlessFlatTree_unstable,
  type HeadlessFlatTreeItemProps,
  type TreeItemValue,
} from '@fluentui/react-components';
import { useVirtualizer } from '@tanstack/react-virtual';
import { buildNavigatorTree, filterTree, type NavNode } from '../../app/navigator-tree.ts';
import type { ElementKind, Model } from '../../csdl/model.ts';

const ROW_HEIGHT = 32;

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', height: '100%' },
  controls: {
    display: 'flex',
    flexDirection: 'column',
    padding: tokens.spacingHorizontalS,
    gap: tokens.spacingVerticalXS,
  },
  scroll: { flex: 1, minHeight: 0, overflow: 'auto' },
  selected: { backgroundColor: tokens.colorSubtleBackgroundSelected },
  detail: { marginInlineStart: tokens.spacingHorizontalS, color: tokens.colorNeutralForeground3 },
  empty: { padding: tokens.spacingHorizontalM },
});

export interface NavigatorProps {
  model: Model;
  /** ID of the element whose tab is active. */
  selectedId: string | undefined;
  /** A single click opens a preview; `pin` is set by a double-click. */
  onOpen: (target: { id: string; kind: ElementKind }, pin: boolean) => void;
}

/** Flattens the tree in display order; the headless tree decides which rows are visible. */
function flatten(nodes: NavNode[]): {
  rows: HeadlessFlatTreeItemProps[];
  byId: Map<string, NavNode>;
} {
  const rows: HeadlessFlatTreeItemProps[] = [];
  const byId = new Map<string, NavNode>();
  const visit = (list: NavNode[], parentValue?: string) => {
    for (const node of list) {
      byId.set(node.id, node);
      rows.push({
        value: node.id,
        ...(parentValue !== undefined && { parentValue }),
        itemType: node.children.length > 0 ? 'branch' : 'leaf',
      });
      visit(node.children, node.id);
    }
  };
  visit(nodes);
  return { rows, byId };
}

export function Navigator({ model, selectedId, onOpen }: NavigatorProps) {
  const styles = useStyles();
  const [hideVocabularies, setHideVocabularies] = useState(true);
  const [query, setQuery] = useState('');
  // Until the user toggles something, the schemas are open, so a document does not start as a column
  // of collapsed namespaces.
  const [open, setOpen] = useState<Set<TreeItemValue> | undefined>();

  const tree = useMemo(
    () => buildNavigatorTree(model, { hideVocabularies }),
    [model, hideVocabularies],
  );
  const { rows, byId } = useMemo(() => flatten(filterTree(tree, query)), [tree, query]);
  const filtering = query.trim() !== '';

  // While filtering, every branch is open so that the matches are visible.
  const openItems = useMemo(
    () =>
      filtering
        ? new Set<TreeItemValue>(rows.filter((r) => r.itemType === 'branch').map((r) => r.value))
        : (open ?? new Set<TreeItemValue>(tree.map((n) => n.id))),
    [filtering, rows, open, tree],
  );

  const flatTree = useHeadlessFlatTree_unstable(rows, {
    openItems,
    onOpenChange: (_, data) => {
      if (!filtering) setOpen(new Set(data.openItems));
    },
  });
  const items = Array.from(flatTree.items());

  const scrollRef = useRef<HTMLDivElement>(null);
  // TanStack Virtual returns functions the React Compiler cannot memoize; nothing here depends on that.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const treeProps = flatTree.getTreeProps();

  return (
    <div className={styles.root}>
      <div className={styles.controls}>
        <SearchBox
          placeholder="Filter"
          aria-label="Filter the navigator"
          value={query}
          onChange={(_, data) => setQuery(data.value)}
        />
        <Switch
          label="Hide vocabulary schemas"
          checked={hideVocabularies}
          onChange={(_, data) => setHideVocabularies(data.checked)}
        />
      </div>
      <div ref={scrollRef} className={styles.scroll}>
        {items.length === 0 && <Body1 className={styles.empty}>No matches.</Body1>}
        <FlatTree
          {...treeProps}
          aria-label="Model elements"
          style={{ position: 'relative', height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((row) => {
            const item = items[row.index];
            const node = item && byId.get(String(item.value));
            if (!item || !node) return null;
            const { kind } = node;
            return (
              <FlatTreeItem
                {...item.getTreeItemProps()}
                key={item.value}
                className={node.id === selectedId ? styles.selected : undefined}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: ROW_HEIGHT,
                  transform: `translateY(${row.start}px)`,
                }}
                onClick={() => kind && onOpen({ id: node.id, kind }, false)}
                onDoubleClick={() => kind && onOpen({ id: node.id, kind }, true)}
              >
                <TreeItemLayout>
                  {node.label}
                  {node.detail && <span className={styles.detail}>{node.detail}</span>}
                </TreeItemLayout>
              </FlatTreeItem>
            );
          })}
        </FlatTree>
      </div>
    </div>
  );
}
