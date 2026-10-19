// intent: intent/modules/normalize.md
// Maps wire responses (v1 or v2) onto the single public model so callers never branch
// on protocol version. Raw JSON enters here: typed model out, or a typed error.

import { TransportError } from './errors';
import { collectErrorMessages, projectErrlist, projectXApiMessage } from './wire';
import type {
  Account,
  AccountSet,
  Connection,
  Holding,
  Transaction,
  WireAccountSetV1,
  WireAccountV1,
  WireAccountSetV2,
  WireAccountV2,
  WireConnectionV2,
  WireOrganization,
  WireTransactionBase,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

/** Only for the observed-null transaction extras (mcc); payload fields stay strict. */
function optionalStringOrNull(value: unknown): boolean {
  return value === undefined || value === null || typeof value === 'string';
}

function optionalNumber(value: unknown): boolean {
  return value === undefined || typeof value === 'number';
}

function optionalRecord(value: unknown): boolean {
  return value === undefined || isRecord(value);
}

/** `prefix.[subcode]` → `prefix.`; unknown subcodes behave like the naked prefix
 *  (protocol v2 guidance). Empty input stays empty (matches nothing). */
export function errorPrefix(code: string): string {
  if (!code) return code;
  const dot = code.indexOf('.');
  return dot === -1 ? `${code}.` : code.slice(0, dot + 1);
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

// ── shared wire checks ───────────────────────────────────────────────────────────

function isWireTransactionBase(value: unknown): value is WireTransactionBase {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.posted === 'number' &&
    typeof value.amount === 'string' &&
    typeof value.description === 'string' &&
    optionalNumber(value.transacted_at) &&
    (value.pending === undefined || typeof value.pending === 'boolean') &&
    optionalRecord(value.extra) &&
    // Live-bridge extras (payee/memo/mcc): version-agnostic, null-observed on mcc
    // (recorded live probe 2026-10-19; see maps/external.md) — null means absent.
    optionalStringOrNull(value.payee) &&
    optionalStringOrNull(value.memo) &&
    optionalStringOrNull(value.mcc)
  );
}

function normalizeTransaction(txn: WireTransactionBase): Transaction {
  const payee = str(txn.payee);
  const memo = str(txn.memo);
  const mcc = str(txn.mcc);
  return {
    id: txn.id,
    posted: txn.posted,
    amount: txn.amount,
    description: txn.description,
    ...(txn.transacted_at !== undefined ? { transactedAt: txn.transacted_at } : {}),
    pending: txn.pending === true,
    ...(payee !== undefined ? { payee } : {}),
    ...(memo !== undefined ? { memo } : {}),
    ...(mcc !== undefined ? { mcc } : {}),
    ...(txn.extra !== undefined ? { extra: txn.extra } : {}),
  };
}

/** Defensive capture only: the holdings schema is explicitly not guaranteed
 *  (external.md), so nothing here may fail the account set. Non-objects are dropped. */
function normalizeHoldings(value: unknown): readonly Holding[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(isRecord);
}

function normalizeAccountCore(
  account: WireAccountV1 | WireAccountV2,
): Omit<Account, 'connectionId'> {
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
    ...(account.extra !== undefined ? { extra: account.extra } : {}),
  };
}

function isStringArrayOrAbsent(value: unknown): boolean {
  return value === undefined || (Array.isArray(value) && value.every((e) => typeof e === 'string'));
}

function isArrayOrAbsent(value: unknown): boolean {
  // Presence-level gate only; per-entry validity is filtered leniently by wire.projectErrlist.
  return value === undefined || Array.isArray(value);
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

function isWireAccountV1(value: unknown): value is WireAccountV1 {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.currency === 'string' &&
    typeof value.balance === 'string' &&
    optionalString(value['available-balance']) &&
    optionalNumber(value['balance-date']) &&
    optionalRecord(value.extra) &&
    (value.org === undefined || isWireOrg(value.org)) &&
    (value.transactions === undefined ||
      (Array.isArray(value.transactions) && value.transactions.every(isWireTransactionBase)))
  );
}

