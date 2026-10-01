# M6 — Annotations & source

[Roadmap](README.md) · [Plan](../PLAN.md)

- **Demo:** Readable annotations, capability badges, source fragments.
- **Needs:** [M3](M3-load-pipeline.md), [M4](M4-shell-navigation.md); task 6.4 also needs [M5](M5-detail-views.md)

- [x] **6.1 Expression rendering.** `annotations.ts` turns dynamic expressions into readable text
  (`$filter`-like syntax for `Apply` and logic, path notation). Add a generic record/collection/value
  tree renderer.
  *Done when:* every expression from the 1.5 fixture renders, with snapshot tests.
- [x] **6.2 Term summarizers.** Summaries for Core (Description, LongDescription, Computed, Immutable,
  Permissions, OptimisticConcurrency), Capabilities (the Insert, Update, Delete, Filter, Sort, Search,
  Expand, Count, and Navigation restrictions; TopSupported and SkipSupported), Validation (AllowedValues,
  Minimum, Maximum, Pattern), and Measures (ISOCurrency, Unit).
  *Done when:* each summarizer has unit tests, including the "absent means default" cases.
- [ ] **6.3 Annotations inspector.** Groups annotations by vocabulary and shows each one's qualifier
  and origin (inline or external). Term tooltips come from the bundled vocabulary definitions. The
  panel follows the active tab and the selected row.
  *Done when:* selecting a property shows its annotations, including external ones.
- [ ] **6.4 Wire annotations into views.** Capability badges on sets and "Exposed as". Validation hints
  (allowed values, min/max) and Computed/Immutable markers in property tables.
  *Done when:* a fixture with restrictions shows the correct badges.
- [ ] **6.5 Source panel.** A read-only CodeMirror 6 view in a lazy-loaded chunk, with XML/JSON
  highlighting. It shows the fragment from the span (XML) or the re-serialized subtree (JSON).
  *Done when:* the source follows the selection and the chunk only loads when the panel opens.
- [ ] **6.6 Jump-to-definition.** Qualified names in the source are clickable and open that element's
  tab.
  *Done when:* clicking `Type="NS.Trip"` opens `Trip`.
