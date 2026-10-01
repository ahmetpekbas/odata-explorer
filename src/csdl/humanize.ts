// Friendly wording for the model: type strings ("Text (max 100)", "List of Order"), labels and
// descriptions. Pure TypeScript, so the same text can feed the UI, search and exports.
import { typeRefString } from './ids.ts';
import type { Annotation, ElementKind, Facets, TypeRef } from './model.ts';

const PRIMITIVE_NAMES: Record<string, string> = {
  Binary: 'Binary data',
  Boolean: 'Yes/No',
  Byte: 'Whole number',
  Date: 'Date',
  DateTimeOffset: 'Date and time',
  Decimal: 'Number',
  Double: 'Number',
  Duration: 'Duration',
  Guid: 'Unique ID',
  Int16: 'Whole number',
  Int32: 'Whole number',
  Int64: 'Whole number',
  SByte: 'Whole number',
  Single: 'Number',
  Stream: 'File',
  String: 'Text',
  TimeOfDay: 'Time',
  PrimitiveType: 'Any simple value',
  ComplexType: 'Any structure',
  EntityType: 'Any entity',
  Untyped: 'Any value',
  AnnotationPath: 'Path to an annotation',
  AnyPropertyPath: 'Path to a property',
  ModelElementPath: 'Path to a model element',
  NavigationPropertyPath: 'Path to a link',
  PropertyPath: 'Path to a property',
};

/** The part of a qualified name after its namespace: `NS.Sub.Order` -> `Order`. */
export function shortName(qualified: string): string {
  return qualified.slice(qualified.lastIndexOf('.') + 1);
}

/** Lower-case words from a camel-case name: `MultiPolygon` -> `multi polygon`. */
function spaced(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
}

function primitiveName(name: string): string {
  const edm = name.slice('Edm.'.length);
  const known = PRIMITIVE_NAMES[edm];
  if (known) return known;
  if (edm.startsWith('Geography') || edm.startsWith('Geometry')) {
    const rest = edm.replace(/^Geography|^Geometry/, '');
    const family = edm.startsWith('Geography') ? 'Geography' : 'Geometry';
    return rest ? `${family} ${spaced(rest)}` : `${family} shape`;
  }
  return edm;
}

/** Looks up what a qualified type name stands for; undefined when it is unknown. */
export type KindOf = (name: string) => ElementKind | undefined;

/** `Text (max 100)`: the base name of a primitive with the facets that matter to a reader. */
function primitiveWithFacets(name: string, facets: Facets): string {
  const base = primitiveName(name);
  const edm = name.slice('Edm.'.length);
  const parts: string[] = [];
  if ((edm === 'String' || edm === 'Binary') && facets.maxLength !== undefined) {
    parts.push(facets.maxLength === 'max' ? 'unlimited length' : `max ${facets.maxLength}`);
  }
  if (edm === 'Decimal') {
    if (facets.precision !== undefined) parts.push(`${facets.precision} digits`);
    if (typeof facets.scale === 'number') parts.push(`${facets.scale} decimals`);
  }
  return parts.length > 0 ? `${base} (${parts.join(', ')})` : base;
}

/**
 * A reader's name for a type: `Text (max 100)`, `Order`, `Color (choice)`, `List of Order`.
 * `kindOf` tells enums from structures; without it a model type shows as its short name.
 */
export function friendlyType(type: TypeRef, facets: Facets = {}, kindOf?: KindOf): string {
  const base = type.name.startsWith('Edm.')
    ? primitiveWithFacets(type.name, facets)
    : kindOf?.(type.name) === 'enumType'
      ? `${shortName(type.name)} (choice)`
      : shortName(type.name);
  return type.isCollection ? `List of ${base}` : base;
}

/** What a navigation property leads to: `Link to Customer`, `Link to Customer (many)`. */
export function friendlyLink(type: TypeRef): string {
  return `Link to ${shortName(type.name)}${type.isCollection ? ' (many)' : ''}`;
}

/** The type as written in CSDL, qualified: `Collection(NS.Order)`. */
export function technicalType(type: TypeRef): string {
  return typeRefString(type);
}

/** The facets that are set, as label/value pairs in a fixed order. */
export function facetEntries(facets: Facets): [label: string, value: string][] {
  const entries: [string, string][] = [];
  if (facets.maxLength !== undefined) entries.push(['MaxLength', String(facets.maxLength)]);
  if (facets.precision !== undefined) entries.push(['Precision', String(facets.precision)]);
  if (facets.scale !== undefined) entries.push(['Scale', String(facets.scale)]);
  if (facets.srid !== undefined) entries.push(['SRID', String(facets.srid)]);
  if (facets.unicode !== undefined) entries.push(['Unicode', String(facets.unicode)]);
  if (facets.defaultValue !== undefined) entries.push(['DefaultValue', facets.defaultValue]);
  return entries;
}

const APPLIES_TO: Record<string, string> = {
  Action: 'Actions',
  ActionImport: 'Action imports',
  Annotation: 'Annotations',
  Collection: 'Collections',
  ComplexType: 'Complex types',
  EntityContainer: 'Entity containers',
  EntitySet: 'Entity sets',
  EntityType: 'Entity types',
  EnumType: 'Enum types',
  Function: 'Functions',
  FunctionImport: 'Function imports',
  Include: 'Includes',
  NavigationProperty: 'Navigation properties',
  Parameter: 'Parameters',
  Property: 'Properties',
  Record: 'Records',
  Reference: 'References',
  ReturnType: 'Return types',
  Schema: 'Schemas',
  Singleton: 'Singletons',
  Term: 'Terms',
  TypeDefinition: 'Type definitions',
};

/** `EntityType` -> `Entity types`; unknown names stay as they are. */
export function friendlyAppliesTo(name: string): string {
  return APPLIES_TO[name] ?? name;
}

// ---------------------------------------------------------------------------------------------
// Labels and descriptions

const DESCRIPTION = 'Org.OData.Core.V1.Description';
const LONG_DESCRIPTION = 'Org.OData.Core.V1.LongDescription';
// SAP's Common vocabulary is not bundled, so it is matched by the end of its namespace.
const COMMON_LABEL = /\.Common\.v1\.Label$/i;

function stringValue(annotation: Annotation | undefined): string | undefined {
  const value = annotation?.value;
  if (value?.kind !== 'constant' || value.type !== 'string') return undefined;
  const text = value.value.trim();
  return text === '' ? undefined : text;
}

function firstString(
  element: { annotations: Annotation[] },
  matches: (term: string) => boolean,
): string | undefined {
  for (const annotation of element.annotations) {
    const text = matches(annotation.term) ? stringValue(annotation) : undefined;
    if (text !== undefined) return text;
  }
  return undefined;
}

/** `Common.Label`, else the name. A short, human name for the element. */
export function labelOf(element: { name: string; annotations: Annotation[] }): string {
  return firstString(element, (t) => COMMON_LABEL.test(t)) ?? element.name;
}

/** Whether the element has a label other than its name. */
export function hasLabel(element: { name: string; annotations: Annotation[] }): boolean {
  return labelOf(element) !== element.name;
}

/** `Core.Description`, else undefined. */
export function descriptionOf(element: { annotations: Annotation[] }): string | undefined {
  return firstString(element, (t) => t === DESCRIPTION);
}

/** `Core.LongDescription`, else undefined. */
export function longDescriptionOf(element: { annotations: Annotation[] }): string | undefined {
  return firstString(element, (t) => t === LONG_DESCRIPTION);
}
