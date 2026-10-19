// intent: intent/modules/http.md
// The single place fetch touches the data API. Decision precedence (intent/testing.md):
// off-origin responses are refused; protocol-error bodies are inspected before a 403 is
// allowed to mean "revoked"; success requires a JSON content-type (shape gate: normalizer).

import type { AccessUrl } from './access-url';
import {
  AccessRevokedError,
  BadRequestError,
  HttpError,
  PaymentRequiredError,
  RateLimitError,
  ServerError,
  TransportError,
} from './errors';
import {
  assertSameOrigin,
  basicAuth,
  resolveFetch,
  rewriteLegacyHost,
  type FetchLike,
} from './net';

export interface RequestOptions {
  fetch?: FetchLike;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

function readProtocolBody(input: unknown): { errors: string[]; isProtocol: boolean } {
  let body = input;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body) as unknown;
    } catch {
      return { errors: [], isProtocol: false };
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: [], isProtocol: false };
  }
  const record = body as Record<string, unknown>;
  const errors: string[] = [];
  let isProtocol = false;
  for (const key of ['errors', 'errlist']) {
    const list = record[key];
    if (!Array.isArray(list)) continue;
    isProtocol = true;
    for (const entry of list) {
      if (typeof entry === 'string') errors.push(entry);
      else if (entry && typeof entry === 'object' && 'msg' in entry) {
        const { msg } = entry as { msg: unknown };
        if (typeof msg === 'string') errors.push(msg);
      }
    }
  }
  return { errors, isProtocol };
}

function classifyStatus(status: number, url: string, body: unknown): never {
  const { errors, isProtocol } = readProtocolBody(body);
  const message = (text: string) => `${text} (HTTP ${status}, ${url})`;
  if (status === 400) throw new BadRequestError(message('Bad request'), status, url, errors);
  if (status === 402) {
    throw new PaymentRequiredError(message('Payment required'), status, url, errors);
  }
  if (status === 403) {
    if (!isProtocol) {
      // Not a protocol refusal: likely an edge/UA block. A revoked token would have
      // returned a JSON errors/errlist body (external.md). Never mislabel.
      throw new TransportError(message('Forbidden without a protocol error body'), { status });
    }
    throw new AccessRevokedError(
      message('Access denied: token revoked, disabled, or credentials wrong'),
      status,
      url,
      errors,
    );
  }
  if (status === 429) throw new RateLimitError(message('Rate limited'), status, url, errors);
  if (status >= 500) throw new ServerError(message('Server error'), status, url, errors);
  throw new HttpError(message('Unexpected status'), status, url, errors);
}

/** GET `{root}{path}?{query}` against an access URL; returns the parsed wire body.
 *  Shape validation belongs to the normalizer, not this generic gateway. */
export async function requestJson<T>(
  access: AccessUrl,
  path: string,
  query: URLSearchParams,
  options: RequestOptions = {},
): Promise<T> {
  const root = rewriteLegacyHost(access.root);
  const url = new URL(`${path}?${query}`, root);
  // Error identity: origin+path only; the query can carry account ids (errors.md).
  const safeUrl = url.origin + url.pathname;
  const headers: Record<string, string> = {
    Authorization: basicAuth(access.username, access.password),
    Accept: 'application/json',
    ...options.headers,
  };

  const doFetch = resolveFetch(options.fetch);
  let response: Response;
  try {
    response = await doFetch(url.href, {
      method: 'GET',
      headers,
      ...(options.signal ? { signal: options.signal } : {}),
    });
  } catch (cause) {
    throw new TransportError(`Request to ${safeUrl} failed`, { cause });
  }
  try {
    assertSameOrigin(response, url);
  } catch (error) {
    response.body?.cancel().catch(() => undefined);
    throw error;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  let body: unknown;
  try {
    body = isJson ? await response.json() : await response.text();
  } catch (cause) {
    if (response.ok) throw new TransportError('Malformed JSON body', { cause });
    body = undefined;
  }

  if (!response.ok) classifyStatus(response.status, safeUrl, body);
  if (!isJson) {
    throw new TransportError(
      `Expected application/json but got "${contentType.slice(0, 80) || 'unknown'}" (HTTP ${response.status})`,
      { status: response.status },
    );
  }
  return body as T;
}
