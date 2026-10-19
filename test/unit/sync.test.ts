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
  it('tiles a 200-day range into <=45-day windows with ~5-day overlaps', () => {
    const start = 0;
    const end = 200 * DAY;
    const windows = splitWindows(start, end);
    for (const w of windows) {
      expect(w.endDate - w.startDate).toBeLessThanOrEqual(45 * DAY); // server-rec cap
      expect(w.endDate - w.startDate).toBeGreaterThan(0);
    }
    expect(windows[0]).toEqual({ startDate: start, endDate: 45 * DAY });
    for (let i = 1; i < windows.length; i++) {
      expect(windows[i]!.startDate).toBeLessThan(windows[i - 1]!.endDate); // overlap, no gap
      expect(windows[i]!.startDate).toBeGreaterThanOrEqual(start);
    }
    expect(windows.at(-1)!.endDate).toBe(end);
  });

  it('explicit geometry stays within maxSpan', () => {
    const windows = splitWindows(0, 30 * DAY, {
      maxSpanSeconds: 10 * DAY,
      overlapSeconds: 2 * DAY,
    });
    for (const w of windows) expect(w.endDate - w.startDate).toBeLessThanOrEqual(10 * DAY);
    expect(windows).toHaveLength(4);
  });

  it('short ranges yield a single window', () => {
    const windows = splitWindows(1000, 1000 + 2 * DAY);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toEqual({ startDate: 1000, endDate: 1000 + 2 * DAY });
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
    expect(calls.length).toBeGreaterThan(1); // 180d at default 45d/5d geometry
    for (let i = 1; i < calls.length; i++) {
      // exact 5-day overlap between consecutive windows (replaces vacuous 95d bound)
      expect(calls[i]!.startDate).toBe(calls[i - 1]!.endDate - 5 * DAY);
    }
    const account = merged.accounts[0]!;
    expect(account.balance).toBe('7.00');
    expect(account.transactions.map((x) => x.id)).toEqual(['x', 'y', 'z']); // posted-sorted
    expect(account.transactions.map((x) => x.posted)).toEqual([1, 2, 3]);
    const keys = account.transactions.map((x) => x.id);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('a duplicate txn id in later windows wins at its sorted position', async () => {
    const { client } = fakeClient([
      () =>
        setWith({
          id: 'a1',
          name: 'A',
          currency: 'USD',
          balance: '5.00',
          transactions: [{ id: 'x', posted: 1, amount: '1.00', description: 'd', pending: false }],
        }),
      () =>
        setWith({
          id: 'a1',
          name: 'A',
          currency: 'USD',
          balance: '7.00',
          transactions: [
            { id: 'x', posted: 1, amount: '2.00', description: 'fixed', pending: false },
          ],
        }),
    ]);
    const merged = await collectAccounts(client, {
      startDate: 0,
      endDate: 100 * DAY,
      maxSpanSeconds: 60 * DAY,
      overlapSeconds: 5 * DAY,
    });
    expect(merged.accounts[0]!.transactions).toHaveLength(1);
    expect(merged.accounts[0]!.transactions[0]!.amount).toBe('2.00');
  });

  it('requires an explicit startDate and respects the maxRequests guard', async () => {
    const { client, calls } = fakeClient([() => empty]);
    await expect(collectAccounts(client as never, { endDate: 10 * DAY } as never)).rejects.toThrow(
      RangeError,
    );
    expect(calls).toHaveLength(0);
    await expect(collectAccounts(client, { startDate: 0, endDate: 4000 * DAY })).rejects.toThrow(
      /maxRequests/,
    );
    expect(calls).toHaveLength(0);
  });

  it('defaults endDate to now when omitted', async () => {
    const { calls, client } = fakeClient([() => empty]);
    const before = Math.floor(Date.now() / 1000);
    await collectAccounts(client, { startDate: before - 2 * DAY });
    expect(calls[0]!.endDate).toBeGreaterThanOrEqual(before);
  });

  it('posted-ties fall back to id order', async () => {
    const t = (id: string) => ({ id, posted: 7, amount: '1.00', description: 'd', pending: false });
    const { client } = fakeClient([
      () =>
        setWith({
          id: 'a1',
          name: 'A',
          currency: 'USD',
          balance: '1.00',
          transactions: [t('z'), t('x')],
        }),
    ]);
    const merged = await collectAccounts(client, { startDate: 0, endDate: DAY });
    expect(merged.accounts[0]!.transactions.map((x) => x.id)).toEqual(['x', 'z']);
  });

  it('accepts Date objects for both bounds', async () => {
    const { calls, client } = fakeClient([() => empty]);
    await collectAccounts(client, {
      startDate: new Date(2026, 0, 1),
      endDate: new Date(2026, 2, 1),
    });
    expect(calls.length).toBeGreaterThan(0);
    expect(typeof calls[0]!.startDate).toBe('number');
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
