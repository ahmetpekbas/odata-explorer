// Ranks the search index for a query: exact > prefix > substring > fuzzy (uFuzzy), each tier ordered by
// kind, then by length, then alphabetically. Pure data, so it runs in Vitest and could move to a worker.
import uFuzzy from '@leeoniya/ufuzzy';
import type { SearchEntry, SearchKind } from '../csdl/search-index.ts';

export type MatchTier = 'exact' | 'prefix' | 'substring' | 'fuzzy';

export interface SearchHit {
  entry: SearchEntry;
  tier: MatchTier;
}

/** The index with the work that does not depend on the query done once. */
export interface PreparedIndex {
  entries: SearchEntry[];
  labels: string[];
  lower: string[];
}

export interface SearchOptions {
  /** Only these kinds; all when absent or empty. */
  kinds?: ReadonlySet<SearchKind>;
  limit?: number;
}

export const DEFAULT_LIMIT = 200;

/** Types first, then what the service exposes, then the members of types. */
const KIND_RANK: Record<SearchKind, number> = {
  entityType: 0,
  complexType: 1,
  enumType: 2,
  typeDefinition: 3,
  entitySet: 4,
  singleton: 5,
  function: 6,
  action: 7,
  functionImport: 8,
  actionImport: 9,
  term: 10,
  property: 11,
  navigationProperty: 12,
  enumMember: 13,
  annotation: 14,
};

// One typo per term (intraMode 1) is what makes it fuzzy; the default only matches whole substrings.
export const KIND_LABEL: Record<SearchKind, string> = {
  entityType: 'Entity type',
  complexType: 'Complex type',
  enumType: 'Enum',
  typeDefinition: 'Type definition',
  entitySet: 'Entity set',
  singleton: 'Singleton',
  function: 'Function',
  action: 'Action',
  functionImport: 'Function import',
  actionImport: 'Action import',
  term: 'Term',
  property: 'Property',
  navigationProperty: 'Navigation property',
  enumMember: 'Enum member',
  annotation: 'Label',
};

/** The kind filters the palette offers; each switches on several kinds. */
export const KIND_GROUPS: { label: string; kinds: SearchKind[] }[] = [
  { label: 'Types', kinds: ['entityType', 'complexType', 'enumType', 'typeDefinition'] },
  { label: 'Properties', kinds: ['property', 'navigationProperty'] },
  { label: 'Sets', kinds: ['entitySet', 'singleton'] },
  { label: 'Operations', kinds: ['function', 'action', 'functionImport', 'actionImport'] },
  { label: 'Terms', kinds: ['term'] },
  { label: 'Enum members', kinds: ['enumMember'] },
  { label: 'Labels', kinds: ['annotation'] },
];

const fuzzy = new uFuzzy({ intraMode: 1 });

export function prepareIndex(entries: SearchEntry[]): PreparedIndex {
  const labels = entries.map((e) => e.label);
  return { entries, labels, lower: labels.map((l) => l.toLowerCase()) };
}

const prepared = new WeakMap<SearchEntry[], PreparedIndex>();

/** `prepareIndex`, done once per index: the palette asks again every time it opens. */
export function preparedIndex(entries: SearchEntry[]): PreparedIndex {
  let index = prepared.get(entries);
  if (!index) prepared.set(entries, (index = prepareIndex(entries)));
  return index;
}

export function searchIndex(
  index: PreparedIndex,
  query: string,
  { kinds, limit = DEFAULT_LIMIT }: SearchOptions = {},
): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [];
  const { entries, labels, lower } = index;
  const wanted = (i: number) => !kinds?.size || kinds.has(entries[i]?.kind as SearchKind);

  const tiers: Record<Exclude<MatchTier, 'fuzzy'>, number[]> = {
    exact: [],
    prefix: [],
    substring: [],
  };
  const matched = new Set<number>();
  for (let i = 0; i < lower.length; i++) {
    const text = lower[i] as string;
    const at = text.indexOf(needle);
    if (at < 0 || !wanted(i)) continue;
    matched.add(i);
    (at > 0 ? tiers.substring : text.length === needle.length ? tiers.exact : tiers.prefix).push(i);
  }

  const rank = (a: number, b: number) =>
    KIND_RANK[entries[a]?.kind as SearchKind] - KIND_RANK[entries[b]?.kind as SearchKind] ||
    (labels[a] as string).length - (labels[b] as string).length ||
    // Code-unit order on the lower-cased label: localeCompare is several times slower on a long list.
    ((lower[a] as string) < (lower[b] as string) ? -1 : 1);

  const hits: SearchHit[] = [];
  const add = (tier: MatchTier, idxs: number[]) => {
    for (const i of idxs) {
      if (hits.length >= limit) return;
      hits.push({ entry: entries[i] as SearchEntry, tier });
    }
  };
  add('exact', tiers.exact.sort(rank));
  add('prefix', tiers.prefix.sort(rank));
  add('substring', tiers.substring.sort(rank));

  if (hits.length < limit) {
    // Fuzzy matches are the leftovers, best first as uFuzzy scores them, or by length for a long list.
    const [idxs, info, order] = fuzzy.search(labels, needle);
    const ordered =
      info && order ? order.map((o) => info.idx[o] as number) : [...(idxs ?? [])].sort(rank);
    add(
      'fuzzy',
      ordered.filter((i) => !matched.has(i) && wanted(i)),
    );
  }
  return hits;
}
