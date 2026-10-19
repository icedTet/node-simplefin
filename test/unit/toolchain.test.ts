import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  name: string;
  version: string;
  type?: string;
  main?: string;
  module?: string;
  types?: string;
  files?: string[];
  engines?: Record<string, string>;
  exports: {
    '.': {
      import: { types: string; default: string };
      require: { types: string; default: string };
      default?: string;
    };
  };
}

const pkgUrl = new URL('../../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8')) as PackageJson;
const root = pkg.exports['.'];

describe('package wiring', () => {
  it('nests types per module-format condition so d.cts is reachable (no TS1471)', () => {
    expect(root.import).toEqual({
      types: './dist/index.d.ts',
      default: './dist/index.js',
    });
    expect(root.require).toEqual({
      types: './dist/index.d.cts',
      default: './dist/index.cjs',
    });
    expect(root.default).toBe(root.import.default);
  });

  it('keeps legacy fields consistent with the nested conditions', () => {
    expect(pkg.main).toBe(root.require.default);
    expect(pkg.module).toBe(root.import.default);
    expect(pkg.types).toBe(root.import.types);
    expect(pkg.type).toBe('module');
  });

  it('ships only built artifacts plus docs', () => {
    expect(pkg.files).toEqual(expect.arrayContaining(['dist', 'LICENSE', 'README.md']));
    expect(pkg.files).not.toContain('src');
  });

  it('requires a fetch-capable, non-EOL Node', () => {
    expect(pkg.engines?.node).toMatch(/^>=\s*22/);
  });

  const distPresent = existsSync(fileURLToPath(new URL('./dist/index.js', pkgUrl)));
  it.runIf(distPresent)('points exports at dist artifacts produced by the build', () => {
    for (const target of [
      root.import.default,
      root.import.types,
      root.require.default,
      root.require.types,
    ]) {
      expect(existsSync(fileURLToPath(new URL(target, pkgUrl))), `${target} missing`).toBe(true);
    }
  });
});

describe('fixtures provenance', () => {
  it('every recorded fixture carries a meta sidecar', () => {
    const dir = new URL('../fixtures/', import.meta.url);
    const files = readdirSync(fileURLToPath(dir));
    for (const file of files.filter((f) => f.endsWith('.json') && !f.endsWith('.meta.json'))) {
      expect(
        existsSync(new URL(file.replace('.json', '.meta.json'), dir)),
        `${file} lacks meta`,
      ).toBe(true);
    }
  });
});
