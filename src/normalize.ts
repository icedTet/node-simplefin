// intent: intent/modules/normalize.md
// Maps wire responses (v1 or v2) onto the single public model so callers never branch
// on protocol version. Raw JSON enters here: typed model out, or a typed error.

import { TransportError } from './errors';
import type {
  Account,
  AccountSet,
  Connection,
  Holding,
  ProtocolError,
  Transaction,
  WireAccountSetV1,
  WireAccountSetV2,
  WireErrorEntry,
  WireOrganization,
  WireTransactionV1,
  WireTransactionV2,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optional(value: unknown, type: 'string' | 'number' | 'boolean' | 'object'): boolean {
  if (value === undefined) return true;
  return type === 'object' ? isRecord(value) : typeof value === type;
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

/** `prefix.[subcode]` → `prefix.`; unknown subcodes behave like the naked prefix
 *  (protocol v2 guidance). Consumers should classify with this, not `code`. */
export function errorPrefix(code: string): string {
  const dot = code.indexOf('.');
  return dot === -1 ? `${code}.` : code.slice(0, dot + 1);
}

export function isWireErrorEntry(value: unknown): value is WireErrorEntry {
  return (
    isRecord(value) &&
    typeof value.code === 'string' &&
    typeof value.msg === 'string' &&
    optionalString(value.conn_id) &&
    optionalString(value.account_id)
  );
}

export function projectErrlist(list: unknown): ProtocolError[] {
  if (!Array.isArray(list)) return [];
  const out: ProtocolError[] = [];
  for (const entry of list) {
    if (!isWireErrorEntry(entry)) continue;
    out.push({
      code: entry.code,
      msg: entry.msg,
      ...(entry.conn_id !== undefined ? { connId: entry.conn_id } : {}),
      ...(entry.account_id !== undefined ? { accountId: entry.account_id } : {}),
    });
  }
  return out;
}

function projectXApiMessage(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) return undefined;
  return value;
}

function normalizeTransaction(txn: WireTransactionV1 | WireTransactionV2): Transaction {
  return {
    id: txn.id,
    posted: txn.posted,
    amount: txn.amount,
    description: txn.description,
    ...(txn.transacted_at !== undefined ? { transactedAt: txn.transacted_at } : {}),
    pending: txn.pending === true,
    ...('payee' in txn && typeof txn.payee === 'string' ? { payee: txn.payee } : {}),
    ...('memo' in txn && typeof txn.memo === 'string' ? { memo: txn.memo } : {}),
    ...('mcc' in txn && typeof txn.mcc === 'string' ? { mcc: txn.mcc } : {}),
    ...(txn.extra !== undefined ? { extra: txn.extra } : {}),
  };
}

function normalizeHoldings(value: unknown): readonly Holding[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isRecord);
}

// ── v1 ───────────────────────────────────────────────────────────────────────────

function isWireOrg(value: unknown): value is WireOrganization {
  return (
    isRecord(value) &&
    optionalString(value.domain) &&
    optionalString(value.name) &&
    optionalString(value.url) &&
    optionalString(value.id) &&
    optionalString(value['sfin-url'])
  );
}

function isWireAccountV1(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.currency === 'string' &&
    typeof value.balance === 'string' &&
    optionalString(value['available-balance']) &&
    optional(value['balance-date'], 'number') &&
    optional(value.extra, 'object') &&
    (value.org === undefined || isWireOrg(value.org)) &&
    (value.transactions === undefined ||
      (Array.isArray(value.transactions) && value.transactions.every(isWireTransactionV1)))
  );
}

function isWireTransactionV1(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.posted === 'number' &&
    typeof value.amount === 'string' &&
    typeof value.description === 'string' &&
    optional(value.transacted_at, 'number') &&
    optional(value.pending, 'boolean') &&
    optional(value.extra, 'object')
  );
}

function isWireAccountSetV1(value: unknown): value is WireAccountSetV1 {
  if (!isRecord(value) || !Array.isArray(value.accounts)) return false;
  if (
    value.errors !== undefined &&
    !(Array.isArray(value.errors) && value.errors.every((e) => typeof e === 'string'))
  ) {
    return false;
  }
  return value.accounts.every(isWireAccountV1);
}

function orgToConnection(
  org: WireOrganization | undefined,
  ids: Map<string, Connection>,
): Connection | undefined {
  if (!org || (!org.domain && !org.name)) return undefined;
  const sfinUrl = org['sfin-url'] ?? '';
  const key = `${sfinUrl}\u0000${org.domain ?? ''}\u0000${org.name ?? ''}`;
  const existing = ids.get(key);
  if (existing) return existing;
  const connection: Connection = {
    id: `conn-${ids.size + 1}`,
    name: org.name ?? org.domain ?? sfinUrl,
    ...(org.domain !== undefined ? { domain: org.domain } : {}),
    ...(org.url !== undefined ? { url: org.url } : {}),
    sfinUrl,
  };
  ids.set(key, connection);
  return connection;
}

