# M9 — Performance & release

[Roadmap](README.md) · [Plan](../PLAN.md)

- **Demo:** 10+ MB files load smoothly, E2E is green, v1.0.0 is tagged.
- **Needs:** M1–M8

- [ ] **9.1 Benchmark.** `fetch-perf-fixtures.ts` (Microsoft Graph v1.0 and beta, into
  `fixtures/large/`) and `bench-parse.ts` (MB/s per file). Record a baseline in `docs/PERF.md`. If no
  public file reaches 10 MB, check with the owner before adding a synthetic generator.
  *Done when:* `npm run bench` prints results for both files.
- [ ] **9.2 Hit the budget.** Profile and optimize until parse+resolve runs at 5 MB/s or more in Node,
  and no main-thread long task during load exceeds 200 ms.
  *Done when:* the benchmark meets the budget, and the long-task check passes.
- [ ] **9.3 E2E suite.** Playwright covers:
  - Load TripPin, open `Person`, check the property table.
  - Toggle Friendly/Technical.
  - Open the diagram and click a node.
  - Ctrl+K search.
  - Reload restores the recent file and its tabs.
  - A deep link opens the right tab.
  - Graph loads without freezing the UI.
  *Done when:* `npm run e2e` is green.
- [ ] **9.4 Keyboard and accessibility pass.** Every feature is reachable by keyboard, focus moves
  correctly when tabs and dialogs open and close, and the key shortcuts are documented.
  *Done when:* a keyboard-only walkthrough of the E2E flows succeeds.
- [ ] **9.5 Release.** Verify `npm run build` served from a subpath. Finish the README (features,
  screenshots, deploy to any static host). Tag `v1.0.0`.
  *Done when:* the built `dist/` works under `/sub/`, and the tag exists.
