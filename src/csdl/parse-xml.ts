// CSDL XML -> normalized model. Type references are kept as written; resolve.ts qualifies them.
import { childId, operationId, parameterId, qualify, returnTypeId, typeRef } from './ids.ts';
import type {
  ActionImport,
  Diagnostic,
  EntityContainer,
  EntitySet,
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
  Singleton,
  StructuredType,
  Term,
  TypeDefinition,
} from './model.ts';
import { locateDiagnostics } from './diagnostics.ts';
import { inlineAnnotations, parseAnnotationBlock } from './parse-xml-annotations.ts';
import { bool, type Ctx, facets, nullable } from './xml-attrs.ts';
import { readXml, type XNode } from './xml-tree.ts';

/** EDMX namespaces of OData v1-v3, all under this prefix. */
const LEGACY_EDMX_NS = 'http://schemas.microsoft.com/ado/';

export function parseXml(text: string): Model {
  const ctx: Ctx = { diagnostics: [] };
  const model: Model = {
    format: 'xml',
    version: '',
    references: [],
    schemas: [],
    diagnostics: ctx.diagnostics,
  };
  const tree = readXml(text);

  for (const e of tree.errors) {
    ctx.diagnostics.push({
      severity: 'error',
      code: 'xml-syntax',
      message: e.message,
      line: e.line,
      column: e.column,
    });
  }
  if (tree.hasDoctype) {
    ctx.diagnostics.push({
      severity: 'error',
      code: 'doctype-refused',
      message:
        'The document declares a DOCTYPE, which is not allowed. Entity declarations are never expanded.',
    });
    return model;
  }
  const { root } = tree;
  if (!root) return model;

  model.version = root.attrs.Version ?? '';
  if (root.name !== 'Edmx') {
    ctx.diagnostics.push({
      severity: 'error',
      code: 'not-edmx',
      message: `The root element is <${root.name}>, but an OData $metadata document starts with <edmx:Edmx>.`,
      span: root.span,
    });
    locateDiagnostics(ctx.diagnostics, text);
    return model;
  }
  if (root.uri.startsWith(LEGACY_EDMX_NS) || /^[123]\./.test(model.version)) {
    ctx.diagnostics.push({
      severity: 'error',
      code: 'unsupported-version',
      message: `OData v2/v3 metadata (EDMX ${model.version || 'with a legacy namespace'}) is not supported. Only OData v4 CSDL is.`,
      span: root.span,
    });
    locateDiagnostics(ctx.diagnostics, text);
    return model;
  }

  for (const child of root.children) {
    if (child.name === 'Reference') model.references.push(parseReference(child));
    else if (child.name === 'DataServices') {
      for (const schema of child.children) {
        if (schema.name === 'Schema') model.schemas.push(parseSchema(ctx, schema));
      }
    }
  }
  locateDiagnostics(ctx.diagnostics, text);
  return model;
}

// ---------------------------------------------------------------------------------------------
// Attribute helpers

/** A required attribute; a missing one is reported and read as an empty string. */
function required(ctx: Ctx, node: XNode, attr: string, target?: string): string {
  const value = node.attrs[attr];
  if (value === undefined || value === '') {
    const d: Diagnostic = {
      severity: 'error',
      code: 'missing-attribute',
      message: `<${node.name}> is missing the required attribute ${attr}.`,
      span: node.span,
    };
    if (target) d.target = target;
    ctx.diagnostics.push(d);
  }
  return value ?? '';
}

// ---------------------------------------------------------------------------------------------
// Edmx

function parseReference(node: XNode): Reference {
  const includes: Include[] = [];
  const includeAnnotations: IncludeAnnotations[] = [];
  for (const child of node.children) {
    if (child.name === 'Include') {
      const include: Include = { namespace: child.attrs.Namespace ?? '' };
      if (child.attrs.Alias) include.alias = child.attrs.Alias;
      includes.push(include);
    } else if (child.name === 'IncludeAnnotations') {
      const inc: IncludeAnnotations = { termNamespace: child.attrs.TermNamespace ?? '' };
      if (child.attrs.Qualifier) inc.qualifier = child.attrs.Qualifier;
      if (child.attrs.TargetNamespace) inc.targetNamespace = child.attrs.TargetNamespace;
      includeAnnotations.push(inc);
    }
  }
  return { uri: node.attrs.Uri ?? '', includes, includeAnnotations, span: node.span };
}

