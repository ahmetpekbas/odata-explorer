// CSDL JSON -> normalized model, the same model parse-xml.ts produces. The two formats differ in their
// defaults (`$Nullable` is false here, `Nullable` is true in XML), so every default is applied here.
// Type references are kept as written; resolve.ts qualifies them.
import { childId, operationId, parameterId, qualify, returnTypeId, typeRef } from './ids.ts';
import {
  bool,
  childNames,
  facets,
  isObject,
  type JsonObject,
  scalar,
  str,
  typeOf,
} from './json-attrs.ts';
import type {
  ActionImport,
  EntityContainer,
  EnumMember,
  EnumType,
  FunctionImport,
  Include,
  IncludeAnnotations,
  KeyProperty,
  Model,
  NavigationProperty,
  NavigationPropertyBinding,
  OnDeleteAction,
  Operation,
  Parameter,
  Property,
  Reference,
  ReturnType,
  Schema,
  StructuredType,
  Term,
  TypeDefinition,
} from './model.ts';
import { annotationsOf, type JsonCtx, parseAnnotationBlocks } from './parse-json-annotations.ts';
import { lineStarts, positionAt } from './diagnostics.ts';

export function parseJson(text: string): Model {
  const ctx: JsonCtx = { diagnostics: [] };
  const model: Model = {
    format: 'json',
    version: '',
    references: [],
    schemas: [],
    diagnostics: ctx.diagnostics,
  };

  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch (e) {
    ctx.diagnostics.push(syntaxError(e, text));
    return model;
  }
  if (!isObject(root) || typeof root.$Version !== 'string') {
    ctx.diagnostics.push({
      severity: 'error',
      code: 'not-csdl-json',
      message: 'A CSDL JSON document is an object with a $Version member.',
    });
    return model;
  }

  model.version = root.$Version;
  if (isObject(root.$Reference)) {
    for (const [uri, reference] of Object.entries(root.$Reference)) {
      model.references.push(parseReference(uri, reference));
    }
  }
  for (const namespace of childNames(root)) {
    const schema = root[namespace];
    if (isObject(schema)) model.schemas.push(parseSchema(ctx, namespace, schema));
    else report(ctx, 'unknown-member', `${namespace} is not a schema object.`, 'warning');
  }
  return model;
}

function report(
  ctx: JsonCtx,
  code: string,
  message: string,
  severity: 'error' | 'warning' = 'error',
  target?: string,
): void {
  ctx.diagnostics.push(target ? { severity, code, message, target } : { severity, code, message });
}

/** V8 words its position as `(line 3 column 9)` or `at position 42`, depending on the version. */
function syntaxError(error: unknown, text: string): Model['diagnostics'][number] {
  const message = error instanceof Error ? error.message : String(error);
  const d: Model['diagnostics'][number] = { severity: 'error', code: 'json-syntax', message };
  const lineColumn = /line (\d+) column (\d+)/.exec(message);
  const offset = /position (\d+)/.exec(message);
  if (lineColumn) {
    d.line = Number(lineColumn[1]);
    d.column = Number(lineColumn[2]);
  } else if (offset) {
    Object.assign(d, positionAt(lineStarts(text), Number(offset[1])));
  }
  return d;
}

/** A required `$Keyword`; a missing one is reported and read as an empty string. */
function required(ctx: JsonCtx, obj: JsonObject, key: string, target: string): string {
  const value = str(obj, key);
  if (value === undefined || value === '') {
    report(
      ctx,
      'missing-attribute',
      `${target} is missing the required member ${key}.`,
      'error',
      target,
    );
  }
  return value ?? '';
}

// ---------------------------------------------------------------------------------------------
// References

