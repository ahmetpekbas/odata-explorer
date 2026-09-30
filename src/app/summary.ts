import type { Resolved } from '../csdl/resolve.ts';

export interface Counts {
  entityTypes: number;
  complexTypes: number;
  enumTypes: number;
  entitySets: number;
  singletons: number;
}

/** What the document defines, totalled over its schemas. */
export function countElements({ model }: Resolved): Counts {
  const counts: Counts = {
    entityTypes: 0,
    complexTypes: 0,
    enumTypes: 0,
    entitySets: 0,
    singletons: 0,
  };
  for (const schema of model.schemas) {
    counts.entityTypes += schema.entityTypes.length;
    counts.complexTypes += schema.complexTypes.length;
    counts.enumTypes += schema.enumTypes.length;
    for (const container of schema.entityContainers) {
      counts.entitySets += container.entitySets.length;
      counts.singletons += container.singletons.length;
    }
  }
  return counts;
}
