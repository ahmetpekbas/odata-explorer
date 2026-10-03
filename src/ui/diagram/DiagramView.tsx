import { useEffect, useMemo, useState } from 'react';
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Body1,
  MessageBar,
  MessageBarBody,
  makeStyles,
  Spinner,
  tokens,
} from '@fluentui/react-components';
import { diagramTypeOf } from '../../app/diagram-tab.ts';
import { buildGraph, type Graph } from '../../csdl/graph.ts';
import type { Resolved } from '../../csdl/resolve.ts';
import { workerLayout, type Layout, type LayoutResult } from './layout.ts';
import { RelationEdge } from './RelationEdge.tsx';
import { sizeOf } from './size.ts';
import { TypeNode } from './TypeNode.tsx';

const nodeTypes = { type: TypeNode };
const edgeTypes = { relation: RelationEdge };

const useStyles = makeStyles({
  root: {
    height: '100%',
    minHeight: '20rem',
    // React Flow's own palette, replaced by the theme's so light and dark both work.
    '--xy-background-color': tokens.colorNeutralBackground2,
    '--xy-background-pattern-color': tokens.colorNeutralStroke2,
    '--xy-controls-button-background-color': tokens.colorNeutralBackground1,
    '--xy-controls-button-background-color-hover': tokens.colorNeutralBackground1Hover,
    '--xy-controls-button-color': tokens.colorNeutralForeground1,
    '--xy-controls-button-border-color': tokens.colorNeutralStroke2,
    '--xy-attribution-background-color': 'transparent',
  },
  message: { margin: tokens.spacingHorizontalL },
});

interface Laid {
  graph: Graph;
  showAll: boolean;
  result: LayoutResult;
}

interface DiagramViewProps {
  resolved: Resolved;
  /** ID of the diagram tab. */
  tabId: string;
  /** Places the nodes; the default runs elkjs in a worker. */
  layout?: Layout;
}

/** The relationships around one type, as a graph that can be panned and zoomed. */
export default function DiagramView({ resolved, tabId, layout = workerLayout }: DiagramViewProps) {
  const styles = useStyles();
  const typeId = diagramTypeOf(tabId) ?? '';
  const [hops] = useState(1);
  const [inheritance] = useState(true);
  const [showAll] = useState(false);
  const [laid, setLaid] = useState<Laid>();
  const [error, setError] = useState<string>();

  const graph = useMemo(
    () => buildGraph(resolved, typeId, { hops, inheritance }),
    [resolved, typeId, hops, inheritance],
  );

  useEffect(() => {
    let current = true;
    layout({
      nodes: graph.nodes.map((n) => ({ id: n.id, ...sizeOf(n, showAll) })),
      edges: graph.edges,
    }).then(
      (result) => current && setLaid({ graph, showAll, result }),
      (e: unknown) => current && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      current = false;
    };
  }, [graph, showAll, layout]);

  const elements = useMemo(() => {
    if (laid?.graph !== graph || laid.showAll !== showAll) return undefined;
    const nodes: Node[] = graph.nodes.map((node) => ({
      id: node.id,
      type: 'type',
      position: laid.result.nodes[node.id] ?? { x: 0, y: 0 },
      data: { node, showAll, center: node.id === typeId },
    }));
    const edges: Edge[] = graph.edges.map((edge) => ({
      id: edge.id,
      type: 'relation',
      source: edge.source,
      target: edge.target,
      ...(edge.source === edge.target && { sourceHandle: 'loop-out', targetHandle: 'loop-in' }),
      markerEnd: { type: MarkerType.ArrowClosed, color: tokens.colorNeutralForeground3 },
      data: { edge, route: laid.result.edges[edge.id] },
    }));
    return { nodes, edges };
  }, [laid, graph, showAll, typeId]);

  if (graph.hint) {
    return (
      <MessageBar intent="warning" className={styles.message}>
        <MessageBarBody>{graph.hint}</MessageBarBody>
      </MessageBar>
    );
  }
  if (graph.nodes.length === 0) {
    return (
      <Body1 block className={styles.message}>
        {typeId} is not a type of this model.
      </Body1>
    );
  }
  if (error) {
    return (
      <MessageBar intent="error" className={styles.message}>
        <MessageBarBody>The diagram could not be laid out: {error}</MessageBarBody>
      </MessageBar>
    );
  }
  if (!elements) return <Spinner className={styles.message} label="Laying out the diagram…" />;

  return (
    <div className={styles.root} role="figure" aria-label={`Relationships of ${typeId}`}>
      <ReactFlow
        // A new graph starts from a view that fits it.
        key={`${graph.nodes.length}:${graph.edges.length}:${showAll}`}
        nodes={elements.nodes}
        edges={elements.edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesConnectable={false}
        fitView
        minZoom={0.1}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
