// intent: intent/modules/claim.md
// One-time exchange of a setup token (base64 claim URL) for an Access URL.

import { ClaimError, InvalidTokenError, TransportError } from './errors';
import {
  assertSameOrigin,
  decodeBase64,
  resolveFetch,
  rewriteLegacyHost,
  type FetchLike,
} from './net';

export interface ClaimOptions {
  fetch?: FetchLike;
}

/**
 * Redeems a SimpleFIN setup token: the user creates one at the bridge's `/create` page
 * and copies it to your app.
 *
 * @throws {InvalidTokenError} the token is not decodable base64 or not a well-formed
 *   HTTPS claim URL (checked before any network call).
 * @throws {ClaimError} the claim was refused with the protocol's text/plain refusal —
 *   used, missing, or compromised. An edge/UA 403 surfaces as TransportError instead.
 * @throws {TransportError} network failure, off-origin response, or unexpected shape.
 * @returns the Access URL (`https://id:key@host/...`) — store it as securely as financial data.
 */
export async function claim(setupToken: string, options: ClaimOptions = {}): Promise<string> {
  let claimUrl: URL;
  try {
    claimUrl = new URL(decodeBase64(setupToken.trim()));
  } catch {
    throw new InvalidTokenError('Setup token is not base64-encoded text of a claim URL');
  }
  if (claimUrl.protocol !== 'https:') {
    throw new InvalidTokenError('Setup token does not decode to an https: claim URL');
  }
  if (claimUrl.username || claimUrl.password) {
    // Claim URLs carry no credentials (external.md); passing one to fetch would echo
    // them through a rejection cause into logs.
    throw new InvalidTokenError('Setup token decodes to a claim URL carrying credentials');
  }
  claimUrl = rewriteLegacyHost(claimUrl);

  let response: Response;
  try {
    // No custom headers: the claim POST must stay a CORS-simple request (external.md).
    response = await resolveFetch(options.fetch)(claimUrl.href, { method: 'POST' });
  } catch (cause) {
    throw new TransportError('Claim request failed', { cause });
  }
  assertSameOrigin(response, claimUrl);

  if (response.status === 403) {
    // Only the protocol's text/plain refusal means "used or compromised"; an HTML edge
    // 403 (e.g. Cloudflare UA block) must not raise a false revocation alarm (external.md).
    const body = (await response.text()).trim();
    const ct = response.headers.get('content-type') ?? '';
    if (ct.startsWith('text/plain') || (!ct && /^Forbidden\b/i.test(body))) {
      throw new ClaimError();
    }
    throw new TransportError(
      `Claim refused (403) without a protocol error body${ct ? `, content-type "${ct}"` : ''}`,
      {
        status: 403,
      },
    );
  }
  if (!response.ok) {
    throw new TransportError(`Unexpected claim response status ${response.status}`, {
      status: response.status,
    });
  }

  const body = (await response.text()).trim();
  let accessUrl: URL;
  try {
    accessUrl = new URL(body);
  } catch {
    throw new TransportError('Claim response is not a URL');
  }
  if (accessUrl.protocol !== 'https:' || !accessUrl.username || !accessUrl.password) {
    throw new TransportError('Claim response is not an https access URL with credentials');
  }
  return body;
}
