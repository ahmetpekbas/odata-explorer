// Measures the load pipeline (detect, parse, resolve, index) in Node on every file in fixtures/large/.
// Run with `npm run bench` after `npm run fetch:perf`. The pipeline imports Vite-only modules
// (`import.meta.glob`), so it is loaded through a Vite server rather than plain Node.
import { readdir, readFile } from 'node:fs/promises';
import { createServer } from 'vite';

/** Throughput that `docs/PLAN.md` commits to, in MB of input per second. */
const BUDGET_MB_PER_S = 5;
const RUNS = 5;

interface LoadModule {
  load: (text: string) => { ok: true } | { ok: false; error: string };
}

const DIR = new URL('../fixtures/large/', import.meta.url);
const files = (await readdir(DIR).catch(() => [])).filter((f) => /\.(xml|json)$/.test(f)).sort();
if (files.length === 0) {
  console.error('No files in fixtures/large/. Run `npm run fetch:perf` first.');
  process.exit(1);
}

const server = await createServer({
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
});
let failed = false;
try {
  const { load } = (await server.ssrLoadModule('/src/worker/load.ts')) as LoadModule;
  console.log(
    `load pipeline, median of ${RUNS} runs after one warm-up (budget ${BUDGET_MB_PER_S} MB/s)`,
  );
  for (const file of files) {
    const text = await readFile(new URL(file, DIR), 'utf8');
    const mb = Buffer.byteLength(text) / 1e6;
    const times: number[] = [];
    for (let i = 0; i <= RUNS; i++) {
      const start = performance.now();
      const result = load(text);
      const ms = performance.now() - start;
      if (!result.ok) throw new Error(`${file}: ${result.error}`);
      if (i > 0) times.push(ms);
    }
    times.sort((a, b) => a - b);
    const median = times[Math.floor(times.length / 2)] ?? 0;
    const rate = mb / (median / 1000);
    const verdict = rate >= BUDGET_MB_PER_S ? 'ok' : 'BELOW BUDGET';
    failed ||= rate < BUDGET_MB_PER_S;
    console.log(
      `${file.padEnd(18)} ${mb.toFixed(2).padStart(6)} MB  ${median.toFixed(0).padStart(6)} ms  ` +
        `${rate.toFixed(2).padStart(6)} MB/s  ${verdict}`,
    );
  }
} finally {
  await server.close();
}
if (failed) process.exitCode = 1;
