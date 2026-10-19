import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { normalizeV1, normalizeV2 } from '../../src/normalize';

function load(file: string): unknown {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/${file}`, import.meta.url), 'utf8'),
  ) as unknown;
}

describe('recorded bridge fixtures (ground truth; see *.meta.json)', () => {
  it('normalizes the live v1 demo payload', () => {
    const set = normalizeV1(load('v1-demo.json'));
    expect(set.accounts.length).toBeGreaterThanOrEqual(3);
    expect(set.connections.length).toBeGreaterThanOrEqual(1);
    expect(typeof set.accounts[0]!.balance).toBe('string');
    const txns = set.accounts.flatMap((a) => a.transactions);
    expect(txns.length).toBeGreaterThan(0);
    expect(txns.every((t) => typeof t.amount === 'string')).toBe(true);
    // mcc:null entries were absorbed (absent), never null:
    expect(txns.every((t) => t.mcc === undefined || typeof t.mcc === 'string')).toBe(true);
  });

  it('normalizes the live v2 demo payload', () => {
    const set = normalizeV2(load('v2-demo.json'));
    expect(set.connections[0]!.id).toMatch(/^CON-/);
    expect(set.connections[0]!.org_name).toBe('SimpleFIN Bridge');
    const withHoldings = set.accounts.filter((a) => a.holdings !== undefined);
    expect(withHoldings.length).toBeGreaterThan(0);
    expect(withHoldings[0]!.holdings![0]!.symbol).toBe('AAPL');
  });

  it('surfaces x-api-message from the no-start-date shape', () => {
    const set = normalizeV1(load('v1-demo-no-start-date.json'));
    expect(set.xApiMessage?.some((m) => m.includes('start-date'))).toBe(true);
  });
});