// ---------------------------------------------------------------------------------------------
// Schema

function parseSchema(ctx: Ctx, node: XNode): Schema {
  const namespace = required(ctx, node, 'Namespace');
  const schema: Schema = {
    kind: 'schema',
    id: namespace,
    name: namespace,
    namespace,
    annotations: inlineAnnotations(ctx, node),
    span: node.span,
    entityTypes: [],
    complexTypes: [],
    enumTypes: [],
    typeDefinitions: [],
    terms: [],
    actions: [],
    functions: [],
    entityContainers: [],
    annotationBlocks: [],
  };
  if (node.attrs.Alias) schema.alias = node.attrs.Alias;

  for (const child of node.children) {
    switch (child.name) {
      case 'EntityType':
        schema.entityTypes.push(parseStructuredType(ctx, namespace, child, 'entityType'));
        break;
      case 'ComplexType':
        schema.complexTypes.push(parseStructuredType(ctx, namespace, child, 'complexType'));
        break;
      case 'EnumType':
        schema.enumTypes.push(parseEnumType(ctx, namespace, child));
        break;
      case 'TypeDefinition':
        schema.typeDefinitions.push(parseTypeDefinition(ctx, namespace, child));
        break;
      case 'Annotations':
        schema.annotationBlocks.push(parseAnnotationBlock(ctx, child));
        break;
      case 'Term':
        schema.terms.push(parseTerm(ctx, namespace, child));
        break;
      case 'Action':
        schema.actions.push(parseOperation(ctx, namespace, child, 'action'));
        break;
      case 'Function':
        schema.functions.push(parseOperation(ctx, namespace, child, 'function'));
        break;
      case 'EntityContainer':
        schema.entityContainers.push(parseEntityContainer(ctx, namespace, child));
        break;
    }
  }
  return schema;
}

function parseStructuredType(
  ctx: Ctx,
  namespace: string,
  node: XNode,
  kind: StructuredType['kind'],
): StructuredType {
  const name = required(ctx, node, 'Name');
  const id = qualify(namespace, name);
  const type: StructuredType = {
    kind,
    id,
    name,
    annotations: inlineAnnotations(ctx, node),
    span: node.span,
    abstract: bool(node, 'Abstract', false),
    openType: bool(node, 'OpenType', false),
    hasStream: bool(node, 'HasStream', false),
    key: [],
    properties: [],
    navigationProperties: [],
  };
  if (node.attrs.BaseType) type.baseType = typeRef(node.attrs.BaseType);

  for (const child of node.children) {
    if (child.name === 'Key') type.key = parseKey(child);
    else if (child.name === 'Property') type.properties.push(parseProperty(ctx, id, child));
    else if (child.name === 'NavigationProperty') {
      type.navigationProperties.push(parseNavigationProperty(ctx, id, child));
    }
  }
  return type;
}

function parseKey(node: XNode): KeyProperty[] {
  const key: KeyProperty[] = [];
  for (const ref of node.children) {
    if (ref.name !== 'PropertyRef') continue;
    const k: KeyProperty = { name: ref.attrs.Name ?? '' };
    if (ref.attrs.Alias) k.alias = ref.attrs.Alias;
    key.push(k);
  }
  return key;
}

function parseProperty(ctx: Ctx, parentId: string, node: XNode): Property {
  const name = required(ctx, node, 'Name', parentId);
  const type = typeRef(required(ctx, node, 'Type', childId(parentId, name)));
  return {
    kind: 'property',
    id: childId(parentId, name),
    name,
    annotations: inlineAnnotations(ctx, node),
    span: node.span,
    type,
    nullable: nullable(node, type),
    facets: facets(node),
  };
}

