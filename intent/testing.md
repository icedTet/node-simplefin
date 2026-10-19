---
type: testing
status: in-progress
provenance: declared
updated: 2026-10-19
code: [test/, scripts/smoke.mjs, vitest.config.ts, .github/workflows/ci.yml]
---

# Testing

## Layers

1. **Unit (hermetic, default `npm test`)** — every HTTP interaction mocked via injected
   `fetch`. Hand-written fixtures today; live-recording harness for `test/fixtures/`
   lands with Stage 3 (see external.md provenance).
   (Stage 1+) No network in CI. Coverage thresholds (90%) run in CI via
   `npm run test:coverage`.
2. **Toolchain tests** — package.json self-consistency (exports map vs manifest fields,
   shipped files, engines floor), identity/version lockstep with `src/index.ts`, and —
   when `dist/` is present — that export targets actually exist. Isomorphism of `src/`
   is enforced by the separate `tsconfig.src.json` typecheck program plus a
   `no-restricted-imports` lint rule, not by tests.
3. **Runtime smoke** — built ESM bundle imported under Node 22/24, Bun, Deno in CI
   (`scripts/smoke.mjs`). Proves the zero-dep/isomorphic promise.
4. **Integration (opt-in, never in PR CI)** — `SIMPLEFIN_INTEGRATION=1`: claims a fresh
   demo token from `beta-bridge.simplefin.org` developer page and runs claim→accounts
   e2e for v1 and v2 shapes, incl. 90-day-cap errlist, revoked-token path if feasible,
   and re-verification of the claim-path edge/UA-403 vs protocol-refusal discrimination
   against the live Cloudflare-fronted edge (promised by modules/claim.md).

## What must never regress (contract invariants)

- Amounts stay strings through the entire pipeline (assert with fixtures containing
  high-precision decimals; a float parse anywhere fails a test).
- 403 mapping: claim → `ClaimError` **only when the body is the protocol's `text/plain`
  refusal**; accounts → `AccessRevokedError` **only with a protocol error body**. A 403
  without either (e.g. Cloudflare edge/UA block) must not be reported as revocation.
  401 is never produced.
- `pending=0` is treated as *include pending* (presence check), omit to exclude.
- Unknown `errlist` codes fall back to naked-prefix handling
  (`act.failedXYZ` behaves as `act.`); error metadata is extracted leniently (a malformed
  *optional* field never deletes the msg) while payload data stays strict (wire.md/normalize.md).
- v1↔v2 symmetry: identical data rendered through both wire shapes yields identical
  models modulo connection-id source (derived-fixture test, not hand-duplicated).
- Live passthroughs (`holdings`, `x-api-message`, connection extras) are captured on
  **both** versions and never fail a payload; `mcc: null` ≡ absent (recorded live census).
- `balances-only` follows the same presence semantics as `pending`.
- 403-with-key-presence-only (`{"errlist":null}`) is a TransportError, never revocation.
- Redirects are never followed across hosts; userinfo never reaches a `fetch` URL.
- Claim POST sends no custom headers (CORS-simple); GETs add `Accept` (safelisted) +
  `Authorization` (allowed by the bridge's preflight, external.md). Runtime-native UAs are
  live-verified acceptable (external.md).

## Commands

`npm test` · `npm run test:coverage` · `npm run smoke` · `SIMPLEFIN_INTEGRATION=1 npx vitest run test/integration` (Stage 3)

Dev prerequisite: Node ≥22.18 for the toolchain itself (tsup/vitest engines); the shipped
package's consumer `engines` floor stays >=22.0.0.
