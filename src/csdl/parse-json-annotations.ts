// CSDL JSON annotations and annotation expressions. An annotation is a `@Term#Qualifier` member of the
// annotated object, or `Name@Term#Qualifier` when the target has no object of its own (an enum member,
// a record property); `Name@Term1@Term2` annotates the annotation `Name@Term1`.
import { CONSTANTS, OPERATORS, PATHS } from './expression-names.ts';
import { typeRef } from './ids.ts';
import { facets, isObject, type JsonObject, scalar, str } from './json-attrs.ts';
import type {
  Annotation,
  AnnotationBlock,
  Diagnostic,
  Expression,
  OperatorName,
  PathType,
  PropertyValue,
} from './model.ts';

/** Collects diagnostics while converting a JSON document to a model. */
export interface JsonCtx {
  diagnostics: Diagnostic[];
}

/**
 * The annotations of `prefix` (the name of the annotated member, empty for the object itself) found
 * among the members of `obj`.
 */
export function annotationsOf(
  ctx: JsonCtx,
  obj: JsonObject,
  prefix = '',
  origin: Annotation['origin'] = 'inline',
): Annotation[] {
  const annotations: Annotation[] = [];
  for (const key of Object.keys(obj)) {
    if (!key.startsWith(`${prefix}@`)) continue;
    const name = key.slice(prefix.length + 1);
    // `@type` and the like are not terms; a nested annotation is found through its parent.
    if (!name.includes('.') || name.includes('@') || name === 'odata.type') continue;
    const [term = '', qualifier] = name.split('#');
    const annotation: Annotation = {
      term,
      value: expression(ctx, obj[key]),
      annotations: annotationsOf(ctx, obj, key, origin),
      origin,
    };
    if (qualifier) annotation.qualifier = qualifier;
    annotations.push(annotation);
  }
  return annotations;
}

/** `"$Annotations": { "Target": { "@Term": value } }` */
export function parseAnnotationBlocks(ctx: JsonCtx, value: unknown): AnnotationBlock[] {
  if (!isObject(value)) return [];
  return Object.entries(value).map(([target, annotated]) => ({
    target,
    annotations: isObject(annotated) ? annotationsOf(ctx, annotated, '', 'external') : [],
  }));
}

const NULL: Expression = { kind: 'null', annotations: [] };

function expression(ctx: JsonCtx, value: unknown): Expression {
  switch (typeof value) {
    case 'string':
      return { kind: 'constant', type: 'string', value };
    case 'boolean':
      return { kind: 'constant', type: 'bool', value: String(value) };
    case 'number':
      return {
        kind: 'constant',
        type: Number.isInteger(value) ? 'int' : 'decimal',
        value: String(value),
      };
  }
  if (Array.isArray(value)) {
    return { kind: 'collection', items: value.map((item) => expression(ctx, item)) };
  }
  return isObject(value) ? objectExpression(ctx, value) : NULL;
}

function list(ctx: JsonCtx, value: unknown): Expression[] {
  return Array.isArray(value)
    ? value.map((item) => expression(ctx, item))
    : [expression(ctx, value)];
}

/** An object is an expression form when it has its `$Keyword`, and a record otherwise. */
function objectExpression(ctx: JsonCtx, obj: JsonObject): Expression {
  for (const key of Object.keys(obj)) {
    if (!key.startsWith('$')) continue;
    const name = key.slice(1);
    const value = obj[key];

    const constant = CONSTANTS[name];
    if (constant) return { kind: 'constant', type: constant, value: scalar(value) };
    if (PATHS.has(name)) return { kind: 'path', type: name as PathType, value: scalar(value) };
    if (OPERATORS.has(name)) {
      return { kind: 'operator', operator: name as OperatorName, args: list(ctx, value) };
    }

    switch (name) {
      case 'Null':
        return { kind: 'null', annotations: annotationsOf(ctx, obj) };
      case 'Apply':
        return {
          kind: 'apply',
          function: str(obj, '$Function') ?? '',
          args: list(ctx, value),
          annotations: annotationsOf(ctx, obj),
        };
      case 'If': {
        const [test, then, otherwise] = list(ctx, value);
        return { kind: 'if', test: test ?? NULL, then: then ?? NULL, else: otherwise ?? NULL };
      }
      case 'Cast':
      case 'IsOf':
        return {
          kind: name === 'Cast' ? 'cast' : 'isOf',
          type: typeRef(str(obj, '$Type') ?? 'Edm.String'),
          facets: facets(obj),
          value: expression(ctx, value),
        };
      case 'LabeledElement':
        return {
          kind: 'labeledElement',
          name: str(obj, '$Name') ?? '',
          value: expression(ctx, value),
        };
      case 'LabeledElementReference':
        return { kind: 'labeledElementReference', name: scalar(value) };
      case 'UrlRef':
        return { kind: 'urlRef', value: expression(ctx, value) };
    }
  }
  return record(ctx, obj);
}

function record(ctx: JsonCtx, obj: JsonObject): Expression {
  const properties: PropertyValue[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (key.includes('@')) continue;
    properties.push({
      property: key,
      value: expression(ctx, value),
      annotations: annotationsOf(ctx, obj, key),
    });
  }
  const result: Expression = {
    kind: 'record',
    properties,
    annotations: annotationsOf(ctx, obj),
  };
  const type = str(obj, '@type') ?? str(obj, '@odata.type');
  // The type may be given as `#Name` or as `<reference uri>#Name`.
  if (type) result.type = type.replace(/^[^#]*#/, '');
  return result;
}