function parseNavigationProperty(ctx: Ctx, parentId: string, node: XNode): NavigationProperty {
  const name = required(ctx, node, 'Name', parentId);
  const id = childId(parentId, name);
  const type = typeRef(required(ctx, node, 'Type', id));
  const nav: NavigationProperty = {
    kind: 'navigationProperty',
    id,
    name,
    annotations: inlineAnnotations(ctx, node),
    span: node.span,
    type,
    nullable: nullable(node, type),
    containsTarget: bool(node, 'ContainsTarget', false),
    referentialConstraints: [],
  };
  if (node.attrs.Partner) nav.partner = node.attrs.Partner;
  for (const child of node.children) {
    if (child.name === 'ReferentialConstraint') {
      nav.referentialConstraints.push({
        property: child.attrs.Property ?? '',
        referencedProperty: child.attrs.ReferencedProperty ?? '',
      });
    } else if (child.name === 'OnDelete') {
      nav.onDelete = (child.attrs.Action ?? 'None') as OnDeleteAction;
    }
  }
  return nav;
}

function parseEnumType(ctx: Ctx, namespace: string, node: XNode): EnumType {
  const name = required(ctx, node, 'Name');
  const id = qualify(namespace, name);
  const isFlags = bool(node, 'IsFlags', false);
  const members: EnumMember[] = [];
  // Members without a Value continue from the previous one. (Flags members must state theirs.)
  let next = 0;
  for (const child of node.children) {
    if (child.name !== 'Member') continue;
    const memberName = required(ctx, child, 'Name', id);
    const explicit = child.attrs.Value;
    const value = explicit ?? String(next);
    if (!isFlags && Number.isInteger(Number(value))) next = Number(value) + 1;
    members.push({
      kind: 'enumMember',
      id: childId(id, memberName),
      name: memberName,
      annotations: inlineAnnotations(ctx, child),
      span: child.span,
      value,
    });
  }
  return {
    kind: 'enumType',
    id,
    name,
    annotations: inlineAnnotations(ctx, node),
    span: node.span,
    isFlags,
    underlyingType: node.attrs.UnderlyingType ?? 'Edm.Int32',
    members,
  };
}

function parseTypeDefinition(ctx: Ctx, namespace: string, node: XNode): TypeDefinition {
  const name = required(ctx, node, 'Name');
  return {
    kind: 'typeDefinition',
    id: qualify(namespace, name),
    name,
    annotations: inlineAnnotations(ctx, node),
    span: node.span,
    underlyingType: required(ctx, node, 'UnderlyingType', qualify(namespace, name)),
    facets: facets(node),
  };
}

function parseTerm(ctx: Ctx, namespace: string, node: XNode): Term {
  const name = required(ctx, node, 'Name');
  const id = qualify(namespace, name);
  const type = typeRef(required(ctx, node, 'Type', id));
  const term: Term = {
    kind: 'term',
    id,
    name,
    annotations: inlineAnnotations(ctx, node),
    span: node.span,
    type,
    nullable: nullable(node, type),
    facets: facets(node),
    appliesTo: node.attrs.AppliesTo?.split(/\s+/).filter(Boolean) ?? [],
  };
  if (node.attrs.BaseTerm) term.baseTerm = node.attrs.BaseTerm;
  return term;
}

// ---------------------------------------------------------------------------------------------
// Actions and functions

function parseOperation(
  ctx: Ctx,
  namespace: string,
  node: XNode,
  kind: Operation['kind'],
): Operation {
  const name = required(ctx, node, 'Name');
  const isBound = bool(node, 'IsBound', false);
  const qualified = qualify(namespace, name);
  // The overload ID depends on parameter types, which are still unqualified here; the resolver
  // recomputes it (and the IDs below it) once aliases are known.
  const parameters = node.children
    .filter((c) => c.name === 'Parameter')
    .map((c) => parseParameter(ctx, qualified, c));
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
    annotations: inlineAnnotations(ctx, node),
    span: node.span,
    isBound,
    isComposable: bool(node, 'IsComposable', false),
    parameters,
  };
  if (node.attrs.EntitySetPath) op.entitySetPath = node.attrs.EntitySetPath;
  const returnType = node.children.find((c) => c.name === 'ReturnType');
  if (returnType) op.returnType = parseReturnType(ctx, id, returnType);
  return op;
}

