import { overloadGroupId } from '../csdl/ids.ts';
import type { ElementKind } from '../csdl/model.ts';
import type { Resolved } from '../csdl/resolve.ts';

/** The kinds that have a tab of their own; the rest are shown inside the tab of their parent. */
const OPENABLE = new Set<ElementKind>([
  'schema',
  'entityType',
  'complexType',
  'enumType',
  'typeDefinition',
  'term',
  'action',
  'function',
  'entityContainer',
  'entitySet',
  'singleton',
  'actionImport',
  'functionImport',
]);

/**
 * The tab that shows the element `id`: the element itself, its overload group, or else the closest
 * ancestor that has a tab (a property opens its type). Undefined when nothing in the model matches.
 */
export function openableTarget(
  { model, elements }: Resolved,
  id: string,
): { id: string; kind: ElementKind } | undefined {
  for (let path = id; path !== ''; path = path.slice(0, Math.max(path.lastIndexOf('/'), 0))) {
    const element = elements.get(path);
    if (element?.kind === 'action' || element?.kind === 'function') {
      return { id: overloadGroupId(path), kind: element.kind };
    }
    if (element && OPENABLE.has(element.kind)) return { id: path, kind: element.kind };
    const group = overloadGroupId(path);
    for (const schema of model.schemas) {
      if (!group.startsWith(`${schema.namespace}.`)) continue;
      const operation = [...schema.actions, ...schema.functions].find(
        (op) => overloadGroupId(op.id) === group,
      );
      if (operation) return { id: group, kind: operation.kind };
    }
  }
  return undefined;
}
