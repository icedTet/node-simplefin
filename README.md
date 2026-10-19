# node-simplefin

Isomorphic TypeScript client for the [SimpleFIN](https://www.simplefin.org/protocol.html) protocol — read-only access to bank accounts and transactions via claim/setup tokens.

> Status: under construction. See `intent/` for the living spec and `intent/features/simplefin-sdk.md` for rollout state.

## Install

```sh
npm install node-simplefin
```

## Usage (will be finalized in Stage 1)

```ts
import { claim, SimplefinClient } from 'node-simplefin';

const accessUrl = await claim(setupTokenFromUser);
const client = new SimplefinClient(accessUrl);
const data = await client.getAccounts({ version: 2, pending: true });
```

## Requirements

- Any runtime with global `fetch`: Node.js >= 18, Bun, Deno, modern browsers (bridge CORS supported).
- Amounts are exposed as strings; parse with a decimal-safe type of your choice.

## Development

```sh
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

Integration tests against the live beta bridge are opt-in; see `intent/testing.md`.

## License

MIT
