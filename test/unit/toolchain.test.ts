import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  name: string;
  type?: string;
  main?: string;
  module?: string;
  types?: string;
  files?: string[];
  engines?: Record<string, string>;
  exports: { '.': { import?: string; require?: string; types?: string } };
}

const pkgPath = fileURLToPath(new URL('../../package.json', import.meta.url));
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as PackageJson;

describe('package wiring', () => {
  it('resolves exports to build outputs that tsup produces', () => {
    const root = pkg.exports['.'];
    expect(root.import).toBe('./dist/index.js');
    expect(root.require).toBe('./dist/index.cjs');
    expect(root.types).toBe('./dist/index.d.ts');
  });

  it('declares dual-module metadata consistent with exports', () => {
    const root = pkg.exports['.'];
    expect(pkg.main).toBe(root.require);
    expect(pkg.module).toBe(root.import);
    expect(pkg.types).toBe(root.types);
    expect(pkg.type).toBe('module');
  });

  it('ships only built artifacts plus docs', () => {
    expect(pkg.files).toEqual(expect.arrayContaining(['dist', 'LICENSE', 'README.md']));
    expect(pkg.files).not.toContain('src');
  });

  it('requires a fetch-capable Node', () => {
    expect(pkg.engines?.node).toMatch(/^>=\s*18/);
  });
});
