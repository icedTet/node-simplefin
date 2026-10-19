import { existsSync, readFileSync } from 'node:fs';
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
    '.': { import: string; require: string; types: string; default?: string };
  };
}

const pkgUrl = new URL('../../package.json', import.meta.url);
const pkg = JSON.parse(readFileSync(pkgUrl, 'utf8')) as PackageJson;

describe('package wiring', () => {
  it('resolves exports to dual-module build outputs consistent with manifest fields', () => {
    const root = pkg.exports['.'];
    expect(root.import).toBe('./dist/index.js');
    expect(root.require).toBe('./dist/index.cjs');
    expect(root.types).toBe('./dist/index.d.ts');
    expect(root.default).toBe(root.import);
    expect(pkg.main).toBe(root.require);
    expect(pkg.module).toBe(root.import);
    expect(pkg.types).toBe(root.types);
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
    const root = pkg.exports['.'];
    for (const target of [root.import, root.require, root.types]) {
      expect(existsSync(fileURLToPath(new URL(target, pkgUrl))), `${target} missing`).toBe(true);
    }
  });
});
