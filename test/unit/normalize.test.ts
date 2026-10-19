import { describe, expect, it } from 'vitest';
import { errorPrefix, normalizeV1, normalizeV2 } from '../../src/normalize';
import { TransportError } from '../../src/errors';

const V1_WIRE = {
  errors: ['v1 warning'],
  accounts: [
    {
      id: 'acc-1',
      name: 'Checking',
      currency: 'USD',
      balance: '250.42',
      'available-balance': '240.00',
      'balance-date': 1760000000,
      org: { domain: 'bank.example', name: 'Bank', 'sfin-url': 'https://sf.bank.example' },
      transactions: [{ id: 't1', posted: 1759000000, amount: '-10.10', description: 'Cafe' }],
    },
  ],
};

const V2_WIRE = {
  errlist: [],
  connections: [
    {
      conn_id: 'c-9',
      name: 'Bank',
      org_id: 'bank.example',
      org_url: 'https://bank.example',
      sfin_url: 'https://sf.bank.example',
    },
  ],
  accounts: [
    {
      id: 'acc-1',
      name: 'Checking',
      conn_id: 'c-9',
      currency: 'USD',
      balance: '250.42',
      'available-balance': '240.00',
      'balance-date': 1760000000,
      transactions: [{ id: 't1', posted: 1759000000, amount: '-10.10', description: 'Cafe' }],
    },
  ],
};

describe('normalizeV2', () => {
  it('maps v2 connections and conn_id links to the public model', () => {
    const set = normalizeV2(V2_WIRE);
    expect(set.connections).toEqual([
      {
        id: 'c-9',
        name: 'Bank',
        sfinUrl: 'https://sf.bank.example',
        orgId: 'bank.example',
        url: 'https://bank.example',
      },
    ]);
    expect(set.accounts[0]!.connectionId).toBe('c-9');
    expect(set.errlist).toEqual([]);
  });

  it('captures live-but-undocumented passthrough fields', () => {
    const set = normalizeV2({
      errlist: [],
      connections: [{ conn_id: 'c', name: 'N', org_id: 'o', sfin_url: 'https://s' }],
      'x-api-message': ['Provide a start-date parameter'],
      accounts: [
        {
          id: 'a',
          name: 'A',
          conn_id: 'c',
          currency: 'USD',
          balance: '0.00',
          holdings: [
            {
              created: 1700000000,
              symbol: 'AAPL',
              shares: '10.5',
              market_value: '2000.00',
              mystery: 1,
            },
          ],
          transactions: [
            {
              id: 't',
              posted: 1,
              amount: '1.00',
              description: 'Store',
              payee: 'STORE INC',
              memo: 'STORE 1234',
              mcc: '5812',
            },
          ],
        },
      ],
    });
    expect(set.xApiMessage).toEqual(['Provide a start-date parameter']);
    expect(set.accounts[0]!.holdings![0]).toMatchObject({
      symbol: 'AAPL',
      shares: '10.5',
      mystery: 1,
    });
    expect(set.accounts[0]!.transactions[0]).toMatchObject({
      payee: 'STORE INC',
      memo: 'STORE 1234',
      mcc: '5812',
    });
  });

  it('projects errlist into errors and keeps dangling conn_id links unlinked', () => {
    const set = normalizeV2({
      errlist: [{ code: 'act.failed', msg: 'Try again later', account_id: 'ghost' }],
      connections: [],
      accounts: [{ id: 'a', name: 'A', conn_id: 'nowhere', currency: 'USD', balance: '1.00' }],
    });
    expect(set.errors).toEqual(['Try again later']);
    expect(set.errlist[0]).toEqual({
      code: 'act.failed',
      msg: 'Try again later',
      accountId: 'ghost',
    });
    expect(set.accounts[0]!.connectionId).toBeUndefined();
  });

  it('rejects malformed v2 payloads with TransportError', () => {
    expect(() => normalizeV2({ accounts: [] })).toThrow(TransportError);
    expect(() => normalizeV2({ connections: [{ conn_id: 'c' }], accounts: [] })).toThrow(
      TransportError,
    );
    expect(() => normalizeV2(null)).toThrow(/v2 AccountSet/);
  });
});

describe('version symmetry', () => {
  it('v1 and v2 renderings of the same data normalize to the same model', () => {
    const v1 = normalizeV1(V1_WIRE);
    const v2 = normalizeV2(V2_WIRE);
    // Connection identity differs by design (synthesized vs server-supplied).
    expect(v1.accounts[0]!.connectionId).toBe(v1.connections[0]!.id);
    expect(v1.accounts[0]!.balance).toBe(v2.accounts[0]!.balance);
    expect(v1.accounts[0]!.transactions).toEqual(v2.accounts[0]!.transactions);
    expect(v1.connections[0]!.name).toBe(v2.connections[0]!.name);
    expect(v1.connections[0]!.sfinUrl).toBe(v2.connections[0]!.sfinUrl);
    expect(typeof v1.accounts[0]!.balance).toBe('string');
  });
});

describe('v1 defensive errlist projection', () => {
  it('surfaces errlist msg alongside errors when a bridge mixes shapes', () => {
    const set = normalizeV1({
      errors: ['plain'],
      errlist: [{ code: 'gen.api', msg: 'window capped' }],
      accounts: [],
    });
    expect(set.errors).toEqual(['plain', 'window capped']);
    expect(set.errlist[0]!.code).toBe('gen.api');
  });
});

describe('errorPrefix (naked-prefix fallback)', () => {
  it('collapses known and unknown subcodes to their prefix', () => {
    expect(errorPrefix('act.failed')).toBe('act.');
    expect(errorPrefix('act.failedWeirdSubcode')).toBe('act.');
    expect(errorPrefix('con.auth')).toBe('con.');
    expect(errorPrefix('gen.')).toBe('gen.');
    expect(errorPrefix('gen')).toBe('gen.');
  });
});