/** v1 → normalized. Connection identities are synthesized per unique org; legacy
 *  `errors` pass through and a defensive `errlist` projection covers bridges that mix. */
export function normalizeV1(input: unknown): AccountSet {
  if (!isWireAccountSetV1(input)) {
    throw new TransportError('Invalid accounts response: not a v1 AccountSet payload');
  }
  const wire = input;
  const connections = new Map<string, Connection>();
  const accounts: Account[] = wire.accounts.map((account) => {
    const connection = orgToConnection(account.org, connections);
    return {
      id: account.id,
      name: account.name,
      currency: account.currency,
      balance: account.balance,
      ...(account['available-balance'] !== undefined
        ? { availableBalance: account['available-balance'] }
        : {}),
      ...(account['balance-date'] !== undefined ? { balanceDate: account['balance-date'] } : {}),
      transactions: (account.transactions ?? []).map(normalizeTransaction),
      ...(connection ? { connectionId: connection.id } : {}),
      ...(account.extra !== undefined ? { extra: account.extra } : {}),
    };
  });
  const errlist = projectErrlist(wire.errlist);
  return {
    errors: [...(wire.errors ?? []), ...errlist.map((e) => e.msg)],
    errlist,
    connections: [...connections.values()],
    accounts,
  };
}

// ── v2 ───────────────────────────────────────────────────────────────────────────

function isWireConnectionV2(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.conn_id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.org_id === 'string' &&
    typeof value.sfin_url === 'string' &&
    optionalString(value.org_url)
  );
}

function isWireAccountV2(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.conn_id === 'string' &&
    typeof value.currency === 'string' &&
    typeof value.balance === 'string' &&
    optionalString(value['available-balance']) &&
    optional(value['balance-date'], 'number') &&
    optional(value.extra, 'object') &&
    (value.transactions === undefined ||
      (Array.isArray(value.transactions) && value.transactions.every(isWireTransactionV2))) &&
    (value.holdings === undefined ||
      (Array.isArray(value.holdings) && value.holdings.every(isRecord)))
  );
}

function isWireTransactionV2(value: unknown): boolean {
  return (
    isWireTransactionV1(value) &&
    optionalString((value as Record<string, unknown>).payee) &&
    optionalString((value as Record<string, unknown>).memo) &&
    optionalString((value as Record<string, unknown>).mcc)
  );
}

function isWireAccountSetV2(value: unknown): value is WireAccountSetV2 {
  if (!isRecord(value) || !Array.isArray(value.connections) || !Array.isArray(value.accounts)) {
    return false;
  }
  return value.connections.every(isWireConnectionV2) && value.accounts.every(isWireAccountV2);
}

/** v2 → normalized; same AccountSet shape as {@link normalizeV1}. */
export function normalizeV2(input: unknown): AccountSet {
  if (!isWireAccountSetV2(input)) {
    throw new TransportError('Invalid accounts response: not a v2 AccountSet payload');
  }
  const wire = input;
  const connections: Connection[] = wire.connections.map((c) => ({
    id: c.conn_id,
    name: c.name,
    sfinUrl: c.sfin_url,
    orgId: c.org_id,
    ...(c.org_url !== undefined ? { url: c.org_url } : {}),
  }));
  const knownConnections = new Set(connections.map((c) => c.id));
  const accounts: Account[] = wire.accounts.map((account) => {
    const holdings = normalizeHoldings(account.holdings);
    return {
      id: account.id,
      name: account.name,
      currency: account.currency,
      balance: account.balance,
      ...(account['available-balance'] !== undefined
        ? { availableBalance: account['available-balance'] }
        : {}),
      ...(account['balance-date'] !== undefined ? { balanceDate: account['balance-date'] } : {}),
      transactions: (account.transactions ?? []).map(normalizeTransaction),
      ...(holdings !== undefined ? { holdings } : {}),
      ...(knownConnections.has(account.conn_id) ? { connectionId: account.conn_id } : {}),
      ...(account.extra !== undefined ? { extra: account.extra } : {}),
    };
  });
  const errlist = projectErrlist(wire.errlist);
  const legacy =
    Array.isArray(wire.errors) && wire.errors.every((e) => typeof e === 'string')
      ? wire.errors
      : [];
  const xApiMessage = projectXApiMessage(wire['x-api-message']);
  return {
    errors: [...legacy, ...errlist.map((e) => e.msg)],
    errlist,
    connections,
    accounts,
    ...(xApiMessage !== undefined ? { xApiMessage } : {}),
  };
}
