---
type: testing
status: in-progress
provenance: declared
updated: 2026-10-19
code: [test/, vitest.config.ts, .github/workflows/ci.yml]
---

# Testing

## Layers

1. **Unit (hermetic, default `npm test`)** — every HTTP interaction mocked via injected
   `fetch`. Fixtures recorded from live bridge responses (see external.md provenance).
   No network in CI. Coverage thresholds 90% (lines/functions/branches/statements).
2. **Toolchain tests** — package.json exports map vs tsup output; guards for isomorphism
   (no `node:` imports in `src/`).
3. **Runtime smoke** — built ESM bundle imported under Node 20/22, Bun, Deno in CI
   (`scripts/smoke.mjs`). Proves the zero-dep/isomorphic promise.
4. **Integration (opt-in, never in PR CI)** — `SIMPLEFIN_INTEGRATION=1`: claims a fresh
   demo token from `beta-bridge.simplefin.org` developer page and runs claim→accounts
   e2e for v1 and v2 shapes, incl. 90-day-cap errlist and revoked-token path if feasible.

## What must never regress (contract invariants)

- Amounts stay strings through the entire pipeline (assert with fixtures containing
  high-precision decimals; a float parse anywhere fails a test).
- 403 mapping: claim → `ClaimError`, accounts → `AccessRevokedError`. 401 is never produced.
- `pending=0` is treated as *include pending* (presence check), omit to exclude.
- Unknown `errlist` codes fall back to naked-prefix handling (`act.failedXYZ` behaves as `act.`).
- Redirects are never followed across hosts; userinfo never reaches a `fetch` URL.
- SDK sends a meaningful User-Agent; claim POST sends no custom headers (CORS-simple).

## Commands

`npm test` · `npm run test:coverage` · `npm run smoke` · `SIMPLEFIN_INTEGRATION=1 npx vitest run test/integration` (Stage 3)
