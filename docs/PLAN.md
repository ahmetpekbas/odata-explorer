# OData Explorer — v1 plan

## Context

`d:\dev\odata-explorer` is greenfield: a README, a .NET-template `.gitignore`, and the OASIS OData
v4.01 specs under `protocol/` (CSDL XML, CSDL JSON, vocabularies, protocol, URL conventions). The goal
is a tool where a user supplies an OData `$metadata` document and explores its entities and everything
around them in a friendly way, with technical depth available on demand.

Decisions from the interview:

| Topic | Decision |
|---|---|
| Form | Client-side browser app, deployable to any static web host |
| Formats | CSDL XML v4.0/4.01, CSDL JSON v4.01, `edmx:Reference` resolution |
| Users | Both devs and analysts → progressive detail (friendly first, technical on demand) |
| Scale | Dataverse-scale, 10+ MB documents |
| Stack | TypeScript + React + Vite |
| UI kit | Fluent UI React v9 |
| v1 features | Entity browsing + relationship diagram + vocabulary-aware annotations + container & operations + raw source view |
| Input | File pick / drag-and-drop only |
| References | Bundle the standard OASIS vocabularies |
| Layout | Tabbed workspace |
| Persistence | Recent files in IndexedDB |
| Hosting | Portable static bundle, host decided later |
| Test data | Public samples |
| Roadmap (not v1, but architecture must allow) | Diff, export docs, query URL builder, model lint |

Note: `d:\dev\CLAUDE.md` describes an unrelated Python/ML project and is ignored here. A project-level
`CLAUDE.md` gets added (step 1) so future sessions get the right context.

## Architecture

Single Vite app (no monorepo). The CSDL core is framework-free and DOM-free, so it runs in a Web Worker,
in Vitest, and in Node benchmark scripts.

```
src/
  csdl/                  # pure TS, no React/DOM
    model.ts             # normalized model types
    parse-xml.ts         # streaming SAX parse (saxes) -> model + source spans
    parse-json.ts        # CSDL JSON -> same model, defaults normalized
    resolve.ts           # aliases, references, inheritance, partners, annotation targets
    annotations.ts       # expression model + term-aware summarizers
    humanize.ts          # friendly type strings ("Text (max 100)", "List of Order")
    search-index.ts      # symbol index for the palette/navigator filter
    diagnostics.ts       # non-fatal issues collected during parse/resolve
  vocabularies/          # pinned OASIS vocab XML files (Core, Capabilities, Measures, Validation,
                         #   Aggregation, Authorization, JSON, Repeatability, Temporal)
  worker/parser.worker.ts  # detect format -> parse -> resolve -> index; exposed via Comlink
  app/
    store.ts             # zustand: documents (map, v1 shows one), tabs, selection, detail mode
    persistence.ts       # IndexedDB recent files (idb)
    routing.ts           # hash routes: #/d/<docId>/<kind>/<targetPath>
  ui/
    shell/               # Toolbar, DropZone/Start page, RecentFiles, DiagnosticsPanel, CommandPalette
    navigator/           # virtualized tree (Fluent FlatTree items + @tanstack/react-virtual)
    workspace/           # tab strip (preview vs pinned tabs, close, overflow) + tab host
    views/               # EntityType, ComplexType, EnumType, TypeDefinition, Term, EntitySet,
                         #   Singleton, Operation (overload group), Container, Schema overview
    inspector/           # AnnotationsPanel, SourcePanel
    diagram/             # RelationshipDiagram (@xyflow/react + elkjs, lazy-loaded chunk)
scripts/
  fetch-vocabularies.ts  # pulls vocab XML from oasis-tcs/odata-vocabularies at a pinned commit
  fetch-perf-fixtures.ts # downloads Microsoft Graph v1.0 + beta $metadata into fixtures/large/ (gitignored)
  bench-parse.ts         # Node benchmark: parse+resolve time and MB/s per fixture
fixtures/                # small committed samples (see Testing)
```

### Core model decisions

- **One ID scheme everywhere: CSDL target paths.** For example `NS.Customer`, `NS.Customer/Orders`,
  `NS.Container/Customers`, `NS.GetTop(NS.Customer)` for overloads, and `NS.Color/Red`. This is the syntax
  `Annotations Target` already uses, so the same ID serves annotation attachment, tab IDs, URL hashes,
  diagram nodes, and later diff keys and lint locations.
- **Aliases are resolved to full namespaces at parse time.** Every type reference is stored qualified,
  and the original text is kept for the source view.
- **XML and JSON produce the same model.** The two formats have different defaults: XML `Nullable`
  defaults to true, while JSON `$Nullable` defaults to false; `$Type` defaults to `Edm.String`; action and
  function overloads are arrays in JSON; annotations are `@Term#Qualifier` keys. `parse-json.ts`
  normalizes all of these.
