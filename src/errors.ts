// intent: intent/modules/errors.md
// Error taxonomy. Protocol facts behind every mapping: intent/maps/external.md.

import type { ProtocolError } from './types';

export class SimplefinError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A setup token that is not decodable base64 or not a well-formed HTTPS claim URL. */
export class InvalidTokenError extends SimplefinError {}

/** A malformed or insecure access URL passed to parseAccessUrl/SimplefinClient. */
export class InvalidAccessUrlError extends SimplefinError {}

export const CLAIM_REFUSAL_MESSAGE =
  'Claim refused (403): the setup token was already used, does not exist, or may be ' +
  'compromised. Ask the user for a fresh token and have them disable the old one.';

/** A claim request refused with the protocol's text/plain refusal; the setup token is
 *  used, missing, or compromised. (An edge/UA 403 is a TransportError, not this.) */
export class ClaimError extends SimplefinError {
  constructor(message = CLAIM_REFUSAL_MESSAGE) {
    super(message);
  }
}

export interface HttpErrorOptions {
  status: number;
  /** Origin + path of the endpoint; query strings excluded (never log account ids). */
  url: string;
  /** Display strings from `errors` + errlist msgs, deduplicated; sanitize before render. */
  errors?: string[];
  /** Structured protocol errors when the body carried an errlist; classify with
   *  errorPrefix(code), not code. */
  errlist?: ProtocolError[];
}

/** Base for errors that carry an HTTP status from the API. */
export class HttpError extends SimplefinError {
  readonly status: number;
  readonly url: string;
  readonly errors: string[];
  readonly errlist: ProtocolError[];

  constructor(message: string, options: HttpErrorOptions) {
    super(message);
    this.status = options.status;
    this.url = options.url;
    this.errors = options.errors ?? [];
    this.errlist = options.errlist ?? [];
  }
}

/** 400 — malformed request. */
export class BadRequestError extends HttpError {}

/** 402 — the user's Bridge subscription needs payment. */
export class PaymentRequiredError extends HttpError {}

/** 403 *with a protocol error body* on a data request — token revoked, disabled, or wrong credentials. */
export class AccessRevokedError extends HttpError {}

/** 429 — daily request budget exceeded; back off (see external.md quotas). */
export class RateLimitError extends HttpError {}

/** 5xx — server-side failure; retry later. */
export class ServerError extends HttpError {}

/** Transport-level failure: network error, off-origin response, non-protocol body, or a
 *  403 lacking a protocol error body (e.g. Cloudflare edge/UA block — NOT a revoked token). */
export class TransportError extends SimplefinError {
  readonly status?: number;
  constructor(message: string, options?: { status?: number; cause?: unknown }) {
    super(message, options);
    this.status = options?.status;
  }
}
