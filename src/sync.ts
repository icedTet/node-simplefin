// intent: intent/modules/sync.md
// Date-window sync helpers. Quota discipline lives here: the bridge expects ~daily pulls
// (≤24 req/day/token) with ≤90-day windows and ~5-day overlap (intent/maps/external.md).

import type { GetAccountsOptions, SimplefinClient } from './client';
import type { Account, AccountSet, Connection, ProtocolError, Transaction } from './types';

export interface WindowOptions {
  /** Max span per request, seconds. Default 90 days (server cap, external.md). */
  maxSpanSeconds?: number;
  /** Overlap added to each window so boundary transactions can't be missed. Default 5 days. */
  overlapSeconds?: number;
}

export interface DateWindow {
  startDate: number;
  endDate: number;
}

const DAY = 86400;

/** Splits `[start, end)` into ≤maxSpan windows, each extended backwards by overlap
 *  (never below `start - overlap`); order is chronological, gaps impossible. */
export function splitWindows(
  start: number,
  end: number,
  options: WindowOptions = {},
): DateWindow[] {
  const maxSpan = options.maxSpanSeconds ?? 90 * DAY;
  const overlap = options.overlapSeconds ?? 5 * DAY;
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(end > start)) {
    throw new RangeError('end must be a finite timestamp after start');
  }
  if (!(maxSpan > overlap) || overlap < 0) {
    throw new RangeError('overlap must be non-negative and smaller than maxSpan');
  }
  const windows: DateWindow[] = [];
  for (let cursor = start; cursor < end; cursor += maxSpan) {
    windows.push({
      startDate: Math.max(cursor - overlap, start - overlap),
      endDate: Math.min(cursor + maxSpan, end),
    });
  }
  return windows;
}

export interface CollectOptions extends GetAccountsOptions, WindowOptions {}

/**
 * Fetches a date range across quota-safe windows and merges one AccountSet out.
 * Requests run sequentially (shared per-token budget — no parallel bursting).
 * Later windows win per id: accounts by `id`, transactions by (`account id`, `txn id`),
 * connections/errors/errlist deduped by identity keys.
 */
export async function collectAccounts(
  client: SimplefinClient,
  options: CollectOptions,
): Promise<AccountSet> {
  const now = Math.floor(Date.now() / 1000);
  const start = toUnix(options.startDate ?? 0);
  const end = toUnix(options.endDate ?? now);
  const shared = {
    pending: options.pending,
    account: options.account,
    balancesOnly: options.balancesOnly,
    version: options.version,
  };

  const errors = new Set<string>();
  const errlist = new Map<string, ProtocolError>();
  const connections = new Map<string, Connection>();
  const accounts = new Map<
    string,
    { fields: Omit<Account, 'transactions'>; txns: Map<string, Transaction> }
  >();

  for (const window of splitWindows(start, end, options)) {
    const set = await client.getAccounts({ ...shared, ...window });
    for (const message of set.errors) errors.add(message);
    for (const entry of set.errlist) errlist.set(`${entry.code}\u0000${entry.msg}`, entry);
    for (const connection of set.connections) connections.set(connection.id, connection);
    for (const account of set.accounts) {
      const { transactions, ...fields } = account;
      const entry: { fields: Omit<Account, 'transactions'>; txns: Map<string, Transaction> } =
        accounts.get(account.id) ?? { fields, txns: new Map<string, Transaction>() };
      entry.fields = fields;
      for (const txn of transactions) entry.txns.set(txn.id, txn);
      accounts.set(account.id, entry);
    }
  }

  const merged: Account[] = [...accounts.entries()].map(([id, { fields, txns }]) => ({
    ...fields,
    id,
    transactions: [...txns.values()],
  }));
  return {
    errors: [...errors],
    errlist: [...errlist.values()],
    connections: [...connections.values()],
    accounts: merged,
  };
}

function toUnix(value: Date | number): number {
  return typeof value === 'number' ? Math.floor(value) : Math.floor(value.getTime() / 1000);
}
