import { describe, expect, it } from 'vitest';
import { errorPrefix, normalizeV1, normalizeV2 } from '../../src/normalize';
import { TransportError } from '../../src/errors';

describe('normalizeV2', () => {
  it('maps v2 connections and conn_id links to the public model', () => {
    const set = normalizeV2({
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
    });
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

// One shared data set rendered through each wire shape: drift is structurally impossible.
function v1Wire(data: {
  id: string;
  name: string;
  balance: string;
  txn: { id: string; posted: number; amount: string; description: string };
}) {
  return {
    errors: ['shared warning'],
    accounts: [
      {
        id: data.id,
        name: data.name,
        currency: 'USD',
        balance: data.balance,
        org: { domain: 'bank.example', name: 'Bank', 'sfin-url': 'https://sf.bank.example' },
        transactions: [data.txn],
      },
    ],
  };
}

function v2Wire(data: {
  id: string;
  name: string;
  balance: string;
  txn: { id: string; posted: number; amount: string; description: string };
}) {
  return {
    errors: ['shared warning'],
    errlist: [],
    connections: [
      { conn_id: 'c-1', name: 'Bank', org_id: 'bank.example', sfin_url: 'https://sf.bank.example' },
    ],
    accounts: [
      {
        id: data.id,
        name: data.name,
        conn_id: 'c-1',
        currency: 'USD',
        balance: data.balance,
        transactions: [data.txn],
      },
    ],
  };
}

describe('version symmetry', () => {
  it('the same data through both wire shapes yields identical models', () => {
    const data = {
      id: 'acc-1',
      name: 'Checking',
      balance: '250.4200000000000000001',
      txn: { id: 't1', posted: 1759000000, amount: '-10.10', description: 'Cafe' },
    };
    const v1 = normalizeV1(v1Wire(data));
    const v2 = normalizeV2(v2Wire(data));
    expect(v1.errors).toEqual(v2.errors);
    // Connection linkage is the one by-design difference (synthesized vs server id).
    const strip = (set: typeof v1) => set.accounts.map(({ connectionId: _c, ...rest }) => rest);
    expect(strip(v1)).toEqual(strip(v2));
    expect(v1.accounts[0]!.connectionId).toBe(v1.connections[0]!.id);
    expect(v2.accounts[0]!.connectionId).toBe('c-1');
  });
});

describe('live-shaped data (recorded probes 2026-10-19)', () => {
  it('accepts mcc: null on transactions in both wire shapes (null ≡ absent)', () => {
    const account = (extra: Record<string, unknown>) => ({
      id: 'a',
      name: 'A',
      currency: 'USD',
      balance: '1.00',
      transactions: [{ id: 't', posted: 1, amount: '1.00', description: 'd', ...extra }],
    });
    const v1 = normalizeV1({ accounts: [account({ mcc: null })] });
    const v2 = normalizeV2({
      connections: [{ conn_id: 'c', name: 'N', org_id: 'o', sfin_url: 'https://s' }],
      accounts: [{ ...account({ mcc: null }), conn_id: 'c' }],
    });
    expect(v1.accounts[0]!.transactions[0]).not.toHaveProperty('mcc');
    expect(v2.accounts[0]!.transactions[0]).not.toHaveProperty('mcc');
  });

  it('v1 also captures holdings and x-api-message (passthroughs are version-agnostic)', () => {
    const set = normalizeV1({
      'x-api-message': ['hint'],
      accounts: [
        { id: 'a', name: 'A', currency: 'USD', balance: '1.00', holdings: [{ symbol: 'AAPL' }] },
      ],
    });
    expect(set.xApiMessage).toEqual(['hint']);
    expect(set.accounts[0]!.holdings).toEqual([{ symbol: 'AAPL' }]);
  });

  it('malformed holdings entries never fail the account set; non-objects drop', () => {
    const set = normalizeV2({
      connections: [{ conn_id: 'c', name: 'N', org_id: 'o', sfin_url: 'https://s' }],
      accounts: [
        {
          id: 'a',
          name: 'A',
          conn_id: 'c',
          currency: 'USD',
          balance: '1',
          holdings: ['AAPL', { symbol: 'X' }],
        },
      ],
    });
    expect(set.accounts[0]!.holdings).toEqual([{ symbol: 'X' }]);
  });

  it('preserves unmodeled connection fields raw (org_name)', () => {
    const set = normalizeV2({
      connections: [
        {
          conn_id: 'c',
          name: 'SimpleFIN Demo',
          org_id: 'o',
          sfin_url: 'https://s',
          org_name: 'SimpleFIN Bridge',
        },
      ],
      accounts: [],
    });
    expect(set.connections[0]).toMatchObject({ id: 'c', org_name: 'SimpleFIN Bridge' });
  });
});

describe('error helpers leniency split (wire.ts)', () => {
  it('keeps errlist msgs when only optional link fields are malformed', () => {
    const set = normalizeV2({
      errlist: [{ code: 'gen.x', msg: 'Keep me', conn_id: 5 }],
      connections: [],
      accounts: [],
    });
    expect(set.errors).toEqual(['Keep me']);
    expect(set.errlist).toEqual([{ code: 'gen.x', msg: 'Keep me' }]);
  });

  it('deduplicates errors appearing in both legacy and errlist forms', () => {
    const set = normalizeV1({
      errors: ['x'],
      errlist: [{ code: 'gen.api', msg: 'x' }],
      accounts: [],
    });
    expect(set.errors).toEqual(['x']);
  });

  it('x-api-message keeps valid strings when the array is mixed', () => {
    const set = normalizeV1({ accounts: [], 'x-api-message': ['a', 42] });
    expect(set.xApiMessage).toEqual(['a']);
  });

  it('v2 payload errors/errlist are validated as strictly as v1', () => {
    expect(() => normalizeV2({ connections: [], accounts: [], errors: 'oops' })).toThrow(
      TransportError,
    );
    expect(() => normalizeV2({ connections: [], accounts: [], errors: ['x', 5] })).toThrow(
      TransportError,
    );
    expect(() => normalizeV1({ accounts: [], errlist: 'junk' })).toThrow(TransportError);
  });

  it('a malformed errlist entry never fails an otherwise-valid payload (parity with http path)', () => {
    const set = normalizeV1({
      accounts: [{ id: 'a', name: 'A', currency: 'USD', balance: '1' }],
      errlist: [{ code: 'a', msg: 'keep' }, { code: 'b' }],
    });
    expect(set.errors).toEqual(['keep']);
    expect(set.errlist).toEqual([{ code: 'a', msg: 'keep' }]);
  });

  it('v2 account extra passes through', () => {
    const set = normalizeV2({
      connections: [{ conn_id: 'c', name: 'N', org_id: 'o', sfin_url: 'https://s' }],
      accounts: [
        { id: 'a', name: 'A', conn_id: 'c', currency: 'USD', balance: '1', extra: { v: 1 } },
      ],
    });
    expect(set.accounts[0]!.extra).toEqual({ v: 1 });
  });

  it('holdings values are passed through raw, never coerced (schema not guaranteed)', () => {
    const set = normalizeV2({
      connections: [{ conn_id: 'c', name: 'N', org_id: 'o', sfin_url: 'https://s' }],
      accounts: [
        {
          id: 'a',
          name: 'A',
          conn_id: 'c',
          currency: 'USD',
          balance: '1',
          holdings: [{ shares: 10.5, symbol: 'X' }],
        },
      ],
    });
    expect(set.accounts[0]!.holdings![0]!.shares).toBe(10.5);
    expect(typeof set.accounts[0]!.holdings![0]!.shares).toBe('number');
  });

  it('errorPrefix: empty input stays empty; subcodes collapse', () => {
    expect(errorPrefix('')).toBe('');
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
