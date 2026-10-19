// Opt-in live suite: SIMPLEFIN_INTEGRATION=1 npx vitest run test/integration
// Claims a fresh one-time demo token (regenerated on the developer page) and exercises
// the real protocol end to end. Never runs in CI (vitest.config gates the include).
import { describe, expect, it } from 'vitest';
import { claim } from '../../src/claim';
import { SimplefinClient } from '../../src/client';
import { collectAccounts } from '../../src/sync';

const PAGE = 'https://beta-bridge.simplefin.org/info/developers';

async function freshDemoToken(): Promise<string> {
  const html = await (await fetch(PAGE, { headers: { Accept: 'text/html' } })).text();
  const match = html.match(/aHR0[^"'<\s]{40,}={0,2}/g) ?? [];
  const isClaimToken = (t: string) => atob(t).includes('/claim/');
  const token = match.find(isClaimToken);
  if (!token) throw new Error('no demo claim token on page (did the page change?)');
  return token;
}

describe('live bridge (demo credentials)', () => {
  it('claim -> v1 -> v2 -> windowed collect end to end', async () => {
    const accessUrl = await claim(await freshDemoToken());
    const client = new SimplefinClient(accessUrl);
    const start = Math.floor(Date.now() / 1000) - 30 * 86400;

    const v1 = await client.getAccounts({ startDate: start });
    expect(v1.accounts.length).toBeGreaterThan(0);
    expect(typeof v1.accounts[0]!.balance).toBe('string');

    const v2 = await client.getAccounts({ startDate: start, version: 2 });
    expect(v2.accounts.length).toBe(v1.accounts.length);
    expect(v2.connections[0]!.id).toBeDefined();

    const collected = await collectAccounts(client, {
      startDate: start,
      endDate: Math.floor(Date.now() / 1000),
      maxSpanSeconds: 10 * 86400,
      overlapSeconds: 2 * 86400,
    });
    const ids = new Set(collected.accounts[0]!.transactions.map((t) => t.id));
    expect(ids.size).toBe(collected.accounts[0]!.transactions.length); // overlap deduped
  }, 30_000);
});
