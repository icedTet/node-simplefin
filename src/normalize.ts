// intent: intent/modules/normalize.md
// Maps wire responses onto the single public model so callers never branch on version.

import type {
  Account,
  AccountSet,
  Connection,
  Transaction,
  WireAccount,
  WireAccountSetV1,
  WireOrganization,
  WireTransaction,
} from './types';

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

function normalizeTransaction(txn: WireTransaction): Transaction {
  return {
    id: txn.id,
    posted: txn.posted,
    amount: txn.amount,
    description: txn.description,
    ...(txn.transacted_at !== undefined ? { transactedAt: txn.transacted_at } : {}),
    pending: txn.pending === true,
    ...(txn.extra !== undefined ? { extra: txn.extra } : {}),
  };
}

function normalizeAccount(wire: WireAccount, connections: Map<string, Connection>): Account {
  const connection = orgToConnection(wire.org, connections);
  return {
    id: wire.id,
    name: wire.name,
    currency: wire.currency,
    balance: wire.balance,
    ...(wire['available-balance'] !== undefined
      ? { availableBalance: wire['available-balance'] }
      : {}),
    ...(wire['balance-date'] !== undefined ? { balanceDate: wire['balance-date'] } : {}),
    transactions: (wire.transactions ?? []).map(normalizeTransaction),
    ...(connection ? { connectionId: connection.id } : {}),
    ...(wire.extra !== undefined ? { extra: wire.extra } : {}),
  };
}

/** v1 → normalized. Connection identities are synthesized per unique org; the wire's
 *  `errors` strings pass through untouched. */
export function normalizeV1(wire: WireAccountSetV1): AccountSet {
  const connections = new Map<string, Connection>();
  const accounts = wire.accounts.map((account) => normalizeAccount(account, connections));
  return {
    errors: wire.errors ?? [],
    connections: [...connections.values()],
    accounts,
  };
}
