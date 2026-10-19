// intent: intent/modules/types.md
// Wire types (protocol shapes) and the public normalized model. Amounts are decimal
// strings end to end — never parse to float (AGENTS.md). Protocol facts: maps/external.md.

// ── wire extras shared by v1 and v2 (live bridge, version-agnostic) ─────────────

/** Wire transaction fields common to v1/v2 plus the undocumented-but-live extras
 *  (payee/memo/mcc — external.md; `mcc` observed `null` live, null ≡ absent). */
export interface WireTransactionBase {
  id: string;
  /** Unix seconds; 0 when pending (fall back to transacted_at). */
  posted: number;
  /** Decimal string; positive = deposit. */
  amount: string;
  description: string;
  transacted_at?: number;
  pending?: boolean;
  extra?: Record<string, unknown>;
  payee?: string | null;
  memo?: string | null;
  mcc?: string | null;
}

// ── v1 wire (protocol-v1.html; the live bridge default) ──────────────────────────

export interface WireOrganization {
  domain?: string;
  name?: string;
  'sfin-url'?: string;
  url?: string;
  id?: string;
}

export interface WireAccountV1 {
  id: string;
  name: string;
  /** ISO 4217 code, or a URL for custom currencies (GET it for {name, abbr}). */
  currency: string;
  balance: string;
  'available-balance'?: string;
  'balance-date'?: number;
  transactions?: WireTransactionBase[];
  org?: WireOrganization;
  /** Live v1 carries holdings too (recorded probe); captured defensively. */
  holdings?: unknown;
  extra?: Record<string, unknown>;
}

export interface WireAccountSetV1 {
  errors?: string[];
  errlist?: unknown;
  accounts: WireAccountV1[];
  'x-api-message'?: unknown;
  [key: string]: unknown;
}

// ── v2 wire (protocol.html v2.0.0-draft, opt-in via version=2) ──────────────────

export interface WireErrorEntry {
  code: string;
  msg: string;
  conn_id?: string;
  account_id?: string;
}

export interface WireConnectionV2 {
  conn_id: string;
  name: string;
  org_id: string;
  org_url?: string;
  sfin_url: string;
  [key: string]: unknown;
}

export interface WireAccountV2 {
  id: string;
  name: string;
  conn_id: string;
  currency: string;
  balance: string;
  'available-balance'?: string;
  'balance-date'?: number;
  transactions?: WireTransactionBase[];
  /** Observed live, schema explicitly not guaranteed (bridge-issues #43). */
  holdings?: unknown;
  extra?: Record<string, unknown>;
}

export interface WireAccountSetV2 {
  errlist?: unknown;
  errors?: string[];
  connections: WireConnectionV2[];
  accounts: WireAccountV2[];
  'x-api-message'?: unknown;
  [key: string]: unknown;
}

// ── public normalized model (version-independent) ────────────────────────────────

export interface Connection {
  /** v2: server-supplied conn_id. v1: synthesized deterministically from
   *  (sfinUrl, domain, name) — stable across responses, opaque in shape. */
  readonly id: string;
  readonly name: string;
  /** v1-era org field; v2 servers use orgId. Consumers should tolerate absence. */
  readonly domain?: string;
  readonly url?: string;
  readonly sfinUrl: string;
  /** v2 organization id (unique per server, not globally). */
  readonly orgId?: string;
  /** v2 passthrough: unmodeled server fields (e.g. org_name) survive raw. */
  readonly [key: string]: unknown;
}

export interface Transaction {
  readonly id: string;
  /** Unix seconds; 0 when pending. */
  readonly posted: number;
  readonly amount: string;
  readonly description: string;
  readonly transactedAt?: number;
  readonly pending: boolean;
  /** Live-bridge extras (not in the written spec; presence not guaranteed). */
  readonly payee?: string;
  readonly memo?: string;
  readonly mcc?: string;
  readonly extra?: Record<string, unknown>;
}

/** Schema explicitly not guaranteed by the bridge; typed accessors for OBSERVED
 *  fields are convenience only — the SDK does not validate them (normalize.md). */
export interface Holding {
  [key: string]: unknown;
  created?: number;
  symbol?: string;
  shares?: string;
  cost_basis?: string;
  market_value?: string;
  purchase_price?: string;
  currency?: string;
  description?: string;
}

export interface ProtocolError {
  /** Grammar `prefix.[subcode]`; prefixes gen|con|act. Unknown subcodes fall back to
   *  the naked prefix via {@link errorPrefix} — consumers should classify on prefix. */
  readonly code: string;
  readonly msg: string;
  readonly connId?: string;
  readonly accountId?: string;
}

export interface Account {
  readonly id: string;
  readonly name: string;
  readonly currency: string;
  readonly balance: string;
  readonly availableBalance?: string;
  readonly balanceDate?: number;
  readonly transactions: readonly Transaction[];
  readonly holdings?: readonly Holding[];
  readonly connectionId?: string;
  readonly extra?: Record<string, unknown>;
}

export interface AccountSet {
  /** Display strings from legacy `errors` + projected errlist msgs, deduplicated;
   *  sanitize before rendering. */
  readonly errors: readonly string[];
  /** Structured protocol errors when present (both versions; defensive on v1). */
  readonly errlist: readonly ProtocolError[];
  readonly connections: readonly Connection[];
  readonly accounts: readonly Account[];
  /** Undocumented live-bridge info array (external.md); surfaced, never interpreted. */
  readonly xApiMessage?: readonly string[];
}
