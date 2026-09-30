// Attribute readers shared by the CSDL XML converters.
import type { Diagnostic, Facets, TypeRef } from './model.ts';
import type { XNode } from './xml-tree.ts';

/** Collects diagnostics while converting a tree to a model. */
export interface Ctx {
  diagnostics: Diagnostic[];
}

export function bool(node: XNode, attr: string, fallback: boolean): boolean {
  const value = node.attrs[attr];
  return value === undefined ? fallback : value === 'true';
}

/**
 * `Nullable` defaults to true, except for collections: there it concerns the items, and CSDL JSON
 * (whose `$Nullable` defaults to false) is the reference for the model.
 */
export function nullable(node: XNode, type: TypeRef): boolean {
  return bool(node, 'Nullable', !type.isCollection);
}

export function int(node: XNode, attr: string): number | undefined {
  const value = node.attrs[attr];
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isInteger(n) ? n : undefined;
}

/** Facets that differ from their defaults (precision 0, scale 0, unicode true), as in the JSON parser. */
export function facets(node: XNode): Facets {
  const f: Facets = {};
  const maxLength = node.attrs.MaxLength;
  if (maxLength !== undefined) f.maxLength = maxLength === 'max' ? 'max' : int(node, 'MaxLength');
  const precision = int(node, 'Precision');
  if (precision) f.precision = precision;
  const scale = node.attrs.Scale;
  if (scale !== undefined) {
    const value = scale === 'variable' || scale === 'floating' ? scale : int(node, 'Scale');
    if (value) f.scale = value;
  }
  const srid = node.attrs.SRID;
  if (srid !== undefined) f.srid = srid === 'variable' ? 'variable' : int(node, 'SRID');
  if (node.attrs.Unicode !== undefined && !bool(node, 'Unicode', true)) f.unicode = false;
  if (node.attrs.DefaultValue !== undefined) f.defaultValue = node.attrs.DefaultValue;
  return f;
}
