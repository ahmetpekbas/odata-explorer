// Normalized CSDL model. Both the XML and the JSON parser produce these types; the resolver mutates
// them in place (qualifying names, merging annotations). Pure TypeScript: no DOM, no React.
//
// Every element has an `id`, its CSDL target path (see ids.ts). Type references are parsed as written
// and qualified by the resolver, which also recomputes overload ids once aliases are known.

/** Half-open character offsets into the source text. Only XML documents carry spans. */
export interface Span {
  start: number;
  end: number;
}

export type Severity = 'error' | 'warning' | 'info';

/** A non-fatal problem found while parsing or resolving. */
export interface Diagnostic {
  severity: Severity;
  /** Stable machine-readable code, e.g. `xml-syntax`, `unresolved-type`. */
  code: string;
  message: string;
  /** 1-based, when the problem has a position in the source. */
  line?: number;
  column?: number;
  span?: Span;
  /** Target-path ID of the element the problem belongs to. */
  target?: string;
}

// ---------------------------------------------------------------------------------------------
// Types and facets

export interface TypeRef {
  /** The reference exactly as written, e.g. `Collection(Alias.Order)`. */
  raw: string;
  /** The type name without `Collection(...)`. Qualified with the full namespace once resolved. */
  name: string;
  isCollection: boolean;
}

export interface Facets {
  maxLength?: number | 'max';
  precision?: number;
  scale?: number | 'variable' | 'floating';
  srid?: number | 'variable';
  unicode?: boolean;
  defaultValue?: string;
}

// ---------------------------------------------------------------------------------------------
// Annotation expressions

export type ConstantType =
  | 'binary'
  | 'bool'
  | 'date'
  | 'dateTimeOffset'
  | 'decimal'
  | 'duration'
  | 'enumMember'
  | 'float'
  | 'guid'
  | 'int'
  | 'string'
  | 'timeOfDay';

export type PathType =
  'Path' | 'AnnotationPath' | 'ModelElementPath' | 'NavigationPropertyPath' | 'PropertyPath';

export type OperatorName =
  | 'And'
  | 'Or'
  | 'Not'
  | 'Eq'
  | 'Ne'
  | 'Gt'
  | 'Ge'
  | 'Lt'
  | 'Le'
  | 'Has'
  | 'In'
  | 'Add'
  | 'Sub'
  | 'Neg'
  | 'Mul'
  | 'Div'
  | 'DivBy'
  | 'Mod';

export interface PropertyValue {
  property: string;
  value: Expression;
  annotations: Annotation[];
}

export type Expression =
  | { kind: 'constant'; type: ConstantType; value: string }
  | { kind: 'path'; type: PathType; value: string }
  | { kind: 'null'; annotations: Annotation[] }
  | { kind: 'record'; type?: string; properties: PropertyValue[]; annotations: Annotation[] }
  | { kind: 'collection'; items: Expression[] }
  | { kind: 'apply'; function: string; args: Expression[]; annotations: Annotation[] }
  | { kind: 'if'; test: Expression; then: Expression; else: Expression }
  | { kind: 'operator'; operator: OperatorName; args: Expression[] }
  | { kind: 'cast' | 'isOf'; type: TypeRef; facets: Facets; value: Expression }
  | { kind: 'labeledElement'; name: string; value: Expression }
  | { kind: 'labeledElementReference'; name: string }
  | { kind: 'urlRef'; value: Expression };

export interface Annotation {
  /** Term as written; qualified by the resolver. */
  term: string;
  qualifier?: string;
  /** Absent for a bare boolean annotation such as `<Annotation Term="Core.Computed"/>`. */
  value?: Expression;
  /** Annotations on the annotation itself. */
  annotations: Annotation[];
  /** `inline` when nested in its target element, `external` when from an `<Annotations Target>` block. */
  origin: 'inline' | 'external';
  /** Target-path ID of the annotated element, set when the resolver attaches the annotation. */
  target?: string;
  span?: Span;
}

/** An `<Annotations Target="...">` block as written, before the resolver attaches its annotations. */
export interface AnnotationBlock {
  target: string;
  /** A block qualifier is copied onto the annotations inside it, as JSON has no such thing. */
  annotations: Annotation[];
  span?: Span;
}

// ---------------------------------------------------------------------------------------------
// Elements

interface ElementBase {
  id: string;
  name: string;
  annotations: Annotation[];
  span?: Span;
}

export interface Property extends ElementBase {
  kind: 'property';
  type: TypeRef;
  nullable: boolean;
  facets: Facets;
}

