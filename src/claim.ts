// intent: intent/modules/claim.md
// One-time exchange of a setup token (base64 claim URL) for an Access URL.

import { ClaimError, InvalidTokenError, TransportError } from './errors';
import { decodeBase64, resolveFetch, rewriteLegacyHost, type FetchLike } from './net';

export interface ClaimOptions {
  fetch?: FetchLike;
}

/**
 * Redeems a SimpleFIN setup token: the user creates one at the bridge's `/create` page
 * and copies it to your app.
 *
 * @throws {InvalidTokenError} the token is not decodable base64 or not an HTTPS claim URL.
 * @throws {ClaimError} the claim was refused (403) — used, missing, or compromised.
 * @throws {TransportError} network failure or an unexpected response shape.
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
  claimUrl = rewriteLegacyHost(claimUrl);

  let response: Response;
  try {
    // No custom headers: the claim POST must stay a CORS-simple request (external.md).
    response = await resolveFetch(options.fetch)(claimUrl.href, { method: 'POST' });
  } catch (cause) {
    throw new TransportError('Claim request failed', { cause });
  }

  if (response.status === 403) {
    throw new ClaimError();
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
