// The standard OASIS vocabularies, bundled so `edmx:Reference`s to them resolve offline. Kept outside
// src/csdl/ because it uses Vite's `import.meta.glob`; the CSDL core takes it as an `ExternalSchemas`.
import { parseXml } from '../csdl/parse-xml.ts';
import { resolve, type ExternalSchemas, type Resolved } from '../csdl/resolve.ts';
import type { Term } from '../csdl/model.ts';

// Files are named after their namespace: `Org.OData.Core.V1.xml`.
const sources = new Map(
  Object.entries(
    import.meta.glob<string>('./*.xml', { query: '?raw', import: 'default', eager: true }),
  ).map(([path, text]) => [path.replace(/^\.\/(.*)\.xml$/, '$1'), text]),
);

const cache = new Map<string, Resolved>();
const loading = new Set<string>();

/** Namespaces of the bundled vocabularies. */
export const BUNDLED_NAMESPACES: readonly string[] = [...sources.keys()];

/** What the resolver needs to check references against the bundle. */
export const bundledSchemas: ExternalSchemas = {
  has: (namespace) => sources.has(namespace),
  get: (namespace) => bundledVocabulary(namespace),
};

/** The parsed and resolved vocabulary for a namespace, or undefined when it is not bundled. */
export function bundledVocabulary(namespace: string): Resolved | undefined {
  const cached = cache.get(namespace);
  if (cached) return cached;
  const text = sources.get(namespace);
  // Vocabularies reference each other in cycles; the inner one resolves without the outer's content.
  if (text === undefined || loading.has(namespace)) return undefined;
  loading.add(namespace);
  try {
    const resolved = resolve(parseXml(text), text, bundledSchemas);
    cache.set(namespace, resolved);
    return resolved;
  } finally {
    loading.delete(namespace);
  }
}

/** The definition of a term by qualified name, e.g. `Org.OData.Core.V1.Description`. */
export function lookupTerm(qualifiedName: string): Term | undefined {
  const namespace = qualifiedName.slice(0, Math.max(qualifiedName.lastIndexOf('.'), 0));
  const element = bundledVocabulary(namespace)?.elements.get(qualifiedName);
  return element?.kind === 'term' ? element : undefined;
}