function isWireAccountSetV1(value: unknown): value is WireAccountSetV1 {
  if (!isRecord(value) || !Array.isArray(value.accounts)) return false;
  return (
    isStringArrayOrAbsent(value.errors) &&
    isArrayOrAbsent(value.errlist) &&
    value.accounts.every(isWireAccountV1)
  );
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
  // Deterministic synthesized id (stable across responses) so multi-window merges in
  // sync.ts can key on it; v2 supplies server conn_ids directly.
  const connection: Connection = {
    id: `v1:${encodeURIComponent(sfinUrl)}:${encodeURIComponent(org.domain ?? '')}:${encodeURIComponent(org.name ?? '')}`,
    name: org.name ?? org.domain ?? sfinUrl,
    ...(org.domain !== undefined ? { domain: org.domain } : {}),
    ...(org.url !== undefined ? { url: org.url } : {}),
    sfinUrl,
  };
  ids.set(key, connection);
  return connection;
}

/** v1 → normalized. Connection identities are synthesized deterministically from org
 *  identity (stable across responses); legacy
 *  `errors` and a defensive `errlist` surface in `errors`; live passthroughs
 *  (holdings, x-api-message) are captured like on v2. */
export function normalizeV1(input: unknown): AccountSet {
  if (!isWireAccountSetV1(input)) {
    throw new TransportError('Invalid accounts response: not a v1 AccountSet payload');
  }
  const connections = new Map<string, Connection>();
  const accounts: Account[] = input.accounts.map((account) => {
    const connection = orgToConnection(account.org, connections);
    return {
      ...normalizeAccountCore(account),
      ...(connection ? { connectionId: connection.id } : {}),
    };
  });
  const errlist = projectErrlist(input.errlist);
  const xApiMessage = projectXApiMessage(input['x-api-message']);
  return {
    errors: collectErrorMessages({ errors: input.errors, errlist: input.errlist }),
    errlist,
    connections: [...connections.values()],
    accounts,
    ...(xApiMessage !== undefined ? { xApiMessage } : {}),
  };
}

// ── v2 ───────────────────────────────────────────────────────────────────────────

function isWireConnectionV2(value: unknown): value is WireConnectionV2 {
  return (
    isRecord(value) &&
    typeof value.conn_id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.org_id === 'string' &&
    typeof value.sfin_url === 'string' &&
    optionalString(value.org_url)
  );
}

function isWireAccountV2(value: unknown): value is WireAccountV2 {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.conn_id === 'string' &&
    typeof value.currency === 'string' &&
    typeof value.balance === 'string' &&
    optionalString(value['available-balance']) &&
    optionalNumber(value['balance-date']) &&
    optionalRecord(value.extra) &&
    (value.transactions === undefined ||
      (Array.isArray(value.transactions) && value.transactions.every(isWireTransactionBase)))
    // holdings deliberately unchecked: schema not guaranteed (external.md); captured
    // defensively so a weird entry can never kill the whole account set.
  );
}

function isWireAccountSetV2(value: unknown): value is WireAccountSetV2 {
  if (!isRecord(value) || !Array.isArray(value.connections) || !Array.isArray(value.accounts)) {
    return false;
  }
  return (
    isStringArrayOrAbsent(value.errors) &&
    isArrayOrAbsent(value.errlist) &&
    value.connections.every(isWireConnectionV2) &&
    value.accounts.every(isWireAccountV2)
  );
}

/** v2 → normalized; same AccountSet shape as {@link normalizeV1}. Connection extras
 *  beyond the typed fields (e.g. `org_name`) pass through raw. */
export function normalizeV2(input: unknown): AccountSet {
  if (!isWireAccountSetV2(input)) {
    throw new TransportError('Invalid accounts response: not a v2 AccountSet payload');
  }
  const connections: Connection[] = input.connections.map((c) => {
    // Consume the known wire keys into typed fields; unknown extras pass through raw.
    const { conn_id, name, org_id, sfin_url, org_url, ...rest } = c;
    return {
      ...rest,
      id: conn_id,
      name,
      sfinUrl: sfin_url,
      orgId: org_id,
      ...(org_url !== undefined ? { url: org_url } : {}),
    };
  });
  const knownConnections = new Set(connections.map((c) => c.id));
  const accounts: Account[] = input.accounts.map((account) => ({
    ...normalizeAccountCore(account),
    ...(knownConnections.has(account.conn_id) ? { connectionId: account.conn_id } : {}),
  }));
  const errlist = projectErrlist(input.errlist);
  const xApiMessage = projectXApiMessage(input['x-api-message']);
  return {
    errors: collectErrorMessages({ errors: input.errors, errlist: input.errlist }),
    errlist,
    connections,
    accounts,
    ...(xApiMessage !== undefined ? { xApiMessage } : {}),
  };
}
