// The navigator's tree: per schema its types, terms and operations, and the entity container with its
// sets, singletons and imports. Empty groups are left out. Pure data, so it can be tested without a DOM.
import { overloadGroupId } from '../csdl/ids.ts';
import type { ElementKind, Model, Operation, Schema } from '../csdl/model.ts';
import { BUNDLED_NAMESPACES } from '../vocabularies/index.ts';

export interface NavNode {
  /** Unique key. For a node that opens a tab it is the target-path ID; group nodes contain `#`. */
  id: string;
  label: string;
  /** Extra text after the label, e.g. the overload count. */
  detail?: string;
  /** What the node stands for; also the tab kind and the URL `<kind>`. Group nodes have none. */
  kind?: ElementKind;
  children: NavNode[];
}

export interface TreeOptions {
  /** Leave out the schemas that are bundled OASIS vocabularies. */
  hideVocabularies: boolean;
}

const byLabel = (a: NavNode, b: NavNode) => a.label.localeCompare(b.label);

function group(parent: string, key: string, label: string, children: NavNode[]): NavNode[] {
  return children.length === 0
    ? []
    : [{ id: `${parent}#${key}`, label, children: children.sort(byLabel) }];
}

function leaf(e: { id: string; name: string; kind: ElementKind }): NavNode {
  return { id: e.id, label: e.name, kind: e.kind, children: [] };
}

/** One node per action or function name, however many overloads it has. */
function operationNodes(operations: Operation[]): NavNode[] {
  const groups = new Map<string, Operation[]>();
  for (const op of operations) {
    const id = overloadGroupId(op.id);
    groups.set(id, [...(groups.get(id) ?? []), op]);
  }
  return [...groups].map(([id, overloads]) => ({
    id,
    label: overloads[0]?.name ?? id,
    ...(overloads.length > 1 && { detail: `${overloads.length} overloads` }),
    kind: overloads[0]?.kind,
    children: [],
  }));
}

function schemaNode(schema: Schema): NavNode {
  const id = schema.id;
  const children = [
    ...group(id, 'entityTypes', 'Entity Types', schema.entityTypes.map(leaf)),
    ...group(id, 'complexTypes', 'Complex Types', schema.complexTypes.map(leaf)),
    ...group(id, 'enumTypes', 'Enum Types', schema.enumTypes.map(leaf)),
    ...group(id, 'typeDefinitions', 'Type Definitions', schema.typeDefinitions.map(leaf)),
    ...group(id, 'terms', 'Terms', schema.terms.map(leaf)),
    ...group(id, 'actions', 'Actions', operationNodes(schema.actions)),
    ...group(id, 'functions', 'Functions', operationNodes(schema.functions)),
    ...schema.entityContainers.map((c): NavNode => {
      return {
        ...leaf(c),
        children: [
          ...group(c.id, 'entitySets', 'Entity Sets', c.entitySets.map(leaf)),
          ...group(c.id, 'singletons', 'Singletons', c.singletons.map(leaf)),
          ...group(c.id, 'actionImports', 'Action Imports', c.actionImports.map(leaf)),
          ...group(c.id, 'functionImports', 'Function Imports', c.functionImports.map(leaf)),
        ],
      };
    }),
  ];
  return { id, label: schema.namespace, kind: 'schema', children };
}

export function buildNavigatorTree(model: Model, { hideVocabularies }: TreeOptions): NavNode[] {
  return model.schemas
    .filter((s) => !(hideVocabularies && BUNDLED_NAMESPACES.includes(s.namespace)))
    .map(schemaNode);
}

/**
 * The part of the tree that matches `query`, ignoring case: a node that matches keeps its whole
 * subtree, any other node stays only for the matching descendants it leads to.
 */
export function filterTree(nodes: NavNode[], query: string): NavNode[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return nodes;
  const walk = (list: NavNode[]): NavNode[] =>
    list.flatMap((node) => {
      if (`${node.label} ${node.detail ?? ''}`.toLowerCase().includes(needle)) return [node];
      const children = walk(node.children);
      return children.length > 0 ? [{ ...node, children }] : [];
    });
  return walk(nodes);
}
