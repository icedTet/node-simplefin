// intent: intent/architecture.md
// Public API surface of node-simplefin. Protocol facts: intent/maps/external.md.

export { claim, type ClaimOptions } from './claim';
export { SimplefinClient, type GetAccountsOptions, type ClientOptions } from './client';
export { parseAccessUrl, type AccessUrl } from './access-url';
export { errorPrefix } from './normalize';
export {
  collectAccounts,
  splitWindows,
  type CollectOptions,
  type DateWindow,
  type WindowOptions,
} from './sync';
export {
  SimplefinError,
  InvalidTokenError,
  InvalidAccessUrlError,
  ClaimError,
  HttpError,
  BadRequestError,
  PaymentRequiredError,
  AccessRevokedError,
  RateLimitError,
  ServerError,
  TransportError,
} from './errors';
export type {
  Account,
  AccountSet,
  Connection,
  Holding,
  ProtocolError,
  Transaction,
  WireAccountV1,
  WireAccountSetV1,
  WireAccountV2,
  WireAccountSetV2,
  WireConnectionV2,
  WireErrorEntry,
  WireOrganization,
  WireTransactionBase,
} from './types';
export type { FetchLike } from './net';

export const pkg = { name: 'node-simplefin', version: '0.1.0' } as const;
