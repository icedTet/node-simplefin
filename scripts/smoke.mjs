// Runtime smoke test: proves the built ESM bundle loads in Node/Bun/Deno
// without Node-only APIs. Run: node|bun|deno run scripts/smoke.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const distEsm = new URL('../dist/index.js', import.meta.url);
const mod = await import(distEsm.href);

assert.equal(mod.pkg.name, 'node-simplefin');
assert.equal(typeof mod.pkg.version, 'string');

const isDeno = typeof process !== 'undefined' && !!process.versions?.deno;
if (!isDeno) {
  const require = createRequire(import.meta.url);
  const cjs = require(new URL('../dist/index.cjs', distEsm).pathname);
  assert.equal(cjs.pkg.name, 'node-simplefin');
}

console.log('smoke ok:', mod.pkg.name, mod.pkg.version);
