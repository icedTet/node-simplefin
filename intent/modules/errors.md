---
type: module
status: current
provenance: declared
updated: 2026-10-19
code: [src/errors.ts]
---

# Module: errors

## Intent
Typed outcomes instead of stringly-typed throws, so apps can branch on
`instanceof` (retry vs. re-link vs. tell-the-user) without parsing messages.

## Contract
- Root: `SimplefinError extends Error`; `HttpError` adds `status`, `url`, `errors: string[]`.
- Taxonomy: `InvalidTokenError` (offline validation), `ClaimError` (403 on claim),
  `AccessRevokedError` (403 **with protocol body**), `PaymentRequiredError` (402),
  `RateLimitError` (429), `BadRequestError` (400), `ServerError` (5xx), `TransportError`
  (network/redirect/content-type/bodyless-403 — "the wire lied", not an auth verdict).
- 401 is never produced by this protocol — none defined.
- `ClaimError`'s default message carries the compromise guidance required by the spec
  checklist (external.md security invariants).

## Dependencies
Produced by: [[modules/http]], [[modules/claim]]. Consumed by everyone. Related: [[maps/external]]

## Constraints
- `name` equals class name (set via `new.target`) — stable for serialization/logging.
- Error messages must not embed the access URL credentials or secrets from query strings;
  `HttpError.url` keeps the credential-free root + path only.

## Implementation pointers
`src/errors.ts`

## Known gaps
- v2 `errlist` structured codes live on the wire side; errors expose only `errors: string[]`
  until Stage 2 decides (candidates: `code` field or errlist array).