function parseParameter(ctx: Ctx, operationId: string, node: XNode): Parameter {
  const name = required(ctx, node, 'Name', operationId);
  const type = typeRef(required(ctx, node, 'Type', operationId));
  return {
    kind: 'parameter',
    id: parameterId(operationId, name),
    name,
    annotations: inlineAnnotations(ctx, node),
    span: node.span,
    type,
    nullable: nullable(node, type),
    facets: facets(node),
  };
}

function parseReturnType(ctx: Ctx, operationId: string, node: XNode): ReturnType {
  const type = typeRef(required(ctx, node, 'Type', operationId));
  return {
    kind: 'returnType',
    id: returnTypeId(operationId),
    name: '$ReturnType',
    annotations: inlineAnnotations(ctx, node),
    span: node.span,
    type,
    nullable: nullable(node, type),
    facets: facets(node),
  };
}

// ---------------------------------------------------------------------------------------------
// Entity container

const CONTAINER_CHILDREN = new Set(['EntitySet', 'Singleton', 'ActionImport', 'FunctionImport']);

function parseEntityContainer(ctx: Ctx, namespace: string, node: XNode): EntityContainer {
  const name = required(ctx, node, 'Name');
  const id = qualify(namespace, name);
  const container: EntityContainer = {
    kind: 'entityContainer',
    id,
    name,
    annotations: inlineAnnotations(ctx, node),
    span: node.span,
    entitySets: [],
    singletons: [],
    actionImports: [],
    functionImports: [],
  };
  if (node.attrs.Extends) container.extends = node.attrs.Extends;

  for (const child of node.children) {
    if (!CONTAINER_CHILDREN.has(child.name)) continue;
    const childName = required(ctx, child, 'Name', id);
    const base = {
      id: childId(id, childName),
      name: childName,
      annotations: inlineAnnotations(ctx, child),
      span: child.span,
    };
    switch (child.name) {
      case 'EntitySet':
        container.entitySets.push({
          ...base,
          kind: 'entitySet',
          entityType: typeRef(required(ctx, child, 'EntityType', base.id)),
          includeInServiceDocument: bool(child, 'IncludeInServiceDocument', true),
          bindings: parseBindings(child),
        } satisfies EntitySet);
        break;
      case 'Singleton':
        container.singletons.push({
          ...base,
          kind: 'singleton',
          type: typeRef(required(ctx, child, 'Type', base.id)),
          bindings: parseBindings(child),
        } satisfies Singleton);
        break;
      case 'ActionImport': {
        const imp: ActionImport = {
          ...base,
          kind: 'actionImport',
          action: required(ctx, child, 'Action', base.id),
        };
        if (child.attrs.EntitySet) imp.entitySet = child.attrs.EntitySet;
        container.actionImports.push(imp);
        break;
      }
      case 'FunctionImport': {
        const imp: FunctionImport = {
          ...base,
          kind: 'functionImport',
          function: required(ctx, child, 'Function', base.id),
          includeInServiceDocument: bool(child, 'IncludeInServiceDocument', false),
        };
        if (child.attrs.EntitySet) imp.entitySet = child.attrs.EntitySet;
        container.functionImports.push(imp);
        break;
      }
    }
  }
  return container;
}

function parseBindings(node: XNode): NavigationPropertyBinding[] {
  return node.children
    .filter((c) => c.name === 'NavigationPropertyBinding')
    .map((c) => ({ path: c.attrs.Path ?? '', target: c.attrs.Target ?? '' }));
}
