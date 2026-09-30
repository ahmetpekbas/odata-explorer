// Readers shared by the CSDL JSON converters. A JSON member is either a `$Keyword` (metadata of the
// element itself), an `@Term` (an annotation), or a name (a child element).
import { typeRef } from './ids.ts';
import type { Facets, TypeRef } from './model.ts';

export type JsonObject = Record<string, unknown>;

export function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function bool(obj: JsonObject, key: string, fallback: boolean): boolean {
  const value = obj[key];
  return typeof value === 'boolean' ? value : fallback;
}

export function str(obj: JsonObject, key: string): string | undefined {
  const value = obj[key];
  return typeof value === 'string' ? value : undefined;
}

/** The text of a scalar, which JSON may write as a string, a number or a boolean. */
export function scalar(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : '';
}

/** Names of the child elements: everything that is neither a `$Keyword` nor an annotation. */
export function childNames(obj: JsonObject): string[] {
  return Object.keys(obj).filter(
    (k) => !k.startsWith('$') && !k.startsWith('@') && !k.includes('@'),
  );
}

/** `$Type` (default `Edm.String`) and `$Collection`, as a type reference. */
export function typeOf(obj: JsonObject): TypeRef {
  const type = str(obj, '$Type') ?? 'Edm.String';
  return typeRef(bool(obj, '$Collection', false) ? `Collection(${type})` : type);
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined;
}

/** Facets that differ from their defaults (precision 0, scale 0, unicode true), as in the XML parser. */
export function facets(obj: JsonObject): Facets {
  const f: Facets = {};
  const maxLength = obj.$MaxLength;
  if (maxLength !== undefined) f.maxLength = maxLength === 'max' ? 'max' : count(maxLength);
  const precision = count(obj.$Precision);
  if (precision) f.precision = precision;
  const scale = obj.$Scale;
  if (scale !== undefined) {
    const value = scale === 'variable' || scale === 'floating' ? scale : count(scale);
    if (value) f.scale = value;
  }
  const srid = obj.$SRID;
  if (srid !== undefined) f.srid = srid === 'variable' ? 'variable' : count(srid);
  if (!bool(obj, '$Unicode', true)) f.unicode = false;
  if (obj.$DefaultValue !== undefined)
    f.defaultValue = obj.$DefaultValue === null ? 'null' : scalar(obj.$DefaultValue);
  return f;
}
