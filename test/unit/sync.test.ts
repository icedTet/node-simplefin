import { describe, expect, it, vi } from 'vitest';
import { collectAccounts, splitWindows } from '../../src/sync';
import type { AccountSet } from '../../src/types';

const DAY = 86400;

function fakeClient(responses: ((window: { startDate: number; endDate: number }) => AccountSet)[]) {
  const calls: { startDate: number; endDate: number }[] = [];
  let index = 0;
  const client = {
    getAccounts: vi.fn(async (opts: { startDate?: number; endDate?: number }) => {
      const window = { startDate: opts.startDate!, endDate: opts.endDate! };
      calls.push(window);
      const make = responses[Math.min(index, responses.length - 1)]!;
      index += 1;
      return Promise.resolve(make(window));
    }),
  };
  // structural cast: collectAccounts only needs getAccounts
  return { client: client as unknown as Parameters<typeof collectAccounts>[0], calls };
}

const empty: AccountSet = { errors: [], errlist: [], connections: [], accounts: [] };
const setWith = (account: AccountSet['accounts'][number]): AccountSet => ({
  ...empty,
  accounts: [account],
});

describe('splitWindows', () => {
  it('tiles a 200-day range into ≤90-day windows with 5-day backward overlap', () => {
    const start = 0;
    const end = 200 * DAY;
    const windows = splitWindows(start, end);
    expect(windows).toHaveLength(3);
    expect(windows[0]).toEqual({ startDate: start - 5 * DAY, endDate: 90 * DAY });
    expect(windows[1]!.startDate).toBe(85 * DAY);
    expect(windows[2]!.endDate).toBe(end);
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i]!.startDate).toBeLessThan(windows[i - 1]!.endDate); // overlap, no gap
    }
    for (const w of windows) expect(w.endDate - w.startDate).toBeLessThanOrEqual(95 * DAY);
  });

  it('short ranges yield a single clamped window', () => {
    const windows = splitWindows(1000, 1000 + 2 * DAY);
    expect(windows).toHaveLength(1);
    expect(windows[0]!.startDate).toBe(1000 - 5 * DAY);
    expect(windows[0]!.endDate).toBe(1000 + 2 * DAY);
  });

  it('rejects invalid ranges and geometry', () => {
    expect(() => splitWindows(10, 10)).toThrow(RangeError);
    expect(() => splitWindows(NaN, 10)).toThrow(RangeError);
    expect(() => splitWindows(0, DAY, { maxSpanSeconds: DAY, overlapSeconds: DAY })).toThrow(
      RangeError,
    );
  });
});

describe('collectAccounts', () => {
  it('merges windows: sequential fetches, txn dedup by account+id, later balance wins', async () => {
    const t = (id: string, posted: number) => ({
      id,
      posted,
      amount: '1.00',
      description: 'd',
      pending: false,
    });
    const start = 0;
    const end = 180 * DAY;
    const { client, calls } = fakeClient([
      () =>
        setWith({
          id: 'a1',
          name: 'A',
          currency: 'USD',
          balance: '5.00',
          transactions: [t('x', 1), t('y', 2)],
        }),
      () =>
        setWith({
          id: 'a1',
          name: 'A',
          currency: 'USD',
          balance: '7.00',
          transactions: [t('y', 2), t('z', 3)],
        }),
    ]);
    const merged = await collectAccounts(client, { startDate: start, endDate: end });
    expect(calls).toHaveLength(2);
    expect(calls[0]!.endDate).toBeLessThanOrEqual(calls[1]!.startDate + 95 * DAY);
    const account = merged.accounts[0]!;
    expect(account.balance).toBe('7.00');
    expect(account.transactions.map((x) => x.id).sort()).toEqual(['x', 'y', 'z']);
    const keys = account.transactions.map((x) => x.id);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('merges errors, errlist and connections without duplicates', async () => {
    const e = (code: string, msg: string) => ({ code, msg });
    const { client } = fakeClient([
      () => ({
        errors: ['quota warn'],
        errlist: [e('act.', 'later')],
        connections: [{ id: 'c1', name: 'B', sfinUrl: 'https://s' }],
        accounts: [],
      }),
      () => ({
        errors: ['quota warn'],
        errlist: [e('act.', 'later')],
        connections: [{ id: 'c1', name: 'B', sfinUrl: 'https://s' }],
        accounts: [],
      }),
    ]);
    const merged = await collectAccounts(client, {
      startDate: 0,
      endDate: 10 * DAY,
      maxSpanSeconds: 5 * DAY,
      overlapSeconds: 1 * DAY,
    });
    expect(merged.errors).toEqual(['quota warn']);
    expect(merged.errlist).toEqual([e('act.', 'later')]);
    expect(merged.connections).toHaveLength(1);
  });
});
