// A diagram tab shows the relationships of one type. Its ID is the type's ID with a prefix, so it can sit
// next to the type's own tab and still be a plain target path in URLs.
import type { Resolved } from '../csdl/resolve.ts';

const PREFIX = 'diagram:';

export const diagramTab = (typeId: string) => ({ id: PREFIX + typeId, kind: 'diagram' as const });

/** The ID of the type a diagram tab shows, or undefined for any other tab ID. */
export const diagramTypeOf = (tabId: string) =>
  tabId.startsWith(PREFIX) ? tabId.slice(PREFIX.length) : undefined;

export interface DiagramOptions {
  /** How many links away from the type the diagram reaches, 1 to 3. */
  hops: number;
  /** Whether base and derived types are part of the neighborhood. */
  inheritance: boolean;
  /** Whether nodes list every property, not only the key and the navigation properties. */
  showAll: boolean;
}

export const DEFAULT_DIAGRAM_OPTIONS: DiagramOptions = {
  hops: 1,
  inheritance: true,
  showAll: false,
};

/**
 * The type whose relationships the element `id` stands for: a type itself, or the type of an entity set
 * or singleton. Undefined for anything else.
 */
export function diagramTypeFor({ elements, types }: Resolved, id: string): string | undefined {
  const element = elements.get(id);
  const typeId =
    element?.kind === 'entitySet'
      ? element.entityType.name
      : element?.kind === 'singleton'
        ? element.type.name
        : id;
  return types.has(typeId) ? typeId : undefined;
}
