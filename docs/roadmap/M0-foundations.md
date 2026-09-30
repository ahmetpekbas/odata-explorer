# M0 — Foundations

[Roadmap](README.md) · [Plan](../PLAN.md)

- **Demo:** An empty app, themed, building and testing.
- **Needs:** nothing

- [x] **0.1 Scaffold the app.** Vite + React + TypeScript (strict), plus npm scripts for `dev`, `build`,
  `preview`, `lint`, `format`, `test`, and `e2e`. Set up ESLint and Prettier.
  *Done when:* `npm run dev` shows a placeholder page, and `lint` and `build` pass.
- [x] **0.2 Repo hygiene.** Replace the .NET `.gitignore` with a Node one (`node_modules`, `dist`,
  `coverage`, `playwright-report`, `test-results`, `fixtures/large/`). Add a project `CLAUDE.md`, and a
  README skeleton covering setup, dev, test, build, and deploy.
  *Done when:* `git status` is clean after install and build, and the README commands work as written.
- [x] **0.3 Fluent UI and theming.** Wrap the app in `FluentProvider`, using light/dark from the system
  setting. Add a manual override, persisted in `localStorage`.
  *Done when:* the theme follows the OS setting, and the toggle survives a reload.
- [ ] **0.4 Test harnesses.** Configure Vitest with a Node environment for `src/csdl` and jsdom for the
  UI. Configure Playwright with one smoke test. Set Vite `base: './'`.
  *Done when:* `npm test` and `npm run e2e` each run at least one passing test.
