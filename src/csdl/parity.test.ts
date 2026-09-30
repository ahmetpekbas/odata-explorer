// The XML and JSON forms of the same document must produce the same model. The pairs are the OASIS
// vocabularies and the examples of oasis-tcs/odata-csdl-schemas, whose JSON the OASIS tooling generated
// from the XML. Models are compared after resolving (so `Alias.Type` and `Namespace.Type` agree) and
// without source spans, which only XML has.
import { describe, expect, it } from 'vitest';
import { bundledSchemas } from '../vocabularies/index.ts';
import type { AnnotationBlock, Model, NavigationPropertyBinding, TypeRef } from './model.ts';
import { parseJson } from './parse-json.ts';
import { parseXml } from './parse-xml.ts';
import { resolve } from './resolve.ts';
import { allElements } from './walk.ts';

const sources = {
  ...import.meta.glob<string>('../vocabularies/*.{xml,json}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob<string>('../../fixtures/csdl-schemas/*.{xml,json}', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
};

const pairs = new Map<string, { xml?: string; json?: string }>();
for (const [path, text] of Object.entries(sources)) {
  const m = /([^/]+)\.(xml|json)$/.exec(path);
  if (!m?.[1] || !m[2]) continue;
  pairs.set(m[1], { ...pairs.get(m[1]), [m[2]]: text });
}

type Json = Record<string, unknown>;

/**
 * What JSON cannot carry, or what the two files of a pair write differently, is evened out here.
 * Nothing else is: any other difference between the parsers fails the test.
 *  - JSON constants are typed only as string, number or boolean, and its paths only as `$Path`:
 *    constants and other paths compare by value (an enum member by its name, a number by its number).
 *  - An annotation without a value stands for the term's default, which JSON writes out (`true`).
 *  - JSON writes a typed enum literal as a `$Cast` of a string, XML as an enum member.
 *  - A type reference keeps its text as written (`raw`), which differs where one file uses an alias.
 *  - JSON numbers are doubles, so a long decimal default value compares as a number.
 *  - JSON has no `max` length, and its converter omits the `variable` scale.
 *  - Paths and binding targets may use an alias in one file and the namespace in the other, and an
 *    import or binding may name its entity set with or without the container.
 */
function normalizer(qualifyAliases: (text: string) => string) {
  const isConstant = (v: unknown): boolean => (v as Json | undefined)?.kind === 'constant';

  function normalize(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(normalize);
    if (typeof value !== 'object' || value === null) return value;
    const o = value as Json;
    const type = o.type as string;

    if (o.kind === 'constant' || (o.kind === 'path' && type !== 'Path')) {
      const text = String(o.value);
      let scalar: string;
      if (type === 'enumMember') {
        scalar = text
          .split(/[\s,]+/)
          .map((member) => member.slice(member.lastIndexOf('/') + 1))
          .join(',');
      } else if (['int', 'decimal', 'float'].includes(type) && !isNaN(Number(text))) {
        scalar = String(Number(text));
      } else scalar = qualifyAliases(text.replace(/\s+/g, ' ').trim());
      return { kind: 'scalar', value: scalar };
    }
    if (o.kind === 'cast' && isConstant(o.value) && !(o.type as TypeRef).name.startsWith('Edm.')) {
      return normalize(o.value);
    }

    if (o.kind === 'labeledElementReference') {
      return { ...o, name: qualifyAliases(String(o.name)) };
    }

    const out: Json = {};
    for (const [key, v] of Object.entries(o)) {
      if (key === 'span' || key === 'line' || key === 'column' || key === 'raw') continue;
      out[key] = normalize(v);
    }
    if ('term' in o && 'origin' in o && !('value' in o))
      out.value = { kind: 'scalar', value: 'true' };
    if (typeof o.defaultValue === 'string' && !isNaN(Number(o.defaultValue)))
      out.defaultValue = String(Number(o.defaultValue));
    if (o.maxLength === 'max') delete out.maxLength;
    if (o.scale === 'variable') delete out.scale;

    const container = String(o.id).slice(0, String(o.id).lastIndexOf('/') + 1);
    const withoutContainer = (name: string) =>
      name.startsWith(container) ? name.slice(container.length) : name;
    if (typeof o.entitySet === 'string') out.entitySet = withoutContainer(o.entitySet);
    if (Array.isArray(o.bindings)) {
      out.bindings = (o.bindings as NavigationPropertyBinding[]).map((b) => ({
        ...b,
        target: withoutContainer(qualifyAliases(b.target)),
      }));
    }
    return out;
  }
  return normalize;
}

function mergeBlocks(blocks: AnnotationBlock[]): AnnotationBlock[] {
  const byTarget = new Map<string, AnnotationBlock>();
  for (const { target, annotations } of blocks) {
    const merged = byTarget.get(target) ?? { target, annotations: [] };
    merged.annotations.push(...annotations);
    byTarget.set(target, merged);
  }
  return [...byTarget.values()];
}

function canonical(text: string, parse: (text: string) => Model) {
  const parsed = parse(text);
  const aliases = new Map<string, string>();
  for (const schema of parsed.schemas) {
    if (schema.alias) aliases.set(schema.alias, schema.namespace);
  }
  const qualifyAliases = (name: string) =>
    name.replace(/(^|[^\w.])(\w+)\./g, (all, before: string, alias: string) =>
      aliases.has(alias) ? `${before}${aliases.get(alias)}.` : all,
    );

  const model = resolve(parsed, undefined, bundledSchemas).model;
  // The reference URIs differ in their extension, and JSON objects cannot repeat a reference.
  const uris = new Set<string>();
  const references = model.references
    .map((r) => ({ ...r, uri: r.uri.replace(/\.(xml|json)$/, '') }))
    .filter((r) => !uris.has(r.uri) && uris.add(r.uri));
  // Merged blocks report once per target; the order of reports follows the order of the blocks.
  const diagnostics = [
    ...new Set(
      model.diagnostics.map((d) =>
        JSON.stringify({
          ...d,
          message: d.message.replace(/\.(xml|json)\b/g, ''),
          span: undefined,
          line: undefined,
          column: undefined,
        }),
      ),
    ),
  ]
    .sort()
    .map((d) => JSON.parse(d) as unknown);
  for (const schema of model.schemas) {
    // JSON has one object per annotation target, so XML's `<Annotations>` blocks merge by target.
    schema.annotationBlocks = mergeBlocks(schema.annotationBlocks);
    // A vocabulary links to its own other format, which differs by design.
    schema.annotations = schema.annotations.filter((a) => a.term !== 'Org.OData.Core.V1.Links');
  }
  return normalizer(qualifyAliases)({ ...model, format: undefined, references, diagnostics });
}

describe('XML and JSON parity', () => {
  it('finds every pair', () => {
    expect(pairs.size).toBe(14);
    for (const pair of pairs.values()) expect(Object.keys(pair).sort()).toEqual(['json', 'xml']);
  });

  it.each([...pairs.entries()])('%s is the same model in both formats', (_name, { xml, json }) => {
    const fromXml = canonical(xml ?? '', parseXml);
    const fromJson = canonical(json ?? '', parseJson);
    expect(fromJson).toEqual(fromXml);
    // Guard against two empty models agreeing.
    expect((fromXml as { schemas: unknown[] }).schemas.length).toBeGreaterThan(0);
  });

  it('parses every file without error diagnostics', () => {
    for (const { xml, json } of pairs.values()) {
      for (const model of [parseXml(xml ?? ''), parseJson(json ?? '')]) {
        expect(model.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
        expect([...allElements(model)].length).toBeGreaterThan(0);
      }
    }
  });
});
