// Runtime smoke test: proves the built ESM bundle loads in Node/Bun/Deno
// without Node-only APIs. Run: node|bun|deno run scripts/smoke.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const mod = await import(new URL('../dist/index.js', import.meta.url).href);

assert.equal(mod.pkg.name, 'node-simplefin');
assert.equal(typeof mod.pkg.version, 'string');

if (!('Deno' in globalThis)) {
  const require = createRequire(import.meta.url);
  const cjs = require(fileURLToPath(new URL('../dist/index.cjs', import.meta.url)));
  assert.equal(cjs.pkg.name, 'node-simplefin');
}

console.log('smoke ok:', mod.pkg.name, mod.pkg.version);
