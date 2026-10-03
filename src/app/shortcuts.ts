// The keyboard shortcuts shown by the help dialog.
/** Every keyboard shortcut of the app. Keep in step with the README. */
export const SHORTCUTS: readonly {
  area: string;
  items: readonly (readonly [keys: string, action: string])[];
}[] = [
  {
    area: 'Anywhere',
    items: [
      ['Ctrl+K', 'Search every symbol of the model'],
      ['?', 'Show this list'],
      ['Tab / Shift+Tab', 'Move between the toolbar, navigator, tabs and views'],
    ],
  },
  {
    area: 'Search',
    items: [
      ['Up / Down, PageUp / PageDown', 'Move through the results'],
      ['Enter', 'Open the result'],
      ['Ctrl+Enter', 'Show the relationships of a type or set'],
      ['Esc', 'Close the search'],
    ],
  },
  {
    area: 'Navigator',
    items: [
      ['Up / Down', 'Move between elements'],
      ['Right / Left', 'Expand or collapse a group; move into or out of it'],
      ['Enter', 'Open the element'],
    ],
  },
  {
    area: 'Tabs',
    items: [
      ['Left / Right', 'Move between open tabs'],
      ['Enter', 'Keep a preview tab open'],
      ['Delete', 'Close the tab'],
      ['Menu key / Shift+F10', 'Open the tab menu'],
    ],
  },
  {
    area: 'Diagram',
    items: [
      ['Tab', 'Move between the nodes'],
      ['Enter', 'Open the type of the focused node'],
      ['Shift+Enter', 'Open it and keep the tab'],
    ],
  },
];
