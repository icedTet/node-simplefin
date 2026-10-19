// intent: intent/modules/errors.md
// Error taxonomy. Protocol facts behind every mapping: intent/maps/external.md.

export class SimplefinError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A setup token that is not decodable base64 or not an HTTPS claim URL. */
export class InvalidTokenError extends SimplefinError {}

/** A claim request was refused; the setup token is used, missing, or compromised. */
export class ClaimError extends SimplefinError {
  constructor(
    message = 'Claim refused (403): the setup token was already used, does not ' +
      'exist, or may be compromised. Ask the user for a fresh token and have them disable the old one.',
  ) {
    super(message);
  }
}

/** Base for errors that carry an HTTP status from the API. */
export class HttpError extends SimplefinError {
  readonly status: number;
  readonly url: string;
  /** Protocol display strings from the response body (already sanitized by callers for HTML). */
  readonly errors: string[];

  constructor(message: string, status: number, url: string, errors: string[] = []) {
    super(message);
    this.status = status;
    this.url = url;
    this.errors = errors;
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

/** Transport-level failure: network error, cross-host redirect, or a non-protocol response
 *  (e.g. an edge/Cloudflare 403 caused by the runtime's User-Agent — NOT a revoked token). */
export class TransportError extends SimplefinError {
  readonly status?: number;
  constructor(message: string, options?: { status?: number; cause?: unknown }) {
    super(message, options);
    this.status = options?.status;
  }
}
