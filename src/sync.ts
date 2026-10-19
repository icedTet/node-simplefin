// intent: intent/modules/sync.md
// Date-window sync helpers. Quota discipline lives here: the bridge recommends 45-day
// fetch ranges (hard cap 90 days, both warn/cap via gen.api), expects ~daily pulls within
// ≤24 requests/day/token, and wants ~5-day overlap (intent/maps/external.md).

import type { GetAccountsOptions, SimplefinClient } from './client';
import type { Account, AccountSet, Connection, ProtocolError, Transaction } from './types';

export interface WindowOptions {
  /** Max span per request, seconds. Default 45 days (server-recommended, external.md). */
  maxSpanSeconds?: number;
  /** Overlap added to each window so boundary transactions can't be missed. Default 5 days. */
  overlapSeconds?: number;
}

export interface DateWindow {
  startDate: number;
  endDate: number;
}

const DAY = 86400;

/** Splits `[start, end)` into windows of at most `maxSpanSeconds`, stepping forward by
 *  `maxSpan - overlap` so consecutive windows overlap by ~`overlapSeconds`. Order is
 *  chronological, gaps impossible, nothing fetched before `start`.
 *  @throws RangeError for invalid geometry (checked before any request). */
export function splitWindows(
  start: number,
  end: number,
  options: WindowOptions = {},
): DateWindow[] {
  const maxSpan = options.maxSpanSeconds ?? 45 * DAY;
  const overlap = options.overlapSeconds ?? 5 * DAY;
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(end > start)) {
    throw new RangeError('end must be a finite timestamp after start');
  }
  if (!(maxSpan > overlap) || overlap < 0) {
    throw new RangeError('overlap must be non-negative and smaller than maxSpan');
  }
  const step = maxSpan - overlap;
  const windows: DateWindow[] = [];
  for (let begin = start; begin < end; begin += step) {
    windows.push({ startDate: begin, endDate: Math.min(begin + maxSpan, end) });
  }
  return windows;
}

export interface CollectOptions
  extends Omit<GetAccountsOptions, 'startDate' | 'endDate'>, WindowOptions {
  /** Start of range (required: an unbounded default would spend the whole daily quota). */
  startDate: Date | number;
  /** Inclusive end (default: now). */
  endDate?: Date | number;
  /** Guard against quota blowouts: more windows than this throws before fetching. */
  maxRequests?: number;
}

const DEFAULT_MAX_REQUESTS = 24;

/**
 * Fetches a date range across quota-safe windows and merges one AccountSet out.
 * Requests run sequentially (one shared per-token budget — never parallel bursts).
 * Merge: accounts keyed by `id` (later window's fields win); transactions keyed by
 * (`account id`, `txn id`) with later values winning, output **sorted by `posted`
 * ascending** (ties by id); connections/errors/errlist deduped by identity keys.
 * Failure of any window aborts the collect (all-or-nothing; spent quota is spent —
 * see modules/sync.md constraints).
 */
export async function collectAccounts(
  client: SimplefinClient,
  options: CollectOptions,
): Promise<AccountSet> {
  const maxRequests = options.maxRequests ?? DEFAULT_MAX_REQUESTS;
  // Widened for the runtime guard: TS marks it required, JS callers may still omit it.
  const requestedStart = options.startDate as Date | number | undefined;
  if (requestedStart === undefined) {
    throw new RangeError('collectAccounts requires an explicit startDate (no unbounded default)');
  }
  const start = toUnix(requestedStart);
  const end =
    options.endDate === undefined ? Math.floor(Date.now() / 1000) : toUnix(options.endDate);
  const windows = splitWindows(start, end, options);
  if (windows.length > maxRequests) {
    throw new RangeError(
      `${String(windows.length)} windows exceeds maxRequests (${String(maxRequests)}); ` +
        'narrow the range or split across days (bridge quota: ≤24 req/day/token)',
    );
  }
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

  for (const window of windows) {
    const set = await client.getAccounts({ ...shared, ...window });
    for (const message of set.errors) errors.add(message);
    for (const entry of set.errlist) {
      errlist.set(
        `${entry.code}\u0000${entry.msg}\u0000${entry.connId ?? ''}\u0000${entry.accountId ?? ''}`,
        entry,
      );
    }
    for (const connection of set.connections) connections.set(connection.id, connection);
    for (const account of set.accounts) {
      const { transactions, ...fields } = account;
      const entry = accounts.get(account.id) ?? { fields, txns: new Map<string, Transaction>() };
      entry.fields = fields;
      for (const txn of transactions) entry.txns.set(txn.id, txn);
      accounts.set(account.id, entry);
    }
  }

  const merged: Account[] = [...accounts.entries()].map(([id, { fields, txns }]) => ({
    ...fields,
    id,
    transactions: [...txns.values()].sort((a, b) => a.posted - b.posted || (a.id < b.id ? -1 : 1)),
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