export interface ReferentialConstraint {
  property: string;
  referencedProperty: string;
}

export type OnDeleteAction = 'Cascade' | 'None' | 'SetNull' | 'SetDefault';

export interface NavigationProperty extends ElementBase {
  kind: 'navigationProperty';
  type: TypeRef;
  nullable: boolean;
  /** Name of the partner navigation property on the target type. */
  partner?: string;
  containsTarget: boolean;
  referentialConstraints: ReferentialConstraint[];
  onDelete?: OnDeleteAction;
}

export interface KeyProperty {
  /** Property name, or a path such as `Address/City`. */
  name: string;
  alias?: string;
}

export interface StructuredType extends ElementBase {
  kind: 'entityType' | 'complexType';
  baseType?: TypeRef;
  abstract: boolean;
  openType: boolean;
  /** Entity types only. */
  hasStream: boolean;
  /** Own key only; the resolver computes the inherited key. */
  key: KeyProperty[];
  properties: Property[];
  navigationProperties: NavigationProperty[];
}

export interface EnumMember extends ElementBase {
  kind: 'enumMember';
  value?: string;
}

export interface EnumType extends ElementBase {
  kind: 'enumType';
  isFlags: boolean;
  underlyingType: string;
  members: EnumMember[];
}

export interface TypeDefinition extends ElementBase {
  kind: 'typeDefinition';
  underlyingType: string;
  facets: Facets;
}

export interface Term extends ElementBase {
  kind: 'term';
  type: TypeRef;
  nullable: boolean;
  facets: Facets;
  baseTerm?: string;
  appliesTo: string[];
}

export interface Parameter extends ElementBase {
  kind: 'parameter';
  type: TypeRef;
  nullable: boolean;
  facets: Facets;
}

export interface ReturnType extends ElementBase {
  kind: 'returnType';
  type: TypeRef;
  nullable: boolean;
  facets: Facets;
}

/** One overload of an action or function. `id` includes the overload signature. */
export interface Operation extends ElementBase {
  kind: 'action' | 'function';
  isBound: boolean;
  /** Functions only. */
  isComposable: boolean;
  entitySetPath?: string;
  parameters: Parameter[];
  returnType?: ReturnType;
}

export interface NavigationPropertyBinding {
  path: string;
  target: string;
}

export interface EntitySet extends ElementBase {
  kind: 'entitySet';
  entityType: TypeRef;
  includeInServiceDocument: boolean;
  bindings: NavigationPropertyBinding[];
}

export interface Singleton extends ElementBase {
  kind: 'singleton';
  type: TypeRef;
  bindings: NavigationPropertyBinding[];
}

export interface ActionImport extends ElementBase {
  kind: 'actionImport';
  action: string;
  entitySet?: string;
}

export interface FunctionImport extends ElementBase {
  kind: 'functionImport';
  function: string;
  entitySet?: string;
  includeInServiceDocument: boolean;
}

export interface EntityContainer extends ElementBase {
  kind: 'entityContainer';
  extends?: string;
  entitySets: EntitySet[];
  singletons: Singleton[];
  actionImports: ActionImport[];
  functionImports: FunctionImport[];
}

export interface Schema extends ElementBase {
  kind: 'schema';
  namespace: string;
  alias?: string;
  entityTypes: StructuredType[];
  complexTypes: StructuredType[];
  enumTypes: EnumType[];
  typeDefinitions: TypeDefinition[];
  terms: Term[];
  actions: Operation[];
  functions: Operation[];
  entityContainers: EntityContainer[];
  /** External annotation blocks declared in this schema. */
  annotationBlocks: AnnotationBlock[];
}

export interface Include {
  namespace: string;
  alias?: string;
}

export interface IncludeAnnotations {
  termNamespace: string;
  qualifier?: string;
  targetNamespace?: string;
}

export interface Reference {
  uri: string;
  includes: Include[];
  includeAnnotations: IncludeAnnotations[];
  span?: Span;
}

export interface Model {
  format: 'xml' | 'json';
  /** The OData version as declared, e.g. `4.0` or `4.01`. */
  version: string;
  references: Reference[];
  schemas: Schema[];
  diagnostics: Diagnostic[];
}

export type Element =
  | Schema
  | StructuredType
  | EnumType
  | EnumMember
  | TypeDefinition
  | Property
  | NavigationProperty
  | Term
  | Operation
  | Parameter
  | ReturnType
  | EntityContainer
  | EntitySet
  | Singleton
  | ActionImport
  | FunctionImport;

export type ElementKind = Element['kind'];
