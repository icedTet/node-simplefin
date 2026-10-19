// intent: intent/modules/net.md
// Shared low-level helpers: UTF-8-safe base64, legacy-host rewrite, fetch injection.
// All behavior here traces to intent/maps/external.md.

/** Fetch shape actually used; real global fetch satisfies it. Tests inject stubs. */
export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

/** bridge.simplefin.org 302s API calls to the beta homepage, dropping path and creds.
 *  Rewriting the host up front is the documented-safe handling (external.md, GH issue #14). */
export const LEGACY_HOST_REWRITES: Readonly<Record<string, string>> = {
  'bridge.simplefin.org': 'beta-bridge.simplefin.org',
};

export function rewriteLegacyHost(url: URL): URL {
  const target = LEGACY_HOST_REWRITES[url.hostname];
  if (target) {
    const rewritten = new URL(url.href);
    rewritten.hostname = target;
    return rewritten;
  }
  return url;
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
