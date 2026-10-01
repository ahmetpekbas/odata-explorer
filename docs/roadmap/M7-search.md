# M7 — Search

[Roadmap](README.md) · [Plan](../PLAN.md)

- **Demo:** Ctrl+K opens any symbol.
- **Needs:** [M3](M3-load-pipeline.md), [M4](M4-shell-navigation.md)

- [x] **7.1 Search index.** Build `search-index.ts` in the worker: types, properties, navigation
  properties, sets, singletons, operations, terms, enum members, and annotation labels, each with its
  kind, target path, and label.
  *Done when:* index counts match the model for both fixtures.
- [x] **7.2 Ranking.** Exact > prefix > substring > fuzzy (uFuzzy), with kind filters.
  *Done when:* ranking tests pass, and a query on Graph-sized input answers in under 30 ms.
- [x] **7.3 Ctrl+K palette.** A Fluent Dialog with a search box and virtualized results, showing each
  result's kind and parent. Enter opens the result in a tab.
  *Done when:* it works from the keyboard alone, and results open the right tab.
