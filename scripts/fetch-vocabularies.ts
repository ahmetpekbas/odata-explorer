// Downloads the OASIS standard vocabularies (XML and JSON) at a pinned commit into src/vocabularies/.
// Run with `npm run fetch:vocabularies`; to update, change COMMIT, rerun, and commit the result.
import { mkdir, writeFile } from 'node:fs/promises';

const COMMIT = '3e36ad2a4930a47feaf7a7cd0b78ed4f2bafcfb2';
const NAMES = [
  'Core',
  'Capabilities',
  'Measures',
  'Validation',
  'Aggregation',
  'Authorization',
  'JSON',
  'Repeatability',
  'Temporal',
];
const OUT = new URL('../src/vocabularies/', import.meta.url);

await mkdir(OUT, { recursive: true });
for (const name of NAMES) {
  for (const ext of ['xml', 'json']) {
    const file = `Org.OData.${name}.V1.${ext}`;
    const url = `https://raw.githubusercontent.com/oasis-tcs/odata-vocabularies/${COMMIT}/vocabularies/${file}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: ${res.status} ${res.statusText}`);
    // Normalize line endings so the committed files are the same on every platform.
    const text = (await res.text()).replace(/\r\n/g, '\n');
    await writeFile(new URL(file, OUT), text);
    console.log(`${file}  ${text.length} chars`);
  }
}
