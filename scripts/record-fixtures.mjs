// Records hermetic fixtures from the public demo bridge (read-only GETs, opt-in).
// Usage: node scripts/record-fixtures.mjs   (needs network; never run in CI)
// Provenance notes land in test/fixtures/*.meta.json per AGENTS.md.
import { writeFile } from 'node:fs/promises';

const ACCESS = 'https://demo:demo@beta-bridge.simplefin.org/simplefin';
const ROOT = new URL('../test/fixtures/', import.meta.url);
const start = Math.floor(Date.now() / 1000) - 40 * 86400;
// Raw capture intentionally bypasses the SDK (fixtures are ground truth, not output).
const url = new URL(ACCESS);
const auth = 'Basic ' + btoa(`${url.username}:${url.password}`);
url.username = url.password = '';

async function get(query, file) {
  const response = await fetch(`${url.href}/accounts?${query}`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  });
  if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
  const body = await response.text();
  await writeFile(new URL(file, ROOT), body + '\n');
  await writeFile(
    new URL(file.replace('.json', '.meta.json'), ROOT),
    JSON.stringify(
      {
        recorded: new Date().toISOString(),
        url: `${ACCESS}/accounts?${query}`,
        via: 'scripts/record-fixtures.mjs',
      },
      null,
      2,
    ) + '\n',
  );
  console.log('recorded', file);
}

await get('version=1&start-date=' + start, 'v1-demo.json');
await get('version=2&start-date=' + start, 'v2-demo.json');
await get('version=1', 'v1-demo-no-start-date.json');
