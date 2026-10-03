// Downloads the Microsoft Graph v1.0 and beta `$metadata` documents, the largest public CSDL documents,
// into the gitignored fixtures/large/. Run with `npm run fetch:perf`; `npm run bench` then measures them.
import { mkdir, stat, writeFile } from 'node:fs/promises';

const FILES = {
  'graph-v1.0.xml': 'https://graph.microsoft.com/v1.0/$metadata',
  'graph-beta.xml': 'https://graph.microsoft.com/beta/$metadata',
};
const OUT = new URL('../fixtures/large/', import.meta.url);

await mkdir(OUT, { recursive: true });
for (const [file, url] of Object.entries(FILES)) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  await writeFile(new URL(file, OUT), bytes);
  const { size } = await stat(new URL(file, OUT));
  console.log(`${file}  ${(size / 1e6).toFixed(2)} MB`);
}
