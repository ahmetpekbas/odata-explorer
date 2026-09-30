# OData Explorer

A browser app for exploring OData v4 `$metadata` documents: entity types, relationships, annotations
and operations, in friendly or technical detail. Everything runs client-side, so metadata never leaves
the browser.

Status: early development. See the [plan](docs/PLAN.md) and the [roadmap](docs/roadmap/README.md).

## Setup

Requires Node.js 20.19+ or 22.12+.

```
npm install
npx playwright install chromium   # browser for the end-to-end tests
```

## Develop

```
npm run dev      # dev server with hot reload on http://localhost:5173
npm run lint     # ESLint, then a Prettier check
npm run format   # apply Prettier formatting
```

## Test

```
npm test         # unit and component tests (Vitest)
npm run e2e      # end-to-end tests (Playwright) against the production build
```

`npm run e2e` builds the app and serves it from the `/sub/` path, the way a static host might.

## Build

```
npm run build    # type-check, then bundle into dist/
npm run preview  # serve dist/ on http://localhost:4173
```

## Deploy

`npm run build` produces a static bundle in `dist/` with no backend. Copy the contents of `dist/` to any
static web host (GitHub Pages, Azure Static Web Apps, S3, nginx, ...). Asset URLs are relative
(`base: './'` in `vite.config.ts`), so the app works from the domain root or from any subpath.
