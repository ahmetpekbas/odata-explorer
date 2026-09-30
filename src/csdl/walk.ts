// Visits every model element that has an ID, parents before children.
import type { Element, Model, Schema } from './model.ts';

export function* schemaElements(schema: Schema): Generator<Element> {
  yield schema;
  for (const type of [...schema.entityTypes, ...schema.complexTypes]) {
    yield type;
    yield* type.properties;
    yield* type.navigationProperties;
  }
  for (const type of schema.enumTypes) {
    yield type;
    yield* type.members;
  }
  yield* schema.typeDefinitions;
  yield* schema.terms;
  for (const op of [...schema.actions, ...schema.functions]) {
    yield op;
    yield* op.parameters;
    if (op.returnType) yield op.returnType;
  }
  for (const container of schema.entityContainers) {
    yield container;
    yield* container.entitySets;
    yield* container.singletons;
    yield* container.actionImports;
    yield* container.functionImports;
  }
}

export function* allElements(model: Model): Generator<Element> {
  for (const schema of model.schemas) yield* schemaElements(schema);
}
