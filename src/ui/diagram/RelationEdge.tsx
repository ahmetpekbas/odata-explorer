import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import { makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import type { GraphEdge } from '../../csdl/graph.ts';

export type RelationEdgeData = { edge: GraphEdge };
export type RelationFlowEdge = Edge<RelationEdgeData, 'relation'>;

const useStyles = makeStyles({
  label: {
    position: 'absolute',
    pointerEvents: 'none',
    paddingInline: tokens.spacingHorizontalXS,
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    whiteSpace: 'nowrap',
  },
  cardinality: { color: tokens.colorNeutralForeground3 },
});

/** Where a cardinality sits next to the end of an edge: clear of the node, on the side it leaves. */
const OFFSET: Record<Position, [number, number]> = {
  [Position.Left]: [-14, -10],
  [Position.Right]: [14, -10],
  [Position.Top]: [-12, -14],
  [Position.Bottom]: [-12, 14],
};

const at = (x: number, y: number) => `translate(-50%, -50%) translate(${x}px, ${y}px)`;

/** An edge with its navigation names in the middle and a cardinality at each end that has one. */
export function RelationEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps<RelationFlowEdge>) {
  const styles = useStyles();
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const edge = data?.edge;
  if (!edge) return null;
  const text = edge.partnerLabel ? `${edge.label} ⇄ ${edge.partnerLabel}` : edge.label;

  const end = (cardinality: string | undefined, x: number, y: number, position: Position) => {
    if (cardinality === undefined || edge.kind === 'inheritance') return null;
    const [dx, dy] = OFFSET[position];
    return (
      <div
        className={mergeClasses(styles.label, styles.cardinality)}
        style={{ transform: at(x + dx, y + dy) }}
      >
        {cardinality}
      </div>
    );
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        {...(markerEnd && { markerEnd })}
        style={{
          stroke: tokens.colorNeutralForeground3,
          strokeWidth: edge.kind === 'containment' ? 2.5 : 1.5,
          ...(edge.kind === 'inheritance' && { strokeDasharray: '6 4' }),
        }}
      />
      <EdgeLabelRenderer>
        {text && (
          <div className={styles.label} style={{ transform: at(labelX, labelY) }}>
            {edge.kind === 'containment' && '◆ '}
            {text}
          </div>
        )}
        {end(edge.sourceCardinality, sourceX, sourceY, sourcePosition)}
        {end(edge.targetCardinality, targetX, targetY, targetPosition)}
      </EdgeLabelRenderer>
    </>
  );
}
