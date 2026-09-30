# M4 — Shell & navigation

[Roadmap](README.md) · [Plan](../PLAN.md)

- **Demo:** Browse the tree, open tabs, deep-link to a page.
- **Needs:** [M3](M3-load-pipeline.md)

- [x] **4.1 Three-pane layout.** Navigator | workspace | inspector with `react-resizable-panels`. The
  inspector can collapse, and the pane sizes persist.
  *Done when:* resizing and collapsing survive a reload.
- [x] **4.2 Navigator data.** Build the tree model: per schema (entity types, complex types, enums,
  type definitions, terms, actions, functions), plus the container (sets, singletons, imports). Add a
  "hide vocabulary schemas" toggle, on by default.
  *Done when:* unit tests check TripPin's tree shape.
- [x] **4.3 Navigator UI.** Fluent `FlatTree` items rendered through `@tanstack/react-virtual`, with an
  in-place filter and keyboard navigation.
  *Done when:* a list of 5,000 nodes scrolls smoothly, the filter narrows it, and the arrow keys work.
- [x] **4.4 Tab workspace.** A single click opens a preview tab and a double-click pins it. Middle-click
  closes a tab, and "Close others" is available. Tabs that don't fit go into an overflow menu. Each tab
  kind shows a placeholder view for now.
  *Done when:* preview replacement and pinning behave like VS Code.
- [x] **4.5 Hash routing.** The active tab syncs with `#/d/<docId>/<kind>/<targetPath>`. Back/forward
  work, and opening a deep link opens its tab. Diagnostics entries now navigate to their element.
  *Done when:* a pasted URL for a TripPin element opens the right tab.
- [x] **4.6 Per-file tab restore.** Save the open tabs with the recent file and restore them when it's
  reopened.
  *Done when:* after a reload the same tabs reopen and the same one is active.
