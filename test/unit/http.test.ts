import { describe, expect, it, vi } from 'vitest';
import { parseAccessUrl } from '../../src/access-url';
import { AccessRevokedError, TransportError } from '../../src/errors';
import type { HttpError } from '../../src/errors';
import { requestJson } from '../../src/http';
import { htmlResponse, jsonResponse, mockFetch } from './helpers';

const access = parseAccessUrl('https://demo:demo@beta-bridge.simplefin.org/simplefin');

async function expectError<T>(promise: Promise<T>): Promise<Error & { status?: number }> {
  try {
    await promise;
  } catch (error) {
    return error as Error & { status?: number };
  }
  throw new Error('expected rejection');
}

describe('requestJson', () => {
  it('sends Basic auth derived from the access URL, never userinfo in the request URL', async () => {
    const { calls, fetch } = mockFetch(jsonResponse(200, { accounts: [] }));
    await requestJson(access, 'accounts', new URLSearchParams(), { fetch });
    const url = new URL(calls[0]!.url);
    expect(url.username).toBe('');
    expect(url.pathname).toBe('/simplefin/accounts');
    const headers = calls[0]!.init?.headers as Record<string, string>;
    // base64("demo:demo")
    expect(headers.Authorization).toBe('Basic ZGVtbzpkZW1v');
    expect(headers.Accept).toBe('application/json');
  });

  it('rewrites the legacy bridge host on data requests too', async () => {
    const legacy = parseAccessUrl('https://abc:def@bridge.simplefin.org/simplefin');
    const { calls, fetch } = mockFetch(jsonResponse(200, { accounts: [] }));
    await requestJson(legacy, 'accounts', new URLSearchParams(), { fetch });
    expect(new URL(calls[0]!.url).hostname).toBe('beta-bridge.simplefin.org');
  });

  it('refuses responses that actually came from a different host (silent 302 to a homepage)', async () => {
    const bankAccess = parseAccessUrl('https://abc:def@bank.example/simplefin');
    const response = jsonResponse(200, { accounts: [] });
    Object.defineProperty(response, 'url', { value: 'https://landing.other.example/home' });
    const { fetch } = mockFetch(response);
    const error = await expectError(
      requestJson(bankAccess, 'accounts', new URLSearchParams(), { fetch }),
    );
    expect(error).toBeInstanceOf(TransportError);
    expect(error.message).toMatch(/off-origin/);
  });

  it('rejects non-JSON success bodies instead of parsing garbage', async () => {
    const { fetch } = mockFetch(htmlResponse(200));
    const error = await expectError(
      requestJson(access, 'accounts', new URLSearchParams(), { fetch }),
    );
    expect(error).toBeInstanceOf(TransportError);
  });

  it('maps each protocol status to its typed error with string details attached', async () => {
    const cases: { response: Response; kind: string; detail: string }[] = [
      {
        response: jsonResponse(400, { errors: ['Bad date range'], accounts: [] }),
        kind: 'BadRequestError',
        detail: 'Bad date range',
      },
      {
        response: jsonResponse(402, { errors: ['Payment required'], accounts: [] }),
        kind: 'PaymentRequiredError',
        detail: 'Payment required',
      },
      {
        response: jsonResponse(403, { errors: ['Forbidden'], accounts: [] }),
        kind: 'AccessRevokedError',
        detail: 'Forbidden',
      },
      {
        response: jsonResponse(429, { errors: ['Rate limit exceeded'], accounts: [] }),
        kind: 'RateLimitError',
        detail: 'Rate limit exceeded',
      },
      {
        response: jsonResponse(500, { errors: ['Boom'], accounts: [] }),
        kind: 'ServerError',
        detail: 'Boom',
      },
    ];
    for (const { response, kind, detail } of cases) {
      const { fetch } = mockFetch(response);
      const thrown = await expectError(
        requestJson(access, 'accounts', new URLSearchParams(), { fetch }),
      );
      expect(thrown.name).toBe(kind);
      expect((thrown as AccessRevokedError).errors).toEqual([detail]);
    }
  });

  it('classifies an HTML 403 as a transport problem, never a revoked token', async () => {
    const { fetch } = mockFetch(htmlResponse(403));
    const error = await expectError(
      requestJson(access, 'accounts', new URLSearchParams(), { fetch }),
    );
    expect(error).toBeInstanceOf(TransportError);
    expect(error).not.toBeInstanceOf(AccessRevokedError);
    expect(error.status).toBe(403);
  });

  it('treats null-errlist and junk-errlist 403 bodies as non-protocol (never mislabeled)', async () => {
    for (const body of [{ errlist: null }, { errlist: 'spam' }, { errors: null }]) {
      const { fetch } = mockFetch(jsonResponse(403, body));
      const error = await expectError(
        requestJson(access, 'accounts', new URLSearchParams(), { fetch }),
      );
      expect(error).toBeInstanceOf(TransportError);
      expect(error).not.toBeInstanceOf(AccessRevokedError);
    }
  });

  it('classifies an empty-errlist-array 403 as protocol (v2 servers may send [])', async () => {
    const { fetch } = mockFetch(jsonResponse(403, { errlist: [], accounts: [] }));
    await expect(
      requestJson(access, 'accounts', new URLSearchParams(), { fetch }),
    ).rejects.toBeInstanceOf(AccessRevokedError);
  });

  it('treats an empty-JSON 403 body as non-protocol', async () => {
    const { fetch } = mockFetch(jsonResponse(403, {}));
    const error = await expectError(
      requestJson(access, 'accounts', new URLSearchParams(), { fetch }),
    );
    expect(error).toBeInstanceOf(TransportError);
  });

  it('wraps network failures', async () => {
    const fetch = () => Promise.reject(new Error('dns failure'));
    const error = await expectError(
      requestJson(access, 'accounts', new URLSearchParams(), { fetch }),
    );
    expect(error).toBeInstanceOf(TransportError);
    expect(error.message).toMatch(/failed/);
  });

  it('supports an injected abort signal', async () => {
    const controller = new AbortController();
    controller.abort();
    const { fetch } = mockFetch(jsonResponse(200, { accounts: [] }));
    await expect(
      requestJson(access, 'accounts', new URLSearchParams(), { fetch, signal: controller.signal }),
    ).rejects.toBeInstanceOf(TransportError);
  });

  it('rejects a 2xx response whose JSON body cannot be parsed', async () => {
    const broken = new Response('{trunc', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const { fetch } = mockFetch(broken);
    await expect(
      requestJson(access, 'accounts', new URLSearchParams(), { fetch }),
    ).rejects.toBeInstanceOf(TransportError);
  });

  it('classifies an error status with an unparseable JSON body as transport-level', async () => {
    const broken = new Response('oops', {
      status: 403,
      headers: { 'content-type': 'application/json' },
    });
    const { fetch } = mockFetch(broken);
    const error = await expectError(
      requestJson(access, 'accounts', new URLSearchParams(), { fetch }),
    );
    expect(error).toBeInstanceOf(TransportError);
  });

  it('maps unrecognized statuses to the generic HttpError', async () => {
    const { fetch } = mockFetch(jsonResponse(418, { errors: ["I'm a teapot"], accounts: [] }));
    const error = await expectError(
      requestJson(access, 'accounts', new URLSearchParams(), { fetch }),
    );
    expect(error.name).toBe('HttpError');
    expect(error.status).toBe(418);
  });

  it('extracts messages from v2-style errlist entries on error bodies', async () => {
    const { fetch } = mockFetch(
      jsonResponse(403, {
        errlist: [{ code: 'gen.auth', msg: 'No credentials provided' }, { code: 'con.auth' }],
        accounts: [],
      }),
    );
    const error = await expectError(
      requestJson(access, 'accounts', new URLSearchParams(), { fetch }),
    );
    expect(error).toBeInstanceOf(AccessRevokedError);
    expect((error as AccessRevokedError).errors).toEqual(['No credentials provided']);
  });

  it('surfaces missing-fetch environment misuse as TypeError, not TransportError', async () => {
    vi.stubGlobal('fetch', undefined);
    try {
      await expect(requestJson(access, 'accounts', new URLSearchParams())).rejects.toBeInstanceOf(
        TypeError,
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('routes the never-sent 401 to the generic HttpError without special-casing', async () => {
    const { fetch } = mockFetch(jsonResponse(401, { errors: ['whoops'], accounts: [] }));
    const error = await expectError(
      requestJson(access, 'accounts', new URLSearchParams(), { fetch }),
    );
    expect(error.name).toBe('HttpError');
  });

  it('attaches structured errlist entries to HttpErrors', async () => {
    const { fetch } = mockFetch(
      jsonResponse(403, { errlist: [{ code: 'gen.auth', msg: 'Forbidden' }], accounts: [] }),
    );
    const error = (await expectError(
      requestJson(access, 'accounts', new URLSearchParams(), { fetch }),
    )) as AccessRevokedError;
    expect(error.errlist).toEqual([{ code: 'gen.auth', msg: 'Forbidden' }]);
    expect(error.errors).toEqual(['Forbidden']);
  });

  it('falls back to the ambient fetch when none is injected', async () => {
    const { calls, fetch } = mockFetch(jsonResponse(200, { accounts: [] }));
    vi.stubGlobal('fetch', fetch);
    try {
      await requestJson(access, 'accounts', new URLSearchParams());
    } finally {
      vi.unstubAllGlobals();
    }
    expect(calls).toHaveLength(1);
  });

  it('refuses same-host scheme and port changes (redirect origin drift)', async () => {
    for (const target of [
      'http://beta-bridge.simplefin.org/simplefin/accounts',
      'https://beta-bridge.simplefin.org:8443/simplefin/accounts',
    ]) {
      const response = jsonResponse(200, { accounts: [] });
      Object.defineProperty(response, 'url', { value: target });
      const { fetch } = mockFetch(response);
      await expect(
        requestJson(access, 'accounts', new URLSearchParams(), { fetch }),
      ).rejects.toBeInstanceOf(TransportError);
    }
  });

  it('detects protocol error bodies even when content-type is mangled', async () => {
    const mangled = new Response(JSON.stringify({ errors: ['Forbidden'], accounts: [] }), {
      status: 403,
      headers: { 'content-type': 'text/plain' },
    });
    const { fetch } = mockFetch(mangled);
    await expect(
      requestJson(access, 'accounts', new URLSearchParams(), { fetch }),
    ).rejects.toBeInstanceOf(AccessRevokedError);
  });

  it('keeps query strings out of error properties and messages', async () => {
    const { fetch } = mockFetch(jsonResponse(400, { errors: ['Bad'], accounts: [] }));
    const query = new URLSearchParams({ account: 'SECRET-ACCT-999' });
    const error = await expectError(requestJson(access, 'accounts', query, { fetch }));
    expect((error as HttpError).url).not.toMatch(/SECRET|account=/);
    expect(error.message).not.toMatch(/SECRET/);
  });
});
