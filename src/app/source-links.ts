// Jump-to-definition in the source panel: which qualified names in a fragment lead to an element.
import type { ElementKind } from '../csdl/model.ts';
import type { Resolved } from '../csdl/resolve.ts';
import { openableTarget } from './openable.ts';

export interface LinkTarget {
  id: string;
  kind: ElementKind;
}

/** A qualified name as written in CSDL: `NS.Trip`, `Alias.Fn`, `NS.Container/Customers`. */
export const QUALIFIED_NAME = /[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+(?:\/[A-Za-z_]\w*)*/g;

/**
 * A lookup from a name as written in the source to the tab it opens, or undefined when nothing in the
 * model has that name (`Edm.String`, vocabulary terms, text that merely looks qualified). The source
 * keeps aliases as written, so `Alias.Trip` is also tried as `Namespace.Trip`. Answers are cached.
 */
export function linkResolver(resolved: Resolved): (name: string) => LinkTarget | undefined {
  const aliases = new Map<string, string>();
  for (const schema of resolved.model.schemas) {
    if (schema.alias) aliases.set(schema.alias, schema.namespace);
  }
  for (const reference of resolved.model.references) {
    for (const include of reference.includes) {
      if (include.alias) aliases.set(include.alias, include.namespace);
    }
  }
  const cache = new Map<string, LinkTarget | undefined>();
  return (name) => {
    if (cache.has(name)) return cache.get(name);
    const candidates = [name];
    for (const [alias, namespace] of aliases) {
      if (name.startsWith(`${alias}.`)) candidates.push(namespace + name.slice(alias.length));
    }
    let found: LinkTarget | undefined;
    for (const candidate of candidates) {
      const target = openableTarget(resolved, candidate);
      // A name that only matches an ancestor (`NS.Type/Nope` -> `NS.Type`) is not a reference to it.
      if (target && (target.id === candidate || resolved.elements.has(candidate))) {
        found = target;
        break;
      }
    }
    cache.set(name, found);
    return found;
  };
}
