// Attribute readers shared by the CSDL XML converters.
import type { Diagnostic, Facets } from './model.ts';
import type { XNode } from './xml-tree.ts';

/** Collects diagnostics while converting a tree to a model. */
export interface Ctx {
  diagnostics: Diagnostic[];
}

export function bool(node: XNode, attr: string, fallback: boolean): boolean {
  const value = node.attrs[attr];
  return value === undefined ? fallback : value === 'true';
}

export function int(node: XNode, attr: string): number | undefined {
  const value = node.attrs[attr];
  if (value === undefined) return undefined;
  const n = Number(value);
  return Number.isInteger(n) ? n : undefined;
}

export function facets(node: XNode): Facets {
  const f: Facets = {};
  const maxLength = node.attrs.MaxLength;
  if (maxLength !== undefined) f.maxLength = maxLength === 'max' ? 'max' : int(node, 'MaxLength');
  const precision = int(node, 'Precision');
  if (precision !== undefined) f.precision = precision;
  const scale = node.attrs.Scale;
  if (scale !== undefined)
    f.scale = scale === 'variable' || scale === 'floating' ? scale : int(node, 'Scale');
  const srid = node.attrs.SRID;
  if (srid !== undefined) f.srid = srid === 'variable' ? 'variable' : int(node, 'SRID');
  if (node.attrs.Unicode !== undefined) f.unicode = bool(node, 'Unicode', true);
  if (node.attrs.DefaultValue !== undefined) f.defaultValue = node.attrs.DefaultValue;
  return f;
}
