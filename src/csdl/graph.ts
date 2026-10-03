// The relationship graph around one structured type: the types it links to or inherits from within a
// few hops, as plain nodes and edges. Pure TypeScript, so layout and rendering stay separate concerns.
import { shortName } from './humanize.ts';
import type { NavigationProperty, StructuredType, TypeRef } from './model.ts';
import type { Resolved } from './resolve.ts';

/** Above this many types the diagram is not drawn. */
export const MAX_NODES = 150;

export type Cardinality = '1' | '0..1' | '*';

export interface GraphMember {
  name: string;
  /** The type as a reader sees it: `Collection(Trip)`, `String`. */
  type: string;
}

export interface GraphNode {
  /** Target-path ID of the type. */
  id: string;
  name: string;
  kind: StructuredType['kind'];
  abstract: boolean;
  /** Names of the key properties, inherited ones included. */
  key: string[];
  /** Own and inherited properties, the key first. */
  properties: GraphMember[];
  /** Own and inherited navigation properties. */
  navigations: GraphMember[];
}

export interface GraphEdge {
  id: string;
  /** `inheritance` runs from the derived type to its base type. */
  kind: 'navigation' | 'containment' | 'inheritance';
  source: string;
  target: string;
  /** The navigation property, and its partner on the other side when the pair is merged. */
  label?: string;
  partnerLabel?: string;
  /** How many targets one source has, and how many sources one target has (known with a partner). */
  targetCardinality?: Cardinality;
  sourceCardinality?: Cardinality;
}

export interface GraphOptions {
  /** 1 to 3. */
  hops: number;
  inheritance: boolean;
  maxNodes?: number;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** The number of types within the hops, before the cap. */
  total: number;
  /** Set instead of nodes and edges when `total` exceeds the cap: how to narrow the diagram. */
  hint?: string;
}

const EMPTY: Graph = { nodes: [], edges: [], total: 0 };

const cardinalityOf = (nav: NavigationProperty): Cardinality =>
  nav.type.isCollection ? '*' : nav.nullable ? '0..1' : '1';

const typeText = (type: TypeRef) =>
  type.isCollection ? `Collection(${shortName(type.name)})` : shortName(type.name);

/** Every navigation link of the model, a partner pair merged into one. */
function linksOf({ elements, partners, types }: Resolved): GraphEdge[] {
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const typeId of types.keys()) {
    const type = elements.get(typeId);
    if (type?.kind !== 'entityType' && type?.kind !== 'complexType') continue;
    for (const nav of type.navigationProperties) {
      if (seen.has(nav.id) || !types.has(nav.type.name)) continue;
      seen.add(nav.id);
      const partnerId = partners.get(nav.id);
      const partner = partnerId === undefined ? undefined : elements.get(partnerId);
      const pair = partner?.kind === 'navigationProperty' && partner !== nav ? partner : undefined;
      if (pair) seen.add(pair.id);
      const edge: GraphEdge = {
        id: pair && pair.id < nav.id ? pair.id : nav.id,
        kind: nav.containsTarget || pair?.containsTarget ? 'containment' : 'navigation',
        source: typeId,
        target: nav.type.name,
        label: nav.name,
        targetCardinality: cardinalityOf(nav),
      };
      if (pair) {
        edge.partnerLabel = pair.name;
        edge.sourceCardinality = cardinalityOf(pair);
      }
      edges.push(edge);
    }
  }
  return edges;
}

function nodeOf(resolved: Resolved, id: string): GraphNode | undefined {
  const type = resolved.elements.get(id);
  const info = resolved.types.get(id);
  if ((type?.kind !== 'entityType' && type?.kind !== 'complexType') || !info) return undefined;
  const key = info.key.map((k) => k.name);
  const members = (ids: string[], kind: 'property' | 'navigationProperty') =>
    ids.flatMap((memberId) => {
      const e = resolved.elements.get(memberId);
      return e?.kind === kind ? [{ name: e.name, type: typeText(e.type) }] : [];
    });
  const properties = members(info.propertyIds, 'property');
  return {
    id,
    name: type.name,
    kind: type.kind,
    abstract: type.abstract,
    key,
    properties: [
      ...properties.filter((p) => key.includes(p.name)),
      ...properties.filter((p) => !key.includes(p.name)),
    ],
    navigations: members(info.navigationPropertyIds, 'navigationProperty'),
  };
}

/** The types within `hops` links of `centerId` and the edges between them. */
export function buildGraph(resolved: Resolved, centerId: string, options: GraphOptions): Graph {
  const { hops, inheritance, maxNodes = MAX_NODES } = options;
  if (!resolved.types.has(centerId)) return EMPTY;

  const edges = linksOf(resolved);
  if (inheritance) {
    for (const [id, info] of resolved.types) {
      const base = info.baseChain[0];
      if (base) {
        edges.push({ id: `${id}:base`, kind: 'inheritance', source: id, target: base });
      }
    }
  }
  const adjacent = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    let set = adjacent.get(a);
    if (!set) adjacent.set(a, (set = new Set()));
    set.add(b);
  };
  for (const e of edges) {
    link(e.source, e.target);
    link(e.target, e.source);
  }

  // Breadth first, so `distance` is the number of hops from the center.
  const distance = new Map([[centerId, 0]]);
  for (let frontier = [centerId], hop = 1; hop <= hops && frontier.length > 0; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const neighbour of adjacent.get(id) ?? []) {
        if (distance.has(neighbour)) continue;
        distance.set(neighbour, hop);
        next.push(neighbour);
      }
    }
    frontier = next;
  }

  const total = distance.size;
  if (total > maxNodes) {
    const within = (h: number) => [...distance.values()].filter((d) => d <= h).length;
    let fits = hops - 1;
    while (fits > 0 && within(fits) > maxNodes) fits--;
    const advice =
      fits > 0
        ? `Show ${fits} hop${fits === 1 ? '' : 's'} instead.`
        : inheritance
          ? 'Turn off inheritance, or open the diagram of a type with fewer links.'
          : 'Open the diagram of a type with fewer links.';
    return {
      nodes: [],
      edges: [],
      total,
      hint: `${total} types are within ${hops} hop${hops === 1 ? '' : 's'}, more than the ${maxNodes} that can be drawn. ${advice}`,
    };
  }

  const nodes = [...distance.keys()].flatMap((id) => nodeOf(resolved, id) ?? []);
  const included = new Set(nodes.map((n) => n.id));
  return {
    nodes,
    edges: edges.filter((e) => included.has(e.source) && included.has(e.target)),
    total,
  };
}
