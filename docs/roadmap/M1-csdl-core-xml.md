# M1 — CSDL core (XML)

[Roadmap](README.md) · [Plan](../PLAN.md)

- **Demo:** Tests parse and resolve TripPin and Northwind into a full model.
- **Needs:** [M0](M0-foundations.md)

Everything in `src/csdl/` is pure TypeScript, with no DOM and no React.

- [x] **1.1 Model types.** Write `model.ts`: every element kind, facets, annotations with expressions,
  source spans, and diagnostics. Add helpers that build target-path IDs (`NS.T`, `NS.T/Prop`,
  `NS.Container/Set`, `NS.Fn(NS.Binding)`).
  *Done when:* the types compile, and the ID helpers are unit-tested, overload IDs included.
- [x] **1.2 Fixtures.** Commit the TripPin and Northwind v4 `$metadata` files, and record their sources
  and licenses in `fixtures/README.md`.
  *Done when:* both files are committed and attributed.
- [x] **1.3 XML parser: types.** Stream-parse with saxes: `Edmx`, `Reference`/`Include`,
  `DataServices`, `Schema` (with `Alias`), `EntityType`, `ComplexType`, `EnumType`/`Member`,
  `TypeDefinition`, `Property` with all facets, `NavigationProperty` (with `ReferentialConstraint` and
  `OnDelete`), and `Key`/`PropertyRef`.
  *Done when:* snapshot tests give the expected type and property counts for both fixtures.
- [x] **1.4 XML parser: container and operations.** Parse `EntityContainer` (`Extends`), `EntitySet`,
  `Singleton`, `NavigationPropertyBinding`, `ActionImport`/`FunctionImport`, `Action`/`Function`
  (`IsBound`, `IsComposable`, `EntitySetPath`), `Parameter`, `ReturnType`, and `Term`.
  *Done when:* the TripPin container and operations match expectations in tests.
- [x] **1.5 XML parser: annotations.** Parse inline `Annotation` and external `Annotations Target` blocks.
  Handle constant expressions in both attribute and element form, and every dynamic expression (`Path`
  variants, `Record`/`PropertyValue`, `Collection`, `Apply`, `If`, logical and comparison operators,
  `Cast`, `IsOf`, `LabeledElement(Reference)`, `Null`, `UrlRef`).
  *Done when:* a hand-written fixture with one example of every expression form parses correctly.
- [x] **1.6 Spans, diagnostics, guards.**
  - Record start and end offsets for each element.
  - Report malformed XML as a diagnostic with line and column, and keep going where possible.
  - Detect v2/v3 EDMX and report "not supported".
  - Refuse DOCTYPE and entity declarations.
  *Done when:* each case has a test, and every span in the TripPin output slices back to the exact
  source text.
- [ ] **1.7 Resolver: names.** Resolve aliases to namespaces, qualify every type reference, and handle
  `Collection(...)` and `Edm.*` primitives. Unresolved references become diagnostics.
  *Done when:* tests cover an alias-heavy fixture and an unresolved-type fixture.
- [ ] **1.8 Resolver: structure.**
  - Base-type chains, inherited keys and properties, and a derived-types index.
  - Inverse navigation via `Partner`.
  - Which entity sets and singletons expose each type, and navigation bindings per set.
  *Done when:* the TripPin inheritance (`Person`/`Employee`) and the partner pairs resolve in tests.
- [ ] **1.9 Resolver: annotation attachment.** Attach inline and external annotations to their target
  path, keeping the qualifier and the origin. Support overload and nested targets.
  *Done when:* tests cover external targets on a property, a set, an overload, and a qualified
  annotation.
- [ ] **1.10 Bundled vocabularies.** `scripts/fetch-vocabularies.ts` pulls the OASIS vocabulary XML
  (Core, Capabilities, Measures, Validation, Aggregation, Authorization, JSON, Repeatability, Temporal) at
  a pinned commit into `src/vocabularies/`. `edmx:Reference`s resolve against the bundle, and term
  definitions can be looked up.
  *Done when:* a fixture that references Core resolves it offline, and `Core.Description` looks up to
  its definition.