function parseReference(uri: string, value: unknown): Reference {
  const reference: Reference = { uri, includes: [], includeAnnotations: [] };
  if (!isObject(value)) return reference;
  for (const item of Array.isArray(value.$Include) ? (value.$Include as unknown[]) : []) {
    if (!isObject(item)) continue;
    const include: Include = { namespace: str(item, '$Namespace') ?? '' };
    const alias = str(item, '$Alias');
    if (alias) include.alias = alias;
    reference.includes.push(include);
  }
  const annotations = Array.isArray(value.$IncludeAnnotations)
    ? (value.$IncludeAnnotations as unknown[])
    : [];
  for (const item of annotations) {
    if (!isObject(item)) continue;
    const inc: IncludeAnnotations = { termNamespace: str(item, '$TermNamespace') ?? '' };
    const qualifier = str(item, '$Qualifier');
    if (qualifier) inc.qualifier = qualifier;
    const targetNamespace = str(item, '$TargetNamespace');
    if (targetNamespace) inc.targetNamespace = targetNamespace;
    reference.includeAnnotations.push(inc);
  }
  return reference;
}

// ---------------------------------------------------------------------------------------------
// Schema

function parseSchema(ctx: JsonCtx, namespace: string, obj: JsonObject): Schema {
  const schema: Schema = {
    kind: 'schema',
    id: namespace,
    name: namespace,
    namespace,
    annotations: annotationsOf(ctx, obj),
    entityTypes: [],
    complexTypes: [],
    enumTypes: [],
    typeDefinitions: [],
    terms: [],
    actions: [],
    functions: [],
    entityContainers: [],
    annotationBlocks: parseAnnotationBlocks(ctx, obj.$Annotations),
  };
  const alias = str(obj, '$Alias');
  if (alias) schema.alias = alias;

  for (const name of childNames(obj)) {
    const member = obj[name];
    if (Array.isArray(member)) {
      for (const overload of member as unknown[]) {
        if (!isObject(overload)) continue;
        const kind = overload.$Kind === 'Action' ? 'action' : 'function';
        (kind === 'action' ? schema.actions : schema.functions).push(
          parseOperation(ctx, namespace, name, overload, kind),
        );
      }
      continue;
    }
    if (!isObject(member)) continue;
    switch (member.$Kind) {
      case 'EntityType':
        schema.entityTypes.push(parseStructuredType(ctx, namespace, name, member, 'entityType'));
        break;
      case 'ComplexType':
        schema.complexTypes.push(parseStructuredType(ctx, namespace, name, member, 'complexType'));
        break;
      case 'EnumType':
        schema.enumTypes.push(parseEnumType(ctx, namespace, name, member));
        break;
      case 'TypeDefinition':
        schema.typeDefinitions.push(parseTypeDefinition(ctx, namespace, name, member));
        break;
      case 'Term':
        schema.terms.push(parseTerm(ctx, namespace, name, member));
        break;
      case 'EntityContainer':
        schema.entityContainers.push(parseEntityContainer(ctx, namespace, name, member));
        break;
      default:
        report(
          ctx,
          'unknown-kind',
          `${qualify(namespace, name)} has the unknown $Kind ${scalar(member.$Kind) || '(none)'}.`,
          'warning',
          qualify(namespace, name),
        );
    }
  }
  return schema;
}

function parseStructuredType(
  ctx: JsonCtx,
  namespace: string,
  name: string,
  obj: JsonObject,
  kind: StructuredType['kind'],
): StructuredType {
  const id = qualify(namespace, name);
  const type: StructuredType = {
    kind,
    id,
    name,
    annotations: annotationsOf(ctx, obj),
    abstract: bool(obj, '$Abstract', false),
    openType: bool(obj, '$OpenType', false),
    hasStream: bool(obj, '$HasStream', false),
    key: parseKey(obj.$Key),
    properties: [],
    navigationProperties: [],
  };
  const baseType = str(obj, '$BaseType');
  if (baseType) type.baseType = typeRef(baseType);

  for (const memberName of childNames(obj)) {
    const member = obj[memberName];
    if (!isObject(member)) continue;
    if (member.$Kind === 'NavigationProperty') {
      type.navigationProperties.push(parseNavigationProperty(ctx, id, memberName, member));
    } else if (member.$Kind === undefined || member.$Kind === 'Property') {
      type.properties.push(parseProperty(ctx, id, memberName, member));
    } else {
      report(
        ctx,
        'unknown-kind',
        `${childId(id, memberName)} has the unknown $Kind ${scalar(member.$Kind)}.`,
        'warning',
        id,
      );
    }
  }
  return type;
}

