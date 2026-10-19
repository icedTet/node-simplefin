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
- Root: `SimplefinError extends Error`; everything user-input- or protocol-related the SDK
  throws is a descendant — a `catch (e instanceof SimplefinError)` world is closed
  (plain TypeError only for environment misuse, e.g. no-fetch-and-none-injected).
- `HttpError` adds `status`, `url` (origin+pathname only — queries excluded), `errors: string[]`.
- `HttpError.errlist: ProtocolError[]` — structured protocol errors (via wire.projectErrlist)
  when the body carried an errlist array; classify with errorPrefix (normalize.md).
- `HttpError` takes an options object (`{status, url, errors?, errlist?}`); the v2 errlist
  arg made the positional ctor 5-wide, frozen pre-1.0 into a record ctor.
- Taxonomy: `InvalidTokenError` (setup token), `InvalidAccessUrlError` (access URL),
  `ClaimError` (403 with protocol refusal body), `AccessRevokedError` (403 with protocol
  error body on data), `PaymentRequiredError` (402), `RateLimitError` (429),
  `BadRequestError` (400), `ServerError` (5xx), `TransportError` (network/off-origin/
  non-protocol body — "the wire lied", incl. a 403 lacking a protocol error body such as a
  Cloudflare edge/UA block — never an auth verdict).
- 401 is never produced by this protocol — none defined.
- `ClaimError` default message carries the compromise/disable guidance required by the
  spec checklist (external.md security invariants).

## Dependencies
Depended on by: [[modules/http]], [[modules/claim]], [[modules/net]], [[modules/access-url]],
[[modules/normalize]], [[modules/wire]] (types only). Related: [[maps/external]]

## Constraints
- `name` equals class name (`new.target`) — stable for serialization/logging.
- Messages/properties must not embed credentials or query strings; `cause` chains must not
  echo secrets (validated: userinfo rejected pre-network in claim).

## Implementation pointers
`src/errors.ts`


