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
| 3 | full suite, integration opt-in, sync helpers | coverage ≥90%; integration run documented in this page incl. live edge/UA-403 discrimination re-verify (modules/claim.md) |
| 4 | README/docs/CHANGELOG, publish config | `npm pack` clean; docs match API |

## Contract — behavioral scenarios

- **claim**
  - Given a valid base64 setup token, When `claim(token)` is called, Then POST (empty body,
    no custom headers) hits the decoded claim URL and resolves with the trimmed Access URL.
  - Given a token decoding to a non-https or credential-bearing URL, When `claim`, Then
    `InvalidTokenError` thrown **before any network call**.
  - Given a claim 403 with the protocol's text/plain refusal, Then `ClaimError` whose
    message tells the user the token may be compromised; **a 403 with any other body
    (edge/UA block) surfaces as `TransportError`, never a false compromise alarm**.
  - Given a claim response arriving from another origin, Then `TransportError`.
- **client**
  - Given an access URL, When `getAccounts()`, Then the request carries
    `Authorization: Basic` + `Accept`, and never embeds userinfo in the URL.
  - Given a revoked token (403 with protocol error body from /accounts), Then
    `AccessRevokedError` (not 401-based); a bodyless/HTML 403 maps to `TransportError`.
  - Given a 429, Then `RateLimitError`; given 402, `PaymentRequiredError`.
  - Given v1 response, When normalized, Then output shape equals v2-normalized shape:
    account carries `connectionId`; org fields appear as a `connection` entry.
    (v2 `errlist` projection with naked-prefix fallback: Stage 2.)
  - Given any amount/balance, Then its type is `string` and byte-equal to the wire value.
  - Given `pending: false`, Then the request contains **no** `pending` param; given true, `pending=1`.
  - Given a response served from a different origin (redirect), Then `TransportError` —
    either after a known-safe host rewrite (bridge→beta) or via the final-URL origin check.
  - Given a 200 payload that is not a v1 AccountSet (shape or entry types wrong), Then
    `TransportError`, not a crash deep in mapping.
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
## [2026-10-19] implement | Stage 1: claim/access-url/net/http/client/normalize/types/errors landed; 39 unit tests, coverage 92-100%, all module pages written; UA stance corrected to runtime-native (no custom header; CORS-safe).
## [2026-10-19] review | Stage-1 gates: A + C both NOT READY (13+10 findings); B adjudicated with Node/Bun/Deno runtime probes. Validated+fixed: claim userinfo gate, claim+http off-origin refusal (origin, not hostname — closes port/scheme drift), 403 protocol-body discrimination on the claim path too, normalizeV1 unknown-input boundary predicate (crash→TransportError), InvalidAccessUrlError taxonomy completion, error url query-stripping, URIError leak closed, mockFetch clone-per-call, hasOwn/Map host table. Doc-only: errlist scenario re-scoped to Stage 2 (wire default is v1 — feature page was mis-scoped), stale UA/RedirectError contract bullets rewritten, http ordering prose aligned. FALSE-POSITIVE: none material; manual-redirect redesign rejected (browser-divergent, no security gain). Round 2 pending.

## [2026-10-19] review | Stage-1 round 2: A APPROVE (3 LOW follow-ups taken immediately: resolveFetch hoisting so env-misuse stays TypeError, claim no-CT branch testable+tested, predicate optional-field validation; nits: cause-enumerability, ct slice, body cancel fire-and-forget after a teed-clone hang regression, comment accuracy). C NOT READY docs-only: testing.md errlist Stage-2 tag, fixtures wording, claim.md branch semantics, http.md depended-on-by, integration promise mirrored, README example aligned. stage-1 tag moves to green HEAD after round 3 confirmation.

## Outcome

(pending)
