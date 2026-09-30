// Committed sample documents, loaded as text so the same code runs under Vitest and Vite.
export { default as trippinXml } from '../../fixtures/trippin.xml?raw';
export { default as northwindXml } from '../../fixtures/northwind.xml?raw';
export { default as expressionsXml } from '../../fixtures/expressions.xml?raw';
export { default as aliasesXml } from '../../fixtures/aliases.xml?raw';
export { default as unresolvedXml } from '../../fixtures/unresolved.xml?raw';

import type { ExternalSchemas } from './resolve.ts';

/** Stands in for the bundled vocabularies in tests of the CSDL core: Core exists but is empty. */
export const coreOnly: ExternalSchemas = {
  has: (namespace) => namespace === 'Org.OData.Core.V1',
  get: () => undefined,
};