- **Resolver outputs:** base-type chains, a derived-types index, merged key (inherited), inverse navigation
  (via `Partner`), which entity sets and singletons expose each type, navigation-property bindings, and
  annotations. Annotations are merged from inline and external `<Annotations Target>` blocks, and each one
  records its origin and qualifier.
- **References:** an `edmx:Reference`/`edmx:Include` that matches a bundled vocabulary namespace resolves
  offline. Anything else becomes an "unresolved reference" diagnostic. Types from that namespace render
  as unresolved and do not crash anything.
- **Lenient parsing:** errors become diagnostics shown in a panel, and everything parseable still
  renders. OData v2/v3 EDMX (the old `schemas.microsoft.com/ado` namespaces) gets a clear "v2/v3 not
  supported" message. DOCTYPE and entities are not expanded.
- **Source spans:** for XML, saxes records a start/end offset per element, and the source panel slices
  the original text. For JSON, `JSON.parse` has no positions, so the panel shows the element's JSON
  subtree, pretty-printed. The content is exact but the formatting may differ from the file; this is
  documented.

### Performance (10+ MB target)

- Parsing, resolving, and search-index building all happen in the worker, so the UI never blocks. The
  worker reports progress by bytes processed.
- The finished model goes to the main thread once, via structured clone. The raw text stays on the main
  thread for the source view and IndexedDB.
- Long lists are virtualized: the navigator, property tables with 500+ properties (Dataverse `account`),
  the palette results, and the annotation lists.
- The diagram only shows a neighborhood (1–3 hops) and is capped at about 150 nodes, with a "too many,
  narrow it" hint above that. Layout runs through elkjs in its own worker, and the diagram chunk is
  lazy-loaded.
- Budget, checked by `bench-parse.ts`: parse and resolve at 5 MB/s or more in Node, which means about
  3 s or less for a 15 MB file.

### UX

- **Start page:** a drop zone and file picker, plus a list of recent files (name, size, format, last
  opened). Each can be forgotten individually, or all at once. The page states "Stored only in this
  browser".
- **Shell:** three resizable panes (`react-resizable-panels`): navigator | tabbed workspace | inspector.
  The inspector can be collapsed.
- **Navigator:** grouped per schema (Entity Types, Complex Types, Enums, Type Definitions, Terms,
  Actions, Functions) plus the Entity Container (Entity Sets, Singletons, Action/Function Imports).
  It has an in-place filter box and a "hide vocabulary schemas" toggle, which is on by default.
- **Tabs:** they work like VS Code. A single click opens a *preview* tab that the next click replaces;
  double-clicking or interacting with it pins it. Middle-click closes a tab, and "Close others" is
  available. The open tabs are saved per recent file. The active tab drives the URL hash, so browser
  back/forward works.
- **Progressive detail:** a global Friendly/Technical toggle in the toolbar, which each view can
  override. For example, the entity view shows:
  - **Friendly:** label and description from `Core.Description`, `Core.LongDescription`, or
    `Common.Label`, falling back to the name. It also shows the key, a property table (name/label,
    humanized type, required, description), a "Links to" list of navigation properties with
    cardinality, "Exposed as" entity sets with capability badges (insertable/updatable/deletable/
    filterable), and base/derived types.
  - **Technical:** everything above plus raw types and all facets (MaxLength, Precision, Scale, SRID,
    Unicode, DefaultValue), Nullable, abstract/open/HasStream, containment, referential constraints,
    OnDelete, and annotation term names with qualifiers.
- **Annotations inspector:** has renderers for the high-value terms, currently Core
  (Description/LongDescription, Computed, Immutable, Permissions, OptimisticConcurrency), Capabilities
  (the Insert/Update/Delete/Filter/Sort/Search/Expand/Count/Navigation restrictions, TopSupported and
  SkipSupported), Validation (AllowedValues, Minimum/Maximum, Pattern), and Measures (ISOCurrency, Unit).
  Any other term uses a generic record/collection/value tree. Term tooltips come from the bundled
  vocabulary's own `Core.Description`. Dynamic expressions (Path, If, Apply, ...) are shown as readable
  expressions.
- **Source panel:** a read-only CodeMirror 6 view of the element's fragment. Qualified type names in it
  are clickable and open that type in a tab.
- **Ctrl+K palette:** searches types, properties, navigation properties, entity sets, singletons,
  operations, terms, enum members, and annotation labels. Results are ranked exact > prefix > substring
  > fuzzy (uFuzzy) and filterable by kind.
