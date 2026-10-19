// intent: intent/modules/net.md
// Shared isomorphic primitives: fetch resolution/injection, UTF-8 base64, legacy host
// rewrite, origin assertion. All behavior here traces to intent/maps/external.md.

import { TransportError } from './errors';

/** Fetch shape actually used; real global fetch satisfies it. Tests inject stubs. */
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

/** bridge.simplefin.org 302s API calls to the beta homepage, dropping path and creds.
 *  Rewriting the host up front is the documented-safe handling (external.md, GH issue #14). */
export const LEGACY_HOST_REWRITES: ReadonlyMap<string, string> = new Map([
  ['bridge.simplefin.org', 'beta-bridge.simplefin.org'],
]);

export function rewriteLegacyHost(url: URL): URL {
  const target = LEGACY_HOST_REWRITES.get(url.hostname);
  if (target) {
    const rewritten = new URL(url.href);
    rewritten.hostname = target;
    return rewritten;
  }
  return url;
}

/** Refuse responses that were served from a different origin (scheme+host+port) than
 *  requested — the portable form of "never follow cross-host/insecure redirects"
 *  (external.md; redirect behavior verified on Node/Bun/Deno). */
export function assertSameOrigin(response: Response, requestUrl: URL): void {
  if (!response.url) return;
  const finalOrigin = new URL(response.url).origin;
  if (finalOrigin !== requestUrl.origin) {
    throw new TransportError(
      `Refusing off-origin response: ${requestUrl.origin} answered from ${finalOrigin}`,
      { status: response.status },
    );
  }
}

/** UTF-8-safe `Authorization: Basic` from access URL credentials. */
export function basicAuth(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `Basic ${btoa(binary)}`;
}

export function decodeBase64(text: string): string {
  const bytes = Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function resolveFetch(injected?: FetchLike): FetchLike {
  if (injected) return injected;
  if (typeof fetch !== 'function') {
    throw new TypeError('No global fetch available; pass options.fetch');
  }
  return (input, init) => fetch(input, init);
}
