# Changelog

All notable changes to this project are documented here; releases are tagged
`vX.Y.Z`. Format follows Keep a Changelog; versions follow semver.

## v0.1.0 — 2026-10-19

First ship-ready release.

### Added

- `claim(setupToken)` — redeem SimpleFIN setup tokens (base64 claim URLs) for access URLs;
  offline validation, CORS-simple POST, protocol-vs-edge 403 discrimination.
- `SimplefinClient` — `getAccounts({ startDate, endDate, pending, account, balancesOnly,
version })` against v1 (default) and v2 (opt-in) wire protocols.
- Version-normalized model: `AccountSet { errors, errlist, connections, accounts }` with
  decimal-string amounts, deterministic connection identities, and passthrough capture of
  live-but-undocumented fields (`holdings`, `payee`, `memo`, `mcc`, `x-api-message`).
- `errorPrefix()` — naked-prefix fallback for v2 error codes.
- `collectAccounts()` / `splitWindows()` — quota-safe date-window sync (45-day windows,
  5-day overlaps, ≤24 req/day guard, posted-ascending merge).
- Typed error taxonomy (`SimplefinError` subclasses); `403` never means
  "revoked" without a protocol body; `401` is never produced.
- Isomorphic: Node ≥ 22, Bun, Deno, browsers; zero runtime dependencies; dual ESM/CJS.
- Test suite: 98 hermetic unit tests incl. recorded live-bridge fixtures with provenance;
  opt-in live integration suite (claim → v1 → v2 → windowed collect).

### Known limitations

- Cloudflare edge/UA-403 discrimination on the claim path is heuristic; live re-verify
  deferred to a private-token run (`intent/testing.md`).
- The 90-day-cap `gen.api` behavior was curl-verified manually but has no scripted live
  integration assertion yet (demo-token budget; `intent/testing.md`).
- v1 custom-currency URL resolution helper not yet shipped (`intent/modules/types.md`).
