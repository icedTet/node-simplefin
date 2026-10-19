// intent: intent/architecture.md
// Public API surface of node-simplefin. Protocol facts: intent/maps/external.md.

export { claim, type ClaimOptions } from './claim';
export { SimplefinClient, type GetAccountsOptions, type ClientOptions } from './client';
export { parseAccessUrl, type AccessUrl } from './access-url';
export {
  SimplefinError,
  InvalidTokenError,
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
  Transaction,
  WireAccount,
  WireAccountSetV1,
  WireOrganization,
  WireTransaction,
} from './types';
export type { FetchLike } from './net';

export const pkg = { name: 'node-simplefin', version: '0.0.1' } as const;