/** `["ID", { "Alias": "Address/City" }]` */
function parseKey(value: unknown): KeyProperty[] {
  const key: KeyProperty[] = [];
  for (const item of Array.isArray(value) ? (value as unknown[]) : []) {
    if (typeof item === 'string') key.push({ name: item });
    else if (isObject(item)) {
      for (const [alias, path] of Object.entries(item)) key.push({ name: scalar(path), alias });
    }
  }
  return key;
}

function parseProperty(ctx: JsonCtx, parentId: string, name: string, obj: JsonObject): Property {
  return {
    kind: 'property',
    id: childId(parentId, name),
    name,
    annotations: annotationsOf(ctx, obj),
    type: typeOf(obj),
    nullable: bool(obj, '$Nullable', false),
    facets: facets(obj),
  };
}

function parseNavigationProperty(
  ctx: JsonCtx,
  parentId: string,
  name: string,
  obj: JsonObject,
): NavigationProperty {
  const id = childId(parentId, name);
  if (obj.$Type === undefined) required(ctx, obj, '$Type', id);
  const nav: NavigationProperty = {
    kind: 'navigationProperty',
    id,
    name,
    annotations: annotationsOf(ctx, obj),
    type: typeOf(obj),
    nullable: bool(obj, '$Nullable', false),
    containsTarget: bool(obj, '$ContainsTarget', false),
    referentialConstraints: [],
  };
  const partner = str(obj, '$Partner');
  if (partner) nav.partner = partner;
  const onDelete = str(obj, '$OnDelete');
  if (onDelete) nav.onDelete = onDelete as OnDeleteAction;
  if (isObject(obj.$ReferentialConstraint)) {
    for (const [property, referenced] of Object.entries(obj.$ReferentialConstraint)) {
      if (property.includes('@')) continue;
      nav.referentialConstraints.push({ property, referencedProperty: scalar(referenced) });
    }
  }
  return nav;
}

function parseEnumType(ctx: JsonCtx, namespace: string, name: string, obj: JsonObject): EnumType {
  const id = qualify(namespace, name);
  const members: EnumMember[] = childNames(obj).map((memberName) => ({
    kind: 'enumMember',
    id: childId(id, memberName),
    name: memberName,
    annotations: annotationsOf(ctx, obj, memberName),
    value: scalar(obj[memberName]),
  }));
  return {
    kind: 'enumType',
    id,
    name,
    annotations: annotationsOf(ctx, obj),
    isFlags: bool(obj, '$IsFlags', false),
    underlyingType: str(obj, '$UnderlyingType') ?? 'Edm.Int32',
    members,
  };
}

function parseTypeDefinition(
  ctx: JsonCtx,
  namespace: string,
  name: string,
  obj: JsonObject,
): TypeDefinition {
  const id = qualify(namespace, name);
  return {
    kind: 'typeDefinition',
    id,
    name,
    annotations: annotationsOf(ctx, obj),
    underlyingType: required(ctx, obj, '$UnderlyingType', id),
    facets: facets(obj),
  };
}

function parseTerm(ctx: JsonCtx, namespace: string, name: string, obj: JsonObject): Term {
  const id = qualify(namespace, name);
  const term: Term = {
    kind: 'term',
    id,
    name,
    annotations: annotationsOf(ctx, obj),
    type: typeOf(obj),
    nullable: bool(obj, '$Nullable', false),
    facets: facets(obj),
    appliesTo: Array.isArray(obj.$AppliesTo) ? (obj.$AppliesTo as unknown[]).map(scalar) : [],
  };
  const baseTerm = str(obj, '$BaseTerm');
  if (baseTerm) term.baseTerm = baseTerm;
  return term;
}

// ---------------------------------------------------------------------------------------------
// Actions and functions

