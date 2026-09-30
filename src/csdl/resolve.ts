// Resolver. Runs after a parser and mutates the model in place: aliases become namespaces, every type
// reference is qualified, and overload IDs are recomputed from the qualified parameter types.
// Problems become diagnostics; nothing here throws.
import { locateDiagnostics } from './diagnostics.ts';
import { actionId, functionId, parameterId, returnTypeId } from './ids.ts';
import type { Annotation, Diagnostic, Element, Expression, Model, TypeRef } from './model.ts';
import { resolveStructure, type Structure } from './resolve-structure.ts';
import { allElements } from './walk.ts';

export interface Resolved extends Structure {
  model: Model;
  /** Every element of the model by target-path ID. */
  elements: Map<string, Element>;
}

const PRIMITIVES = new Set(
  [
    'Binary',
    'Boolean',
    'Byte',
    'Date',
    'DateTimeOffset',
    'Decimal',
    'Double',
    'Duration',
    'Guid',
    'Int16',
    'Int32',
    'Int64',
    'SByte',
    'Single',
    'Stream',
    'String',
    'TimeOfDay',
    'Geography',
    'GeographyPoint',
    'GeographyLineString',
    'GeographyPolygon',
    'GeographyMultiPoint',
    'GeographyMultiLineString',
    'GeographyMultiPolygon',
    'GeographyCollection',
    'Geometry',
    'GeometryPoint',
    'GeometryLineString',
    'GeometryPolygon',
    'GeometryMultiPoint',
    'GeometryMultiLineString',
    'GeometryMultiPolygon',
    'GeometryCollection',
    // Abstract and path types, usable in terms and parameters.
    'PrimitiveType',
    'ComplexType',
    'EntityType',
    'Untyped',
    'AnnotationPath',
    'ModelElementPath',
    'NavigationPropertyPath',
    'PropertyPath',
  ].map((n) => `Edm.${n}`),
);

/** `source` is the text the model was parsed from; it lets diagnostics carry line and column. */
export function resolve(model: Model, source?: string): Resolved {
  const r = new Resolver(model);
  r.run();
  const structure = resolveStructure(model, r.elements, (name) => r.qualifyName(name));
  if (source !== undefined) locateDiagnostics(model.diagnostics, source);
  return { model, elements: r.elements, ...structure };
}

class Resolver {
  readonly elements = new Map<string, Element>();
  /** Alias -> namespace, from `Schema Alias` and `edmx:Include Alias`. */
  private readonly aliases = new Map<string, string>();
  /** Namespaces defined by a schema in this document. */
  private readonly ownNamespaces = new Set<string>();
  /** Namespaces named by `edmx:Include`: they exist, but their content is not in this document. */
  private readonly included = new Set<string>();
  /** Schema-level types and type definitions by qualified name. */
  private readonly types = new Map<string, Element>();

  private readonly model: Model;

  constructor(model: Model) {
    this.model = model;
  }

  run(): void {
    this.collectScope();
    for (const element of allElements(this.model)) this.qualifyElement(element);
    this.renumberOperations();
    this.indexElements();
  }

  // -------------------------------------------------------------------------------------------
  // Scope

  private collectScope(): void {
    const { model } = this;
    for (const schema of model.schemas) {
      this.ownNamespaces.add(schema.namespace);
      for (const t of [
        ...schema.entityTypes,
        ...schema.complexTypes,
        ...schema.enumTypes,
        ...schema.typeDefinitions,
      ]) {
        this.types.set(t.id, t);
      }
      if (schema.alias) this.addAlias(schema.alias, schema.namespace, schema);
    }
    for (const reference of model.references) {
      for (const include of reference.includes) {
        this.included.add(include.namespace);
        if (include.alias) {
          this.addAlias(include.alias, include.namespace, undefined, reference.span);
        }
      }
    }
  }

  private addAlias(
    alias: string,
    namespace: string,
    element?: Element,
    span?: Element['span'],
  ): void {
    const existing = this.aliases.get(alias);
    if (existing !== undefined && existing !== namespace) {
      this.report(
        element,
        'duplicate-alias',
        `The alias ${alias} stands for both ${existing} and ${namespace}.`,
        'error',
        span,
      );
      return;
    }
    this.aliases.set(alias, namespace);
  }

  // -------------------------------------------------------------------------------------------
  // Names

  /** Replaces a leading alias with its namespace: `Alias.Type` -> `Namespace.Type`. */
  qualifyName(name: string): string {
    const dot = name.lastIndexOf('.');
    if (dot < 0) return name;
    const namespace = this.aliases.get(name.slice(0, dot));
    return namespace === undefined ? name : namespace + name.slice(dot);
  }

  /** Qualifies a type reference in place and reports it when it cannot be found. */
  private qualifyType(type: TypeRef, owner: Element | undefined): void {
    if (type.name.startsWith('Edm.')) {
      if (!PRIMITIVES.has(type.name))
        this.report(owner, 'unresolved-type', `${type.name} is not an Edm type.`);
      return;
    }
    type.name = this.qualifyName(type.name);
    const dot = type.name.lastIndexOf('.');
    const namespace = dot < 0 ? '' : type.name.slice(0, dot);
    if (this.ownNamespaces.has(namespace)) {
      const found = this.types.get(type.name);
      if (!found)
        this.report(
          owner,
          'unresolved-type',
          `The type ${type.name} is not defined in ${namespace}.`,
        );
    } else if (!this.included.has(namespace)) {
      this.report(
        owner,
        'unresolved-type',
        namespace
          ? `The type ${type.name} is not in scope: no schema or reference declares the namespace ${namespace}.`
          : `The type ${type.name} is not qualified with a namespace.`,
      );
    }
  }

