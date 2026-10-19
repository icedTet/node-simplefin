import { describe, expect, it } from 'vitest';
import { claim } from '../../src/claim';
import { ClaimError, InvalidTokenError, TransportError } from '../../src/errors';
import { encodeSetupToken, htmlResponse, mockFetch, textResponse } from './helpers';

const CLAIM_URL = 'https://beta-bridge.simplefin.org/simplefin/claim/TOKEN123';
const ACCESS_URL = 'https://id123:key456@beta-bridge.simplefin.org/simplefin';

describe('claim', () => {
  it('POSTs to the decoded claim URL and returns the trimmed access URL', async () => {
    const { calls, fetch } = mockFetch(textResponse(200, ` ${ACCESS_URL}\n`));
    await expect(claim(encodeSetupToken(CLAIM_URL), { fetch })).resolves.toBe(ACCESS_URL);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(CLAIM_URL);
    expect(calls[0]!.init?.method).toBe('POST');
    // CORS-simple: no custom headers may ever be set on the claim POST.
    expect(calls[0]!.init?.headers).toBeUndefined();
  });

  it('rewrites the legacy bridge host up front instead of following its path-dropping 302', async () => {
    const legacy = 'https://bridge.simplefin.org/simplefin/claim/ABC';
    const { calls, fetch } = mockFetch(textResponse(200, ACCESS_URL));
    await claim(encodeSetupToken(legacy), { fetch });
    expect(calls[0]!.url).toBe('https://beta-bridge.simplefin.org/simplefin/claim/ABC');
  });

  it('throws InvalidTokenError before any network call for non-https tokens', async () => {
    const { calls, fetch } = mockFetch(textResponse(200, ACCESS_URL));
    await expect(
      claim(encodeSetupToken('http://evil.example/claim/x'), { fetch }),
    ).rejects.toBeInstanceOf(InvalidTokenError);
    expect(calls).toHaveLength(0);
  });

  it('throws InvalidTokenError for undecodable input', async () => {
    const { fetch } = mockFetch(textResponse(200, ACCESS_URL));
    await expect(claim('not base64 at all!!', { fetch })).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('maps a 403 refusal to ClaimError warning about compromise', async () => {
    const { fetch } = mockFetch(textResponse(403, 'Forbidden (was it already claimed?)'));
    await expect(claim(encodeSetupToken(CLAIM_URL), { fetch })).rejects.toBeInstanceOf(ClaimError);
    await expect(claim(encodeSetupToken(CLAIM_URL), { fetch })).rejects.toThrow(/compromised/);
  });

  it('maps unexpected statuses and malformed bodies to TransportError', async () => {
    const { fetch } = mockFetch(textResponse(404, 'nope'));
    await expect(claim(encodeSetupToken(CLAIM_URL), { fetch })).rejects.toBeInstanceOf(
      TransportError,
    );
    const bad = mockFetch(textResponse(200, 'hello, not a url'));
    await expect(claim(encodeSetupToken(CLAIM_URL), { fetch: bad.fetch })).rejects.toBeInstanceOf(
      TransportError,
    );
    const insecure = mockFetch(textResponse(200, 'http://host/simplefin'));
    await expect(
      claim(encodeSetupToken(CLAIM_URL), { fetch: insecure.fetch }),
    ).rejects.toBeInstanceOf(TransportError);
    const noCreds = mockFetch(textResponse(200, 'https://host/simplefin'));
    await expect(
      claim(encodeSetupToken(CLAIM_URL), { fetch: noCreds.fetch }),
    ).rejects.toBeInstanceOf(TransportError);
  });

  it('wraps network failures in TransportError', async () => {
    const fetch = () => Promise.reject(new Error('socket closed'));
    await expect(claim(encodeSetupToken(CLAIM_URL), { fetch })).rejects.toBeInstanceOf(
      TransportError,
    );
  });
});

describe('claim hardening (gate round 1)', () => {
  it('rejects credential-bearing claim URLs before any network call', async () => {
    const { calls, fetch } = mockFetch(textResponse(200, ACCESS_URL));
    await expect(
      claim(encodeSetupToken('https://u:p@host/claim/x'), { fetch }),
    ).rejects.toBeInstanceOf(InvalidTokenError);
    expect(calls).toHaveLength(0);
  });

  it('separates protocol 403 refusals from edge/UA 403 pages', async () => {
    const plain = mockFetch(textResponse(403, 'Forbidden (was it already claimed?)'));
    await expect(claim(encodeSetupToken(CLAIM_URL), { fetch: plain.fetch })).rejects.toBeInstanceOf(
      ClaimError,
    );

    const html = mockFetch(htmlResponse(403));
    await expect(claim(encodeSetupToken(CLAIM_URL), { fetch: html.fetch })).rejects.toThrow(
      TransportError,
    );
    const error = await claim(encodeSetupToken(CLAIM_URL), { fetch: html.fetch }).catch(
      (e: unknown) => e as Error,
    );
    expect(error).not.toBeInstanceOf(ClaimError);

    const bare = new Response('Forbidden (was it already claimed?)', { status: 403 });
    await expect(
      claim(encodeSetupToken(CLAIM_URL), { fetch: mockFetch(bare).fetch }),
    ).rejects.toBeInstanceOf(ClaimError);
  });

  it('refuses claim responses that arrive from another origin', async () => {
    const response = textResponse(200, ACCESS_URL);
    Object.defineProperty(response, 'url', { value: 'https://evil.example/landing' });
    await expect(
      claim(encodeSetupToken(CLAIM_URL), { fetch: mockFetch(response).fetch }),
    ).rejects.toThrow(/off-origin/);
  });
});
