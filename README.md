# node-simplefin

Isomorphic TypeScript client for the [SimpleFIN](https://www.simplefin.org/protocol.html)
protocol — read-only bank accounts and transactions via user-pasted setup tokens.
Runs on Node ≥ 22, Bun, Deno, and modern browsers. Zero runtime dependencies.

> The living spec for this package lives in [`intent/`](https://github.com/icedTet/node-simplefin/tree/main/intent);
> rollout state in
> [`intent/features/simplefin-sdk.md`](https://github.com/icedTet/node-simplefin/blob/main/intent/features/simplefin-sdk.md).

## Install

```sh
npm install node-simplefin
```

## Quickstart

```ts
import { claim, SimplefinClient } from 'node-simplefin';

// 1. Send the user to https://bridge.simplefin.org/simplefin/create (or your bank's
//    SimpleFIN server); they copy a Setup Token back to you.
const accessUrl = await claim(setupToken);

// 2. Keep using the access URL afterwards. Store it like financial data.
const client = new SimplefinClient(accessUrl);
const { accounts, connections, errors } = await client.getAccounts({
  startDate: new Date('2026-01-01'),
  pending: true,
});
```

Multi-month syncs, quota-safely:

```ts
import { collectAccounts } from 'node-simplefin';

const set = await collectAccounts(client, {
  startDate: new Date('2025-01-01'),
  endDate: new Date(),
});
```

`collectAccounts` fetches ≤ 45-day windows with 5-day overlaps, sequentially, and refuses
to burn more than the bridge's ~24 requests/day budget before making any request.

## Types & semantics

- **Amounts and balances are decimal strings** (`"250.4201"`) end to end. Parse them with
  a decimal type of your choice; the SDK never touches float. Positive = deposit.
- `posted` is unix seconds; `0` means pending — use `transactedAt` for the real time.
- The response model is **version-independent**: v1 and v2 wires both normalize to
  `{ errors, errlist, connections, accounts }`. Classify protocol failures with
  `errorPrefix(err.code)` (`"act.failedOurs"` → `"act."`), not the raw code.
- Errors are typed (`instanceof`): `AccessRevokedError`, `RateLimitError`,
  `PaymentRequiredError`, `ClaimError`, `TransportError`, … See
  [`intent/modules/errors.md`](https://github.com/icedTet/node-simplefin/blob/main/intent/modules/errors.md).
- `pkg` is exported for telemetry/version checks (`import { pkg } from 'node-simplefin'`).

## Security notes

- HTTPS only; credentials travel in `Authorization` headers, never in logged URLs.
- A `ClaimError` (403 with the protocol's refusal body) means the setup token was used,
  missing, **or possibly compromised** — tell the user to disable it and create a fresh
  one. (A bodyless 403 is a transport error, not a revocation.)
- Render `errors`/`errlist[].msg` strings only after HTML-sanitizing them: they are
  server-controlled.
- Users can revoke access at any time from their bridge console; you'll see
  `AccessRevokedError` on the next request.

## Rate limits & etiquette

- ≤ ~24 requests per day per token; `429`/`RateLimitError` = back off. Abuse disables the
  token server-side.
- Fetch at a random minute, overlap date windows (~5 days) so boundary transactions are
  never missed — `collectAccounts` does this for you.

## Browsers & runtimes

No build flags needed; global `fetch` is the only requirement. The claim POST stays
CORS-simple; `/accounts` uses the bridge's permissive CORS (`Authorization` allowed via
preflight). Node ≥ 22 recommended (toolchain floor for contributors: ≥ 22.18).

## Development

```sh
npm install
npm run lint && npm run typecheck && npm test   # hermetic
npm run build && npm run smoke                  # dual ESM/CJS + runtime loads
SIMPLEFIN_INTEGRATION=1 npx vitest run test/integration   # live bridge, opt-in
```

## License

MIT
