# OData Explorer

A browser app for exploring OData v4 `$metadata` documents: entity types, relationships, annotations
and operations, in friendly or technical detail. Everything runs client-side, so metadata never leaves
the browser.

Status: early development. See the [plan](docs/PLAN.md) and the [roadmap](docs/roadmap/README.md).

## Setup

Requires Node.js 20.19+ or 22.12+.

```
npm install
```

## Develop

```
npm run dev      # dev server with hot reload on http://localhost:5173
npm run lint     # ESLint, then a Prettier check
npm run format   # apply Prettier formatting
```

## Test

```
npm test         # unit tests (Vitest)
```

## Build

```
npm run build    # type-check, then bundle into dist/
npm run preview  # serve dist/ on http://localhost:4173
```

## Deploy

`npm run build` produces a static bundle in `dist/` with no backend. Copy the contents of `dist/` to any
static web host (GitHub Pages, Azure Static Web Apps, S3, nginx, ...).