  private qualifyElement(element: Element): void {
    switch (element.kind) {
      case 'entityType':
      case 'complexType':
        if (element.baseType) this.qualifyType(element.baseType, element);
        break;
      case 'property':
      case 'navigationProperty':
      case 'parameter':
      case 'returnType':
        this.qualifyType(element.type, element);
        break;
      case 'enumType':
      case 'typeDefinition':
        this.qualifyType(
          { raw: element.underlyingType, name: element.underlyingType, isCollection: false },
          element,
        );
        break;
      case 'term':
        this.qualifyType(element.type, element);
        if (element.baseTerm) element.baseTerm = this.qualifyName(element.baseTerm);
        break;
      case 'entitySet':
        this.qualifyType(element.entityType, element);
        break;
      case 'singleton':
        this.qualifyType(element.type, element);
        break;
      case 'entityContainer':
        if (element.extends) element.extends = this.qualifyName(element.extends);
        break;
      case 'actionImport':
        element.action = this.qualifyName(element.action);
        break;
      case 'functionImport':
        element.function = this.qualifyName(element.function);
        break;
    }
    for (const annotation of element.annotations) this.qualifyAnnotation(annotation, element);
    if (element.kind === 'schema') {
      for (const block of element.annotationBlocks) {
        for (const annotation of block.annotations) this.qualifyAnnotation(annotation, element);
      }
    }
  }

  private qualifyAnnotation(annotation: Annotation, owner: Element): void {
    annotation.term = this.qualifyName(annotation.term);
    if (annotation.value) this.qualifyExpression(annotation.value, owner);
    for (const nested of annotation.annotations) this.qualifyAnnotation(nested, owner);
  }

  private qualifyExpression(expr: Expression, owner: Element): void {
    switch (expr.kind) {
      case 'constant':
        if (expr.type === 'enumMember') {
          // `Alias.Type/Member Alias.Type/Other`
          expr.value = expr.value
            .split(/\s+/)
            .map((m) => {
              const slash = m.indexOf('/');
              return slash < 0 ? m : this.qualifyName(m.slice(0, slash)) + m.slice(slash);
            })
            .join(' ');
        }
        break;
      case 'record':
        if (expr.type) expr.type = this.qualifyName(expr.type);
        for (const p of expr.properties) {
          this.qualifyExpression(p.value, owner);
          for (const a of p.annotations) this.qualifyAnnotation(a, owner);
        }
        for (const a of expr.annotations) this.qualifyAnnotation(a, owner);
        break;
      case 'collection':
        for (const item of expr.items) this.qualifyExpression(item, owner);
        break;
      case 'apply':
        for (const arg of expr.args) this.qualifyExpression(arg, owner);
        for (const a of expr.annotations) this.qualifyAnnotation(a, owner);
        break;
      case 'operator':
        for (const arg of expr.args) this.qualifyExpression(arg, owner);
        break;
      case 'if':
        for (const e of [expr.test, expr.then, expr.else]) this.qualifyExpression(e, owner);
        break;
      case 'cast':
      case 'isOf':
        this.qualifyType(expr.type, owner);
        this.qualifyExpression(expr.value, owner);
        break;
      case 'labeledElement':
      case 'urlRef':
        this.qualifyExpression(expr.value, owner);
        break;
      case 'null':
        for (const a of expr.annotations) this.qualifyAnnotation(a, owner);
        break;
    }
  }

  // -------------------------------------------------------------------------------------------
  // IDs and index

  /** Overload IDs contain parameter types, so they are only final once the types are qualified. */
  private renumberOperations(): void {
    for (const schema of this.model.schemas) {
      for (const op of [...schema.actions, ...schema.functions]) {
        const qualified = `${schema.namespace}.${op.name}`;
        op.id =
          op.kind === 'action'
            ? actionId(qualified, op.isBound ? op.parameters[0]?.type : undefined)
            : functionId(
                qualified,
                op.parameters.map((p) => p.type),
              );
        for (const p of op.parameters) p.id = parameterId(op.id, p.name);
        if (op.returnType) op.returnType.id = returnTypeId(op.id);
      }
    }
  }

  private indexElements(): void {
    for (const element of allElements(this.model)) {
      if (this.elements.has(element.id)) {
        this.report(element, 'duplicate-id', `${element.id} is defined more than once.`, 'warning');
      } else {
        this.elements.set(element.id, element);
      }
    }
  }

  private report(
    element: Element | undefined,
    code: string,
    message: string,
    severity: Diagnostic['severity'] = 'error',
    span = element?.span,
  ): void {
    const d: Diagnostic = { severity, code, message };
    if (element) d.target = element.id;
    if (span) d.span = span;
    this.model.diagnostics.push(d);
  }
}
