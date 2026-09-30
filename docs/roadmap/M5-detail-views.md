# M5 — Detail views

[Roadmap](README.md) · [Plan](../PLAN.md)

- **Demo:** Every element kind has a friendly and a technical page.
- **Needs:** [M3](M3-load-pipeline.md), [M4](M4-shell-navigation.md)

- [ ] **5.1 Humanize and display helpers.** Write `humanize.ts`: friendly type strings ("Text (max
  100)", "List of Order", "Link to Customer (many)"). Add a label/description helper (`Core.Description`,
  `Core.LongDescription`, `Common.Label`, falling back to the name). Add the global Friendly/Technical
  toggle and a per-view override.
  *Done when:* unit tests cover every `Edm.*` primitive, collections, enums, and navigation.
- [ ] **5.2 Entity type: header and properties.** Label, description, key, and a virtualized property
  table, in both modes. Technical mode shows every facet, `Nullable`, abstract/open/`HasStream`.
  *Done when:* Dataverse-sized tables (500+ properties) scroll smoothly, and the toggle switches the
  columns.
- [ ] **5.3 Entity type: relationships.** "Links to" (navigation with cardinality, containment,
  referential constraints, `OnDelete`), base and derived types, and "Exposed as" (sets and singletons).
  Every reference opens its tab.
  *Done when:* TripPin `Person` shows `Friends` and `Trips`, and its derived type `Employee`.
- [ ] **5.4 Complex, enum, type definition, and term views.** Enum members with values and `IsFlags`.
  The underlying type and facets of a type definition. Each term's type, `AppliesTo`, and default.
  *Done when:* each view renders fixture examples in both modes.
- [ ] **5.5 Entity set, singleton, and container views.** The entity type link, the navigation bindings
  table, and a container overview (`Extends`, member lists).
  *Done when:* TripPin `People` shows its bindings.
- [ ] **5.6 Operation view.** Overloads grouped under one name, with parameters, the return type, the
  binding parameter, composability, `EntitySetPath`, and the imports that expose it.
  *Done when:* a bound function and an unbound action from the fixtures render correctly.
- [ ] **5.7 Schema overview.** Namespace, alias, counts per kind, and resolved/unresolved references.
  This is the default tab after loading a file.
  *Done when:* it shows correct counts for both fixtures.
