# CLAUDE.md

Guidance for Claude Code when working in this repository.

`d:\dev\CLAUDE.md` in the parent directory describes an unrelated Python/ML project. It does not apply
here; ignore it.

## What this is

OData Explorer is a client-side browser app: the user drops an OData v4 `$metadata` document (CSDL XML
or CSDL JSON) and explores its entities, relationships, annotations and operations, friendly first and
technical on demand. There is no backend, and metadata never leaves the browser.

- [docs/PLAN.md](docs/PLAN.md) is the v1 design: architecture, model decisions, UX, and the reasons
  behind them. Read it before making structural changes.
- [docs/roadmap/](docs/roadmap/README.md) splits the plan into milestones and tasks. Each task has a
  **Done when** acceptance check.
- `protocol/` holds the OASIS OData v4.01 specs (HTML) and ABNF. Use them as the reference for CSDL
  semantics. They are read-only and excluded from lint and formatting.

## Commands

```
npm install
npm run dev       # Vite dev server
npm run build     # tsc -b && vite build -> dist/
npm run preview   # serve dist/
npm run lint      # eslint . && prettier --check .
npm run format    # prettier --write .
npm test          # vitest run
```

## Stack

Vite 8, React 19, TypeScript 6 (strict, `noUncheckedIndexedAccess`), Fluent UI React v9, ESLint flat
config with typescript-eslint type-checked rules, Prettier. TypeScript is pinned to `~6.0` because
typescript-eslint does not support TypeScript 7 yet.

Style with Fluent components, `makeStyles` and `tokens`, not hard-coded colors, so light and dark themes
both work. The theme preference (system/light/dark) lives in `src/app/theme.ts`.

## Architecture rules

- `src/csdl/` is pure TypeScript: no React, no DOM. It has to run in a Web Worker, in Vitest (Node), and
  in Node scripts.
- Every model element is identified by its CSDL target path (`NS.Customer`, `NS.Customer/Orders`,
  `NS.Container/Customers`, `NS.GetTop(NS.Customer)`). The same ID is used for annotation targets, tab
  IDs, URL hashes, and diagram nodes.
- XML and JSON parsers must produce the same model; their defaults differ (for example `Nullable`), so
  normalize in the JSON parser.
- Parsing is lenient: problems become diagnostics, and everything parseable still renders.

## Conventions

- One roadmap task per commit, with the task ID as the message prefix (`1.3: parse entity and complex
  types`). Tick the task's checkbox in its milestone file in the same commit.
- `npm run lint && npm test` must be green after every task.
- Prettier formats code and config; Markdown is excluded and kept as written, wrapped at about 105
  columns.
- Line endings are LF (`.gitattributes`), regardless of `core.autocrlf`.
