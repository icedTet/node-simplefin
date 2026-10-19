// intent: intent/modules/types.md
// Wire types (protocol shapes) and the public normalized model. Amounts are decimal
// strings end to end — never parse to float (AGENTS.md). Protocol facts: maps/external.md.

// ── v1 wire (protocol-v1.html; the live bridge default) ─────────────────────────

export interface WireOrganization {
  domain?: string;
  name?: string;
  'sfin-url'?: string;
  url?: string;
  id?: string;
}

export interface WireTransaction {
  id: string;
  /** Unix seconds; 0 when pending (fall back to transacted_at). */
  posted: number;
  /** Decimal string; positive = deposit. */
  amount: string;
  description: string;
  transacted_at?: number;
  pending?: boolean;
  extra?: Record<string, unknown>;
}

export interface WireAccount {
  id: string;
  name: string;
  /** ISO 4217 code, or a URL for custom currencies (GET it for {name, abbr}). */
  currency: string;
  balance: string;
  'available-balance'?: string;
  'balance-date'?: number;
  transactions?: WireTransaction[];
  org?: WireOrganization;
  extra?: Record<string, unknown>;
}

export interface WireAccountSetV1 {
  errors?: string[];
  accounts: WireAccount[];
}

// ── public normalized model (version-independent) ───────────────────────────────

export interface Connection {
  /** Stable within this response; v1 synthesizes from org identity, v2 supplies conn_id. */
  readonly id: string;
  readonly name: string;
  readonly domain?: string;
  readonly url?: string;
  readonly sfinUrl: string;
}

export interface Transaction {
  readonly id: string;
  /** Unix seconds; 0 when pending. */
  readonly posted: number;
  readonly amount: string;
  readonly description: string;
  readonly transactedAt?: number;
  readonly pending: boolean;
  readonly extra?: Record<string, unknown>;
}

export interface Account {
  readonly id: string;
  readonly name: string;
  readonly currency: string;
  readonly balance: string;
  readonly availableBalance?: string;
  readonly balanceDate?: number;
  readonly transactions: readonly Transaction[];
  readonly connectionId?: string;
  readonly extra?: Record<string, unknown>;
}

export interface AccountSet {
  /** Display-ready strings; sanitize before rendering. */
  readonly errors: readonly string[];
  readonly connections: readonly Connection[];
  readonly accounts: readonly Account[];
}
