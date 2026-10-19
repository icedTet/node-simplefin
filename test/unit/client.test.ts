import { describe, expect, it } from 'vitest';
import { parseAccessUrl } from '../../src/access-url';
import { SimplefinClient } from '../../src/client';
import { TransportError } from '../../src/errors';
import { htmlResponse, jsonResponse, mockFetch } from './helpers';

const ACCESS = 'https://abc:def@beta-bridge.simplefin.org/simplefin';

const DEMO_V1 = {
  errors: ['some warning'],
  accounts: [
    {
      id: '1',
      name: 'Demo Savings',
      currency: 'USD',
      balance: '1234.567890123456789',
      'available-balance': '1200.00',
      'balance-date': 1760000000,
      org: { domain: 'example.com', name: 'Example', 'sfin-url': 'https://sf.example.com' },
      transactions: [
        { id: 't1', posted: 1759000000, amount: '-42.10', description: 'Cafe' },
        {
          id: 't2',
          posted: 0,
          amount: '5.00',
          description: 'Paycheck',
          pending: true,
          transacted_at: 1758999000,
        },
      ],
    },
    {
      id: '2',
      name: 'Demo Checking',
      currency: 'USD',
      balance: '10.00',
      org: { domain: 'example.com', name: 'Example', 'sfin-url': 'https://sf.example.com' },
      transactions: [],
    },
    {
      id: '3',
      name: 'Orphan',
      currency: 'GBP',
      balance: '0.00',
      transactions: [],
    },
  ],
};

describe('SimplefinClient.getAccounts', () => {
  it('normalizes v1 wire data to the public model with string amounts intact', async () => {
    const { fetch } = mockFetch(jsonResponse(200, DEMO_V1));
    const client = new SimplefinClient(ACCESS, { fetch });
    const set = await client.getAccounts();

    expect(set.errors).toEqual(['some warning']);
    expect(set.accounts[0]!.balance).toBe('1234.567890123456789');
    expect(set.accounts[0]!.availableBalance).toBe('1200.00');
    expect(set.accounts[0]!.balanceDate).toBe(1760000000);
    expect(set.accounts[0]!.transactions[0]).toMatchObject({ id: 't1', pending: false });
    expect(set.accounts[0]!.transactions[1]).toMatchObject({
      id: 't2',
      posted: 0,
      pending: true,
      transactedAt: 1758999000,
    });

    // Two accounts sharing one org → one deduped connection, both linked.
    expect(set.connections).toHaveLength(1);
    expect(set.accounts[0]!.connectionId).toBe(set.connections[0]!.id);
    expect(set.accounts[1]!.connectionId).toBe(set.connections[0]!.id);
    expect(set.connections[0]).toMatchObject({
      name: 'Example',
      domain: 'example.com',
      sfinUrl: 'https://sf.example.com',
    });
    // Account without org has no connection link.
    expect(set.accounts[2]!.connectionId).toBeUndefined();
  });

  it('builds query params per protocol quirks', async () => {
    const { calls, fetch } = mockFetch(jsonResponse(200, { accounts: [] }));
    const client = new SimplefinClient(ACCESS, { fetch });
    await client.getAccounts({
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: 1759000000,
      pending: true,
      account: ['a', 'b'],
    });
    const query = new URL(calls[0]!.url).searchParams;
    expect(query.get('start-date')).toBe('1767225600');
    expect(query.get('end-date')).toBe('1759000000');
    expect(query.getAll('account')).toEqual(['a', 'b']);
    expect(query.get('pending')).toBe('1');
  });

  it('omits the pending param entirely unless explicitly true (presence semantics)', async () => {
    for (const pending of [undefined, false]) {
      const { calls, fetch } = mockFetch(jsonResponse(200, { accounts: [] }));
      await new SimplefinClient(ACCESS, { fetch }).getAccounts({ pending });
      expect(new URL(calls[0]!.url).searchParams.has('pending')).toBe(false);
    }
  });

  it('surfaces server warning strings without failing the request', async () => {
    const { fetch } = mockFetch(jsonResponse(200, { errors: ['Quota warning'], accounts: [] }));
    const set = await new SimplefinClient(ACCESS, { fetch }).getAccounts();
    expect(set.errors).toEqual(['Quota warning']);
    expect(set.accounts).toEqual([]);
  });

  it('fails on non-JSON success without inventing data', async () => {
    const { fetch } = mockFetch(htmlResponse(200));
    await expect(new SimplefinClient(ACCESS, { fetch }).getAccounts()).rejects.toThrow(
      /application\/json/,
    );
  });

  it('passes through extra objects and name-only orgs without dropping data', async () => {
    const { calls, fetch } = mockFetch(
      jsonResponse(200, {
        accounts: [
          {
            id: 'x',
            name: 'X',
            currency: 'USD',
            balance: '1.00',
            org: { name: 'Name Only' },
            extra: { niche: true },
            transactions: [
              { id: 'tx', posted: 5, amount: '0.10', description: 'd', extra: { raw: 'x' } },
            ],
          },
        ],
      }),
    );
    const set = await new SimplefinClient(ACCESS, { fetch }).getAccounts({ account: 'single' });
    expect(set.connections[0]).toMatchObject({ name: 'Name Only', sfinUrl: '' });
    expect(set.accounts[0]!.extra).toEqual({ niche: true });
    expect(set.accounts[0]!.transactions[0]!.extra).toEqual({ raw: 'x' });
    expect(new URL(calls[0]!.url).searchParams.getAll('account')).toEqual(['single']);
  });

  it('accepts an already-parsed access URL', async () => {
    const { fetch } = mockFetch(jsonResponse(200, { accounts: [] }));
    const client = new SimplefinClient(parseAccessUrl(ACCESS), { fetch });
    await expect(client.getAccounts()).resolves.toMatchObject({ accounts: [], errors: [] });
  });
});

describe('SimplefinClient payload validation', () => {
  for (const [label, payload] of [
    ['empty object', {}],
    ['null', null],
    ['string', 'hi'],
    ['garbage account entry', { accounts: [1] }],
    ['non-string errors', { errors: 'oops', accounts: [] }],
    [
      'transaction missing amount',
      {
        accounts: [
          {
            id: 'a',
            name: 'A',
            currency: 'USD',
            balance: '1',
            transactions: [{ id: 't', posted: 1, description: 'x' }],
          },
        ],
      },
    ],
    [
      'array extra',
      { accounts: [{ id: 'a', name: 'A', currency: 'USD', balance: '1', extra: [] }] },
    ],
    [
      'null optional field',
      {
        accounts: [
          { id: 'a', name: 'A', currency: 'USD', balance: '1', 'available-balance': null },
        ],
      },
    ],
    [
      'string org',
      { accounts: [{ id: 'a', name: 'A', currency: 'USD', balance: '1', org: 'nope' }] },
    ],
  ] as const) {
    it(`raises TransportError for a 200 payload that is not a v1 AccountSet: ${label}`, async () => {
      const { fetch } = mockFetch(jsonResponse(200, payload));
      const error = await new SimplefinClient(ACCESS, { fetch })
        .getAccounts()
        .then(() => null)
        .catch((e: unknown) => e as Error);
      expect(error).toBeInstanceOf(TransportError);
      expect(error?.message).toMatch(/v1 AccountSet/);
    });
  }
});
