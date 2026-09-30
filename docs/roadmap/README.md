# OData Explorer — Roadmap

This roadmap splits [PLAN.md](../PLAN.md) into tasks that can each be finished in one sitting. There is
one file per milestone. See the plan for the architecture and the reasons behind each decision.

## How to use this roadmap

- **Task size:** half a day to one day. A task includes its tests and leaves `npm run lint && npm test`
  green.
- **One task, one commit (or PR).** Put the task ID in the commit message, e.g. `1.3: parse entity and
  complex types`.
- **Done when** is the acceptance check. A task isn't finished until that check passes.
- **Track progress** by ticking the checkboxes in the milestone files.
- **Order:** M0–M4 run in sequence. M5–M8 need only M3 and M4, so they can overlap. The **Needs** line
  at the top of each milestone file names any extra dependency.

## Milestones

| # | Milestone | You can demo | Tasks |
|---|---|---|---|
| M0 | [Foundations](M0-foundations.md) | An empty app, themed, building and testing | 4 |
| M1 | [CSDL core (XML)](M1-csdl-core-xml.md) | Tests parse and resolve TripPin and Northwind into a full model | 10 |
| M2 | [CSDL JSON](M2-csdl-json.md) | JSON and XML versions of the same document produce the same model | 3 |
| M3 | [Load pipeline & persistence](M3-load-pipeline.md) | A dropped file gets parsed in the background, shows its problems, and is remembered | 5 |
| M4 | [Shell & navigation](M4-shell-navigation.md) | Browse the tree, open tabs, deep-link to a page | 6 |
| M5 | [Detail views](M5-detail-views.md) | Every element kind has a friendly and a technical page | 7 |
| M6 | [Annotations & source](M6-annotations-source.md) | Readable annotations, capability badges, source fragments | 6 |
| M7 | [Search](M7-search.md) | Ctrl+K opens any symbol | 3 |
| M8 | [Relationship diagram](M8-relationship-diagram.md) | An interactive neighborhood graph for any entity | 4 |
| M9 | [Performance & release](M9-performance-release.md) | 10+ MB files load smoothly, E2E is green, v1.0.0 is tagged | 5 |

## Post-v1

These are ordered by increasing effort. Each one builds on data v1 already produces.

| # | Item | Tasks |
|---|---|---|
| R1 | [Model lint](R1-model-lint.md) | 3 |
| R2 | [Export documentation](R2-export-documentation.md) | 3 |
| R3 | [Diff two metadata versions](R3-diff.md) | 3 |
| R4 | [Query URL builder](R4-query-url-builder.md) | 4 |
