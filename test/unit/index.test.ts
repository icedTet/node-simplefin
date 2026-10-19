import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { pkg } from '../../src/index';

const manifest = JSON.parse(
  readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
) as { name: string; version: string };

describe('public surface', () => {
  it('reports package identity in lockstep with the manifest', () => {
    expect(pkg.name).toBe(manifest.name);
    expect(pkg.version).toBe(manifest.version);
  });
});
