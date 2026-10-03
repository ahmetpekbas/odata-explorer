import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import { KeyRegular } from '@fluentui/react-icons';
import type { GraphNode } from '../../csdl/graph.ts';
import { NODE_METRICS, sectionsOf, sizeOf } from './size.ts';

export type TypeNodeData = { node: GraphNode; showAll: boolean; center: boolean };
export type TypeFlowNode = Node<TypeNodeData, 'type'>;

const useStyles = makeStyles({
  root: {
    boxSizing: 'border-box',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
    border: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase200,
    boxShadow: tokens.shadow4,
  },
  center: {
    border: `${tokens.strokeWidthThick} solid ${tokens.colorBrandStroke1}`,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    boxSizing: 'border-box',
    height: `${NODE_METRICS.header}px`,
    paddingInline: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground3,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  // The handles only anchor the edges; the layout decides where an edge runs.
  handle: { opacity: 0, pointerEvents: 'none' },
  title: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  abstract: { fontStyle: 'italic' },
  badge: { color: tokens.colorNeutralForeground3, fontWeight: tokens.fontWeightRegular },
  section: {
    boxSizing: 'border-box',
    paddingBlock: `${NODE_METRICS.sectionPad / 2}px`,
    borderTop: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalS,
    boxSizing: 'border-box',
    height: `${NODE_METRICS.row}px`,
    paddingInline: tokens.spacingHorizontalS,
  },
  name: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  type: {
    flexShrink: 0,
    maxWidth: '50%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: tokens.colorNeutralForeground3,
  },
});

/** A structured type: its name, its key and navigation properties, and optionally every property. */
export function TypeNode({ data }: NodeProps<TypeFlowNode>) {
  const styles = useStyles();
  const { node, showAll, center } = data;
  const size = sizeOf(node, showAll);
  return (
    <div
      className={mergeClasses(styles.root, center && styles.center)}
      style={{ width: size.width, height: size.height }}
    >
      <Handle className={styles.handle} type="target" position={Position.Left} />
      <Handle className={styles.handle} type="source" position={Position.Right} />
      {/* A navigation that leads back to its own type loops over the top of the node. */}
      <Handle
        className={styles.handle}
        id="loop-in"
        type="target"
        position={Position.Top}
        style={{ left: '25%' }}
      />
      <Handle
        className={styles.handle}
        id="loop-out"
        type="source"
        position={Position.Top}
        style={{ left: '75%' }}
      />
      <div className={styles.header} title={node.name}>
        <span className={mergeClasses(styles.title, node.abstract && styles.abstract)}>
          {node.name}
        </span>
        {node.kind === 'complexType' && <span className={styles.badge}>complex</span>}
      </div>
      {sectionsOf(node, showAll).map(({ id, rows }) => (
        <div key={id} className={styles.section}>
          {rows.map((row) => (
            <div key={row.name} className={styles.row}>
              <span className={styles.name} title={row.name}>
                {id === 'key' && <KeyRegular aria-label="Key" />} {row.name}
              </span>
              <span className={styles.type} title={row.type}>
                {row.type}
              </span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