- **Diagram tab:** opened from any entity ("Show relationships"). Nodes show the key and navigation
  properties, and can expand to all properties. Edges are labelled with cardinality (1, 0..1, *). A
  navigation property and its partner merge into one edge, containment gets a marker, and inheritance
  is shown dashed. Clicking a node opens its tab.
- Light and dark themes follow the system setting (Fluent `webLightTheme`/`webDarkTheme`), with a manual
  override.
- Known limitation: Dataverse `$metadata` has few label annotations, so friendly mode mostly shows
  names there. That comes from the input data, not the tool.

### Hosting

Vite `base: './'` and hash routing, so `dist/` works on any static host, under a subpath, or opened
locally through `vite preview`. There is no backend, and metadata never leaves the browser.

### Roadmap hooks (not built in v1)

- **Diff:** the store already holds multiple documents, and target-path IDs give stable keys.
- **Lint:** `diagnostics.ts` is already the sink for issues.
- **Export:** the model is UI-independent.
- **URL builder:** entity sets, navigation bindings, and Capabilities restrictions are already resolved.

## Implementation steps

1. **Scaffold.** Vite + React + TS (strict), Fluent UI v9 provider, zustand, ESLint + Prettier, Vitest,
   and Playwright. Replace the .NET `.gitignore` with a Node one (`node_modules`, `dist`, `coverage`,
   `playwright-report`, `test-results`, `fixtures/large/`). Add a project `CLAUDE.md` and a README
   covering setup, dev, test, build, and deploy.
2. **CSDL core.** `model.ts`, `parse-xml.ts`, `parse-json.ts`, `resolve.ts`, `humanize.ts`,
   `annotations.ts`, and `diagnostics.ts`. Add `fetch-vocabularies.ts` and commit the pinned vocab files.
   Unit and parity tests (see Testing).
3. **Worker + load flow.** Format detection (first non-whitespace `<` vs `{`), progress, the diagnostics
   panel, and IndexedDB recent files.
4. **Shell.** The panes, navigator, tabs (preview/pinned), hash routing, and theme.
5. **Views.** All type views, the container, entity sets and singletons, operations with their
   overloads, and the schema overview (counts), each with the friendly and technical modes.
6. **Inspector.** The annotations panel with its term renderers, and the source panel with clickable
   references.
7. **Command palette.** Plus the search index built in the worker.
8. **Diagram tab.**
9. **Performance pass and E2E.** Add `fetch-perf-fixtures.ts` and `bench-parse.ts`, profile with the
   large Graph documents, write the Playwright specs, and verify the production build.

## Testing

- **Committed fixtures** (small, public):
  - TripPin v4 `$metadata` and Northwind v4 `$metadata` from services.odata.org.
  - The OASIS vocabularies in **both XML and JSON**.
  - The example documents from `oasis-tcs/odata-csdl-schemas`, also in both formats.
  - Sources and licenses are recorded in `fixtures/README.md`.
- **Vitest:**
  - XML and JSON parsers.
  - An **XML↔JSON parity test**: the same document in both formats must produce a deep-equal model,
    which catches default-normalization bugs.
  - Resolver: alias resolution, inherited keys, partners, external annotation targets including
    overload targets, and unresolved references becoming diagnostics.
  - Humanized type strings.
  - v2/v3 rejection.
- **Performance:** `npm run fetch:perf` downloads Microsoft Graph v1.0 and beta `$metadata`, the largest
  public CSDL documents, into the gitignored `fixtures/large/`. `npm run bench` reports MB/s against the
  5 MB/s budget. If none of the public documents reaches 10 MB, the MB/s figure is scaled to project the
  10+ MB case; I'll check with you before adding a synthetic generator.
- **Playwright E2E:**
  - Drop TripPin, open `Person`, check the property table.
  - Toggle friendly/technical mode.
  - Open the diagram and click a node to open a tab.
  - Search with Ctrl+K and jump to a result.
  - Reload the page: the recent file and its tabs are restored, and the hash deep-link works.
  - Load a Graph document without the UI freezing (no long task over 200 ms on the main thread during
    load).

## Verification

1. `npm run lint && npm test`: unit and parity tests are green.
2. `npm run fetch:perf && npm run bench`: throughput meets the budget on the Graph beta document.
3. `npm run dev`, then walk through by hand:
   - Drop TripPin XML and a CSDL JSON vocabulary file.
   - Browse the entities, operations, container, annotations, source, and diagram.
   - Check the Ctrl+K palette and the friendly/technical toggle.
   - Load the large Graph document and confirm progress is shown and the UI stays responsive.
4. `npm run build && npx vite preview --base /sub/`: the app works when served from a subpath (the
   static-host check).
5. `npm run e2e`: the Playwright suite is green.
