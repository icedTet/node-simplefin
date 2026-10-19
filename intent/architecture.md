---
type: architecture
status: in-progress
provenance: mixed
updated: 2026-10-19
code: [package.json, tsup.config.ts, tsconfig.src.json, eslint.config.js, src/index.ts]
---

# Architecture

## What this is

`node-simplefin` is an isomorphic TypeScript SDK for the SimpleFIN protocol ("RSS for
financial data"): a read-only HTTP API where a user hands the app a *setup token*
(base64 claim URL), the app exchanges it once for an *access URL* containing Basic-auth
credentials, then polls `{access}/accounts`. Facts and quirks: [maps/external.md](maps/external.md).

## Design positions (declared)

- **Isomorphic, zero runtime deps.** Only global `fetch` / `URL` / base64 via a bundled
  polyfill-safe helper. `src/` is typechecked as its own program (`tsconfig.src.json`,
  `types: []`) so Node globals and `node:` module imports fail there, with a lint
  backstop (`no-restricted-imports` over all builtin modules + `no-restricted-globals` on
  `src/**`); `lib` includes DOM so browser globals
  are allowed. Runs in Node ≥22, Bun, Deno, browsers (the bridge sends permissive CORS
  headers; see external.md).
- **Amounts are strings.** Balances/amounts are decimal strings end to end; the SDK never
  parses to float. Formatting/money math is the consumer's job (documented in README).
- **v1 default, v2 opt-in, normalized outward.** Requests default to the bridge's v1
  shape; `version: 2` opts in. A normalize layer presents one shape to callers
  (`connections` model) so no caller branches on protocol version.
- **Errors are typed outcomes, not strings.** `403` **with a protocol response body** (`text/plain`
  refusal on claim, `errors`/`errlist` on accounts) ⇒
  `AccessRevokedError`/`ClaimError` (never 401 in this protocol); a `403` lacking one (e.g.
  a Cloudflare edge block) surfaces as a distinct transport error, not a false revocation.
  `402` ⇒ `PaymentRequiredError`, `429` ⇒ `RateLimitError`,
  `5xx` ⇒ `ServerError`, protocol error lists (`errors`/`errlist`) attached when present.
- **Never silently follow cross-host redirects.** Bridge→beta-bridge 302s drop paths and
  credentials; client uses `redirect: 'manual'` and rewrites known-safe cases explicitly.

## Planned modules (land in Stage 1+)

| Module | Responsibility | Lands |
|---|---|---|
| `src/index.ts` | public API surface | 1 |
| `src/claim.ts` | setup token → access URL | 1 |
| `src/access-url.ts` | parse/store access URLs, split credentials | 1 |
| `src/http.ts` | fetch wrapper: auth, UA, redirects, status→error | 1 |
| `src/client.ts` | `SimplefinClient` public class over http + normalize | 1 |
| `src/types.ts` | wire + normalized models (v1/v2) | 1–2 |
| `src/errors.ts` | error taxonomy | 1 |
| `src/normalize.ts` | v1→normalized, errlist code fallback | 2 |
| `src/sync.ts` | date-window helpers (90-day cap, 5-day overlap) | 3 |

## Build & toolchain

tsup (ESM+CJS+dts), vitest (unit hermetic; integration opt-in), eslint strictTypeChecked,
prettier. CI (GitHub Actions) runs lint/typecheck/build/coverage/pack on Node 22 and a
runtime matrix (Node 22+24, Bun, Deno) builds and smokes the bundle. Stage workflow:
implement → review gates A/B/C green → commit+push+tag.
See [features/simplefin-sdk.md](features/simplefin-sdk.md).