function parseOperation(
  ctx: JsonCtx,
  namespace: string,
  name: string,
  obj: JsonObject,
  kind: Operation['kind'],
): Operation {
  const isBound = bool(obj, '$IsBound', false);
  const qualified = qualify(namespace, name);
  // As in the XML parser: the ID depends on parameter types that the resolver has yet to qualify.
  const parameters = (Array.isArray(obj.$Parameter) ? (obj.$Parameter as unknown[]) : [])
    .filter(isObject)
    .map((p) => parseParameter(ctx, qualified, p));
  const id = operationId(
    kind,
    qualified,
    isBound,
    parameters.map((p) => p.type),
  );
  for (const p of parameters) p.id = parameterId(id, p.name);

  const op: Operation = {
    kind,
    id,
    name,
    annotations: annotationsOf(ctx, obj),
    isBound,
    isComposable: bool(obj, '$IsComposable', false),
    parameters,
  };
  const entitySetPath = str(obj, '$EntitySetPath');
  if (entitySetPath) op.entitySetPath = entitySetPath;
  if (isObject(obj.$ReturnType)) op.returnType = parseReturnType(ctx, id, obj.$ReturnType);
  return op;
}

function parseParameter(ctx: JsonCtx, operationId: string, obj: JsonObject): Parameter {
  const name = required(ctx, obj, '$Name', operationId);
  return {
    kind: 'parameter',
    id: parameterId(operationId, name),
    name,
    annotations: annotationsOf(ctx, obj),
    type: typeOf(obj),
    nullable: bool(obj, '$Nullable', false),
    facets: facets(obj),
  };
}

function parseReturnType(ctx: JsonCtx, operationId: string, obj: JsonObject): ReturnType {
  return {
    kind: 'returnType',
    id: returnTypeId(operationId),
    name: '$ReturnType',
    annotations: annotationsOf(ctx, obj),
    type: typeOf(obj),
    nullable: bool(obj, '$Nullable', false),
    facets: facets(obj),
  };
}

// ---------------------------------------------------------------------------------------------
// Entity container

function parseEntityContainer(
  ctx: JsonCtx,
  namespace: string,
  name: string,
  obj: JsonObject,
): EntityContainer {
  const id = qualify(namespace, name);
  const container: EntityContainer = {
    kind: 'entityContainer',
    id,
    name,
    annotations: annotationsOf(ctx, obj),
    entitySets: [],
    singletons: [],
    actionImports: [],
    functionImports: [],
  };
  const extendsName = str(obj, '$Extends');
  if (extendsName) container.extends = extendsName;

  for (const childName of childNames(obj)) {
    const child = obj[childName];
    if (!isObject(child)) continue;
    const base = {
      id: childId(id, childName),
      name: childName,
      annotations: annotationsOf(ctx, child),
    };
    if (child.$Action !== undefined) {
      const imp: ActionImport = {
        ...base,
        kind: 'actionImport',
        action: required(ctx, child, '$Action', base.id),
      };
      const entitySet = str(child, '$EntitySet');
      if (entitySet) imp.entitySet = entitySet;
      container.actionImports.push(imp);
    } else if (child.$Function !== undefined) {
      const imp: FunctionImport = {
        ...base,
        kind: 'functionImport',
        function: required(ctx, child, '$Function', base.id),
        includeInServiceDocument: bool(child, '$IncludeInServiceDocument', false),
      };
      const entitySet = str(child, '$EntitySet');
      if (entitySet) imp.entitySet = entitySet;
      container.functionImports.push(imp);
    } else if (bool(child, '$Collection', false)) {
      container.entitySets.push({
        ...base,
        kind: 'entitySet',
        entityType: typeRef(required(ctx, child, '$Type', base.id)),
        includeInServiceDocument: bool(child, '$IncludeInServiceDocument', true),
        bindings: parseBindings(child),
      });
    } else {
      container.singletons.push({
        ...base,
        kind: 'singleton',
        type: typeRef(required(ctx, child, '$Type', base.id)),
        bindings: parseBindings(child),
      });
    }
  }
  return container;
}

function parseBindings(obj: JsonObject): NavigationPropertyBinding[] {
  if (!isObject(obj.$NavigationPropertyBinding)) return [];
  return Object.entries(obj.$NavigationPropertyBinding).map(([path, target]) => ({
    path,
    target: scalar(target),
  }));
}
