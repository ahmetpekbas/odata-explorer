// Moves a load result from the worker to the main thread in small pieces. One structured clone of a
// 20 MB model is a single main-thread task of well over 100 ms; many small messages are many short tasks,
// and the browser can paint and handle input in between. Free of worker APIs so it runs in Vitest.
import type { Element, Model, Schema } from '../csdl/model.ts';
import type { Resolved } from '../csdl/resolve.ts';
import type { Structure } from '../csdl/resolve-structure.ts';
import type { SearchEntry } from '../csdl/search-index.ts';
import { allElements } from '../csdl/walk.ts';

/** The schema members that are sent piece by piece. */
const SCHEMA_LISTS = [
  'entityTypes',
  'complexTypes',
  'enumTypes',
  'typeDefinitions',
  'terms',
  'actions',
  'functions',
  'entityContainers',
  'annotationBlocks',
] as const;
type SchemaList = (typeof SCHEMA_LISTS)[number];

const STRUCTURE_MAPS = ['types', 'partners', 'exposure', 'bindings'] as const;
type StructureMap = (typeof STRUCTURE_MAPS)[number];

/** Roughly how many elements go into one message: a few hundred KB, a few milliseconds to clone. */
const PIECE_WEIGHT = 1500;

export type Piece =
  /** The model without its schemas' contents, so it is small. */
  | { kind: 'head'; model: Model }
  | { kind: 'list'; schema: number; list: SchemaList; items: unknown[] }
  | { kind: 'map'; map: StructureMap; entries: [string, unknown][] }
  | { kind: 'index'; entries: SearchEntry[] };

/** How many elements an item stands for: a type carries its members, a container its sets and imports. */
function weight(item: unknown): number {
  const { properties, navigationProperties, members, parameters, entitySets, singletons } =
    item as Record<string, unknown>;
  const sizeOf = (list: unknown) => (Array.isArray(list) ? list.length : 0);
  return (
    1 +
    sizeOf(properties) +
    sizeOf(navigationProperties) +
    sizeOf(members) +
    sizeOf(parameters) +
    sizeOf(entitySets) +
    sizeOf(singletons)
  );
}

/** Cuts `items` into runs of about PIECE_WEIGHT; a single heavier item travels alone. */
function* chunks<T>(items: readonly T[], weigh: (item: T) => number): Generator<T[]> {
  let run: T[] = [];
  let total = 0;
  for (const item of items) {
    run.push(item);
    total += weigh(item);
    if (total >= PIECE_WEIGHT) {
      yield run;
      run = [];
      total = 0;
    }
  }
  if (run.length > 0) yield run;
}

export function* splitResult(resolved: Resolved, index: SearchEntry[]): Generator<Piece> {
  const { model } = resolved;
  const emptied = (schema: Schema): Schema => {
    const copy = { ...schema };
    for (const list of SCHEMA_LISTS) copy[list] = [];
    return copy;
  };
  yield { kind: 'head', model: { ...model, schemas: model.schemas.map(emptied) } };
  for (const [i, schema] of model.schemas.entries()) {
    for (const list of SCHEMA_LISTS) {
      for (const items of chunks<unknown>(schema[list], weight)) {
        yield { kind: 'list', schema: i, list, items };
      }
    }
  }
  for (const map of STRUCTURE_MAPS) {
    const entries = [...(resolved[map] as Map<string, unknown>)];
    for (const run of chunks(entries, () => 1)) yield { kind: 'map', map, entries: run };
  }
  for (const entries of chunks(index, () => 0.25)) yield { kind: 'index', entries };
}

/**
 * Rebuilds the result from its pieces. `elements` is not sent: it is the model's own elements, so walking
 * the model gives it back, with the same first-wins rule as the resolver for duplicate IDs.
 */
export function assemble(pieces: Iterable<Piece>): { resolved: Resolved; index: SearchEntry[] } {
  let model: Model | undefined;
  const structure: Structure = {
    types: new Map(),
    partners: new Map(),
    exposure: new Map(),
    bindings: new Map(),
  };
  const index: SearchEntry[] = [];
  for (const piece of pieces) {
    switch (piece.kind) {
      case 'head':
        model = piece.model;
        break;
      case 'list':
        (model?.schemas[piece.schema]?.[piece.list] as unknown[] | undefined)?.push(...piece.items);
        break;
      case 'map':
        for (const [key, value] of piece.entries) {
          (structure[piece.map] as Map<string, unknown>).set(key, value);
        }
        break;
      case 'index':
        index.push(...piece.entries);
        break;
    }
  }
  if (!model) throw new Error('The parser sent no model.');
  const elements = new Map<string, Element>();
  for (const element of allElements(model)) {
    if (!elements.has(element.id)) elements.set(element.id, element);
  }
  return { resolved: { model, elements, ...structure }, index };
}
