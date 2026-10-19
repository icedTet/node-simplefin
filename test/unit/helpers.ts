import type { FetchLike } from '../../src/net';

export interface FetchCall {
  url: string;
  init?: RequestInit;
}

export interface MockedFetch {
  calls: FetchCall[];
  fetch: FetchLike;
}

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function textResponse(status: number, body: string): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/plain' } });
}

export function htmlResponse(status: number, body = '<html>error</html>'): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html' } });
}

/** fetch stub returning queued responses (last one repeats; each call gets a fresh
 *  clone because a Response body can only be read once). */
export function mockFetch(...responses: Response[]): MockedFetch {
  const calls: FetchCall[] = [];
  let index = 0;
  const fetch: FetchLike = (input, init) => {
    calls.push({ url: String(input), init });
    if (init?.signal?.aborted) {
      return Promise.reject(new Error('The operation was aborted'));
    }
    const stored = responses[Math.min(index, responses.length - 1)]!;
    index += 1;
    const clone = stored.clone();
    if (stored.url) Object.defineProperty(clone, 'url', { value: stored.url });
    return Promise.resolve(clone);
  };
  return { calls, fetch };
}

export function encodeSetupToken(claimUrl: string): string {
  return btoa(claimUrl);
}
