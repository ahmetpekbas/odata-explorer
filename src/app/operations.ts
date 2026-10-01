// Actions and functions are overloaded, so their tab names a group of overloads (the ID without its
// signature). These helpers find a group's members and the imports that expose it.
import { overloadGroupId } from '../csdl/ids.ts';
import type { ActionImport, FunctionImport, Operation } from '../csdl/model.ts';
import type { Resolved } from '../csdl/resolve.ts';

/** The overloads of the action or function `groupId`, in document order. */
export function overloadsOf({ model }: Resolved, groupId: string): Operation[] {
  return model.schemas
    .flatMap((schema) => [...schema.actions, ...schema.functions])
    .filter((op) => overloadGroupId(op.id) === groupId);
}

/** The action or function imports that expose the operation `groupId`. */
export function importsOf(
  { model }: Resolved,
  kind: Operation['kind'],
  groupId: string,
): (ActionImport | FunctionImport)[] {
  return model.schemas.flatMap((schema) =>
    schema.entityContainers.flatMap((container): (ActionImport | FunctionImport)[] =>
      kind === 'action'
        ? container.actionImports.filter((i) => i.action === groupId)
        : container.functionImports.filter((i) => i.function === groupId),
    ),
  );
}
