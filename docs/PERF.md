# Performance

[Plan](PLAN.md) · [Roadmap](roadmap/M9-performance-release.md)

## Budget

- Parse and resolve at **5 MB/s or more** in Node, about 3 s or less for a 15 MB file.
- No main-thread long task over **200 ms** while a file loads.

## Running the benchmark

```
npm run fetch:perf   # downloads Microsoft Graph v1.0 and beta $metadata into fixtures/large/ (gitignored)
npm run bench        # prints time and MB/s per file; exits non-zero below the budget
```

`bench-parse.ts` times the whole load pipeline (`src/worker/load.ts`: detect format, parse, resolve, build
the search index) on the text of each file, as the worker runs it. It does one warm-up run and reports the
median of five. It goes through a Vite server because the pipeline uses `import.meta.glob` for the bundled
vocabularies.

## Test files

No public CSDL document reaches 10 MB. The two largest are:

| File | Size |
|---|---|
| `graph-v1.0.xml` | 1.81 MB |
| `graph-beta.xml` | 3.94 MB |

MB/s is size-independent for a linear pipeline, so it is the figure to compare against the budget; the
10 MB case is projected from it (10 MB at 13 MB/s is about 0.8 s). A synthetic generator was deliberately
not added.

## Baseline

Taken 2026-10-03 on Windows 11, Node 24.17, before any optimization.

| File | Median time | Throughput |
|---|---|---|
| `graph-v1.0.xml` | 139 ms | 12.97 MB/s |
| `graph-beta.xml` | 296 ms | 13.29 MB/s |

Both are above the 5 MB/s budget by a wide margin.
