import { overloadGroupId } from '../csdl/ids.ts';
import type { Diagnostic, EntityContainer, Model, Schema } from '../csdl/model.ts';
import type { Resolved } from '../csdl/resolve.ts';
import { schemaElements } from '../csdl/walk.ts';
import { BUNDLED_NAMESPACES } from '../vocabularies/index.ts';

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

export interface SchemaCounts {
  entityTypes: number;
  complexTypes: number;
  enumTypes: number;
  typeDefinitions: number;
  terms: number;
  /** Actions and functions count once per name, however many overloads they have. */
  actions: number;
  functions: number;
  overloads: number;
  entitySets: number;
  singletons: number;
  actionImports: number;
  functionImports: number;
}

/** What one schema defines. */
export function countSchema(schema: Schema): SchemaCounts {
  const names = (ops: Schema['actions']) => new Set(ops.map((op) => overloadGroupId(op.id))).size;
  const containers = schema.entityContainers;
  const total = (pick: (c: EntityContainer) => unknown[]) =>
    containers.reduce((n, c) => n + pick(c).length, 0);
  return {
    entityTypes: schema.entityTypes.length,
    complexTypes: schema.complexTypes.length,
    enumTypes: schema.enumTypes.length,
    typeDefinitions: schema.typeDefinitions.length,
    terms: schema.terms.length,
    actions: names(schema.actions),
    functions: names(schema.functions),
    overloads: schema.actions.length + schema.functions.length,
    entitySets: total((c) => c.entitySets),
    singletons: total((c) => c.singletons),
    actionImports: total((c) => c.actionImports),
    functionImports: total((c) => c.functionImports),
  };
}

export interface ReferenceSummary {
  /** Every type reference in the schema: property types, base types, parameter types, and so on. */
  total: number;
  /** The `unresolved-type` problems among them. */
  unresolved: Diagnostic[];
}

/** How many of the schema's type references the model could resolve. */
export function summarizeReferences({ model }: Resolved, schema: Schema): ReferenceSummary {
  const ids = new Set<string>();
  let total = 0;
  for (const e of schemaElements(schema)) {
    ids.add(e.id);
    switch (e.kind) {
      case 'entityType':
      case 'complexType':
        if (e.baseType) total++;
        break;
      case 'property':
      case 'navigationProperty':
      case 'parameter':
      case 'returnType':
      case 'term':
      case 'enumType':
      case 'typeDefinition':
      case 'entitySet':
      case 'singleton':
        total++;
        break;
    }
  }
  const unresolved = model.diagnostics.filter(
    (d) => d.code === 'unresolved-type' && d.target !== undefined && ids.has(d.target),
  );
  return { total, unresolved };
}

export type NamespaceStatus = 'defined' | 'bundled' | 'missing';

export interface ReferencedNamespace {
  namespace: string;
  alias?: string;
  uri: string;
  status: NamespaceStatus;
}

/** The namespaces the document pulls in with `edmx:Reference`, and whether each can be found. */
export function referencedNamespaces({ model }: Resolved): ReferencedNamespace[] {
  const defined = new Set(model.schemas.map((s) => s.namespace));
  return model.references.flatMap((reference) =>
    reference.includes.map((include): ReferencedNamespace => {
      const status: NamespaceStatus = defined.has(include.namespace)
        ? 'defined'
        : BUNDLED_NAMESPACES.includes(include.namespace)
          ? 'bundled'
          : 'missing';
      return {
        namespace: include.namespace,
        ...(include.alias && { alias: include.alias }),
        uri: reference.uri,
        status,
      };
    }),
  );
}

/** The schema a document opens on: the first one that is not a bundled vocabulary. */
export function defaultSchema(model: Model): Schema | undefined {
  return model.schemas.find((s) => !BUNDLED_NAMESPACES.includes(s.namespace)) ?? model.schemas[0];
}
