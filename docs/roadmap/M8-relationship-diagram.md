# M8 — Relationship diagram

[Roadmap](README.md) · [Plan](../PLAN.md)

- **Demo:** An interactive neighborhood graph for any entity.
- **Needs:** [M3](M3-load-pipeline.md), [M4](M4-shell-navigation.md); task 8.4 also needs [M5](M5-detail-views.md)

- [ ] **8.1 Graph builder.** A pure function: neighborhood by hops (1–3), a partner pair merged into
  one edge, containment and inheritance edges, and a node cap (~150) that returns a "narrow it" hint.
  *Done when:* unit tests cover the TripPin neighborhoods and the cap.
- [ ] **8.2 Diagram tab.** Render with `@xyflow/react`: custom nodes showing the key and navigation
  properties, expandable to all properties, and edges labelled with cardinality.
  *Done when:* `Person` with 1 hop renders its connected types.
- [ ] **8.3 Layout worker.** Run elkjs in a worker, with the diagram and layout code in a lazy-loaded
  chunk.
  *Done when:* the layout doesn't block the main thread, and the chunk only loads when a diagram opens.
- [ ] **8.4 Controls and entry points.** Hops selector, inheritance toggle, show-all-properties toggle.
  Clicking a node opens its tab. Add a "Show relationships" button on entity and set views, and in the
  palette.
  *Done when:* the E2E flow of opening a diagram and clicking a node to open its tab passes.
