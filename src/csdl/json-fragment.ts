// Source fragments for CSDL JSON. `JSON.parse` has no positions, so instead of slicing the original
// text (as the XML spans allow) the source panel shows the element's JSON subtree, re-serialized. The
// content is exact; the formatting (indentation, line breaks) may differ from the file.
import { isObject, type JsonObject } from './json-attrs.ts';
import type {
  Element,
  EntityContainer,
  Model,
  Operation,
  Schema,
  StructuredType,
} from './model.ts';

/** The JSON subtree of every element of a model, by element. */
export type JsonSourceIndex = ReadonlyMap<Element, unknown>;

/**
 * Finds each element's subtree in `root`, the value `JSON.parse` returned for the text `parseJson` read
 * the model from. One pass over the model; an element the document does not contain has no entry.
 */
export function indexJsonSource(model: Model, root: unknown): JsonSourceIndex {
  const index = new Map<Element, unknown>();
  if (!isObject(root)) return index;
  for (const schema of model.schemas) {
    const obj = root[schema.namespace];
    if (!isObject(obj)) continue;
    index.set(schema, obj);
    indexSchema(index, schema, obj);
  }
  return index;
}

/** The fragment as indented JSON, or undefined for an element that is not in the index. */
export function jsonFragment(index: JsonSourceIndex, element: Element): string | undefined {
  return index.has(element) ? JSON.stringify(index.get(element), null, 2) : undefined;
}

function indexSchema(index: Map<Element, unknown>, schema: Schema, obj: JsonObject): void {
  for (const type of [...schema.entityTypes, ...schema.complexTypes]) {
    const typeObj = obj[type.name];
    if (!isObject(typeObj)) continue;
    index.set(type, typeObj);
    indexStructuredType(index, type, typeObj);
  }
  for (const type of schema.enumTypes) {
    const enumObj = obj[type.name];
    if (!isObject(enumObj)) continue;
    index.set(type, enumObj);
    // A member is a bare value, so its fragment gathers the value and its annotations.
    for (const member of type.members) {
      const prefix = `${member.name}@`;
      const fragment: JsonObject = {};
      for (const key of Object.keys(enumObj)) {
        if (key === member.name || key.startsWith(prefix)) fragment[key] = enumObj[key];
      }
      index.set(member, fragment);
    }
  }
  for (const element of [...schema.typeDefinitions, ...schema.terms]) {
    const found = obj[element.name];
    if (isObject(found)) index.set(element, found);
  }
  indexOperations(index, schema, obj);
  for (const container of schema.entityContainers) {
    const containerObj = obj[container.name];
    if (!isObject(containerObj)) continue;
    index.set(container, containerObj);
    indexContainer(index, container, containerObj);
  }
}

function indexStructuredType(
  index: Map<Element, unknown>,
  type: StructuredType,
  obj: JsonObject,
): void {
  for (const member of [...type.properties, ...type.navigationProperties]) {
    const found = obj[member.name];
    if (isObject(found)) index.set(member, found);
  }
}

/** Overloads share one array under their name; an overload is the n-th entry of its own kind. */
function indexOperations(index: Map<Element, unknown>, schema: Schema, obj: JsonObject): void {
  const seen = new Map<string, number>();
  const operations: Operation[] = [...schema.actions, ...schema.functions];
  for (const op of operations) {
    const overloads = obj[op.name];
    if (!Array.isArray(overloads)) continue;
    const kind = op.kind === 'action' ? 'Action' : 'Function';
    const key = `${kind}:${op.name}`;
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    const found = (overloads as unknown[]).filter(
      (o): o is JsonObject => isObject(o) && o.$Kind === kind,
    )[n];
    if (!found) continue;
    index.set(op, found);
    const parameters = (
      Array.isArray(found.$Parameter) ? (found.$Parameter as unknown[]) : []
    ).filter(isObject);
    op.parameters.forEach((p, i) => {
      const parameter = parameters[i];
      if (parameter) index.set(p, parameter);
    });
    if (op.returnType && isObject(found.$ReturnType)) index.set(op.returnType, found.$ReturnType);
  }
}

function indexContainer(
  index: Map<Element, unknown>,
  container: EntityContainer,
  obj: JsonObject,
): void {
  const members = [
    ...container.entitySets,
    ...container.singletons,
    ...container.actionImports,
    ...container.functionImports,
  ];
  for (const member of members) {
    const found = obj[member.name];
    if (isObject(found)) index.set(member, found);
  }
}
