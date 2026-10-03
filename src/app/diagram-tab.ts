// A diagram tab shows the relationships of one type. Its ID is the type's ID with a prefix, so it can sit
// next to the type's own tab and still be a plain target path in URLs.
const PREFIX = 'diagram:';

export const diagramTab = (typeId: string) => ({ id: PREFIX + typeId, kind: 'diagram' as const });

/** The ID of the type a diagram tab shows, or undefined for any other tab ID. */
export const diagramTypeOf = (tabId: string) =>
  tabId.startsWith(PREFIX) ? tabId.slice(PREFIX.length) : undefined;
