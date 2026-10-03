import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Body1,
  Field,
  MessageBar,
  MessageBarBody,
  makeStyles,
  Select,
  Spinner,
  Switch,
  tokens,
} from '@fluentui/react-components';
import { diagramTypeOf } from '../../app/diagram-tab.ts';
import { useDiagramOptions, useStore } from '../../app/store.ts';
import { buildGraph, type Graph } from '../../csdl/graph.ts';
import type { Resolved } from '../../csdl/resolve.ts';
import { workerLayout, type Layout, type LayoutResult } from './layout.ts';
import { RelationEdge } from './RelationEdge.tsx';
import { sizeOf } from './size.ts';
import { TypeNode } from './TypeNode.tsx';

const nodeTypes = { type: TypeNode };
const edgeTypes = { relation: RelationEdge };

const useStyles = makeStyles({
  root: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: '20rem' },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: tokens.spacingHorizontalL,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalL}`,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  canvas: {
    flex: 1,
    minHeight: 0,
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
  const { hops, inheritance, showAll } = useDiagramOptions(tabId);
  const setOptions = useStore((s) => s.setDiagramOptions);
  const openTab = useStore((s) => s.openTab);
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
      (result) => {
        if (!current) return;
        setError(undefined);
        setLaid({ graph, showAll, result });
      },
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

  const open = (node: Node, pin: boolean) => {
    const kind = graph.nodes.find((n) => n.id === node.id)?.kind;
    if (kind) openTab({ id: node.id, kind }, pin);
  };

  let body: ReactNode;
  if (graph.hint) {
    body = (
      <MessageBar intent="warning" className={styles.message}>
        <MessageBarBody>{graph.hint}</MessageBarBody>
      </MessageBar>
    );
  } else if (graph.nodes.length === 0) {
    body = (
      <Body1 block className={styles.message}>
        {typeId} is not a type of this model.
      </Body1>
    );
  } else if (error) {
    body = (
      <MessageBar intent="error" className={styles.message}>
        <MessageBarBody>The diagram could not be laid out: {error}</MessageBarBody>
      </MessageBar>
    );
  } else if (!elements) {
    body = <Spinner className={styles.message} label="Laying out the diagram…" />;
  } else {
    body = (
      <div className={styles.canvas} role="figure" aria-label={`Relationships of ${typeId}`}>
        <ReactFlow
          // A new graph starts from a view that fits it.
          key={`${typeId}:${hops}:${inheritance}:${showAll}`}
          nodes={elements.nodes}
          edges={elements.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesConnectable={false}
          onNodeClick={(_, node) => open(node, false)}
          onNodeDoubleClick={(_, node) => open(node, true)}
          fitView
          minZoom={0.1}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.toolbar} role="toolbar" aria-label="Diagram options">
        <Field label="Hops" orientation="horizontal">
          <Select
            value={String(hops)}
            onChange={(_, data) => setOptions(tabId, { hops: Number(data.value) })}
          >
            {[1, 2, 3].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </Field>
        <Switch
          label="Inheritance"
          checked={inheritance}
          onChange={(_, data) => setOptions(tabId, { inheritance: data.checked })}
        />
        <Switch
          label="All properties"
          checked={showAll}
          onChange={(_, data) => setOptions(tabId, { showAll: data.checked })}
        />
      </div>
      {body}
    </div>
  );
}
