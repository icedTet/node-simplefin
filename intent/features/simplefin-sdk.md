---
type: feature
status: in-progress
provenance: declared
updated: 2026-10-19
code: [src/, intent/maps/external.md]
---

# Feature: simplefin-sdk

Ship-ready TypeScript npm package (`node-simplefin`) implementing the SimpleFIN client
protocol, with a full test suite, isomorphic runtime support, and this intent wiki.

## Why

Users of apps in the SimpleFIN ecosystem (budgeting tools, ledgers) need a maintained,
type-safe client; existing SDKs are thin/unmaintained or generated-only. The repo owner
wants production quality: typed errors, string-exact amounts, live-verified protocol
behavior, CI-gated reviews.

## Touches

[../architecture.md](../architecture.md) · [../maps/external.md](../maps/external.md) ·
[../maps/internal.md](../maps/internal.md) · [../testing.md](../testing.md)

## Impact

New package, no consumers yet — breaking changes allowed until v1.0.0. npm name
`node-simplefin` verified unclaimed (2026-10-19).

## Stage plan & gates

Each stage: implement (micro-commits) → **Gate A** thermonuclear code-quality review
(subagent) → **Gate B** adversarial verification of A's claims (subagent; only
validated findings are fixed) → **Gate C** adversarial behavior review against this
wiki (subagent) → loop until green → commit, push, tag `stage-N`, CI green before next.

| Stage | Deliverable | DoD |
|---|---|---|
| 0 | Toolchain, CI, wiki bootstrap | lint/typecheck/test/build/smoke/pack green locally; CI workflow committed |
| 1 | claim + access-url + http + client (v1) + errors | unit tests incl. all error mappings; scenario tests below pass |
| 2 | v2 + normalize + passthrough fields | version-normalization invariants tested |
| 3 | full suite, integration opt-in, sync helpers | coverage ≥90%; integration run documented in this page |
| 4 | README/docs/CHANGELOG, publish config | `npm pack` clean; docs match API |

## Contract — behavioral scenarios

- **claim**
  - Given a valid base64 setup token, When `claim(token)` is called, Then POST (empty body)
    hits the decoded claim URL and resolves with the trimmed Access URL string.
  - Given an already-used token, When `claim` gets status 403 **with the protocol's
    `text/plain` refusal body**, Then a `ClaimError` is thrown whose message tells the user
    the token may be compromised; a 403 with any other body (edge/UA block) must surface as
    a transport error, not a false revocation.
  - Given a setup token decoding to a non-HTTPS URL, When `claim`, Then it throws
    `InvalidTokenError` before any network call.
- **client**
  - Given an access URL, When `getAccounts()`, Then the request carries
    `Authorization: Basic`, a package User-Agent, and never embeds userinfo in the URL.
  - Given a revoked token (403 with protocol error body from /accounts), Then
    `AccessRevokedError` (not 401-based); a bodyless 403 maps to a transport error.
  - Given a 429, Then `RateLimitError`; given 402, `PaymentRequiredError`.
  - Given v1 response, When normalized, Then output shape equals v2-normalized shape:
    account carries `connId`; org fields appear as a `connection` entry; `errors` strings
    surface alongside `errlist` with prefix fallback.
  - Given any amount/balance, Then its type is `string` and byte-equal to the wire value.
  - Given `pending: false`, Then the request contains **no** `pending` param; given true, `pending=1`.
  - Given a 302 to a different host, Then no follow-through happens silently: either an
    explicit safe rewrite (bridge→beta-bridge, same API path) or a `RedirectError`.
- **sync (stage 3)**
  - Given a range >90 days, Then it is split into ≤90-day windows with ≥5-day overlaps.

## Definition of Done (v0.1.0 ship)

API frozen for stages 1–3, all gates green, CI green on Node 22/24 + Bun + Deno,
integration e2e demonstrated once on demo token (logged below), wiki pages `current`
with `provenance: declared`, README quickstart copy-pastable.

## Status log

## [2026-10-19] decision | Protocol surface corrected: no /updates/cursor endpoints exist (Plaid conflation); SDK implements /info /claim /accounts with date-window polling. See maps/external.md.
## [2026-10-19] implement | Stage 0 complete locally (toolchain + CI + wiki); gates pending.
## [2026-10-19] review | Stage-0 gates: A NOT READY (isomorphism guard ineffective, CI node20 row invalid, coverage cmd red, tautology tests), C NOT READY (13 findings). B adjudicated: A1-A8/A10 + C-F1..F14 validated; C-F3 (external.md self-contradiction) FALSE-POSITIVE via live re-probe (bridge 302 → bare root, path dropped). All validated fixes applied; judgment calls taken: exports default condition added, engines floor >=22, pointer-comment deviation accepted until intent/modules/ exists (Stage 1).
## [2026-10-19] review | Round 2: A NOT READY (N1 TS1471 CJS types — validated via consumer probe, N2 builtin/globals guard gap — validated, N3 engines note), C PASS w/ reservations (403 taxonomy over-broad — validated as wiki fix). B: N5 and NodeNext-half of N1 FALSE-POSITIVE. Fixes: nested exports conditions (probe now clean), builtinModules-pattern lint + no-restricted-globals (both proven to fire), 403-mapping conditioned on protocol error bodies everywhere, code: pointers completed, dev-floor documented.
## [2026-10-19] review | Round 3: Gate A APPROVE, Gate C PASS (3 LOW polish: residual unconditional claim-403 wording, stale stage-0 tag, incomplete backstop citation) — all fixed; stage-0 tag moved to green HEAD. Stage 0 shipped.

## Outcome

(pending)
