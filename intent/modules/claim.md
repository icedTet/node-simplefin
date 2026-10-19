---
type: module
status: current
provenance: declared
updated: 2026-10-19
code: [src/claim.ts]
---

# Module: claim

## Intent
One-time exchange of a user-copied setup token (base64 claim URL) for a long-lived Access
URL. The only stateful protocol step; everything else is stateless reads.

## Contract
- `claim(setupToken, {fetch?}) → Promise<string>` (the Access URL, trimmed).
- Offline validation **before any network call** (`InvalidTokenError`): not base64 text of
  an https URL; https required; **userinfo forbidden** (claim URLs carry none — passing
  creds to fetch would echo them via rejection causes).
- POST with **no custom headers** (must stay CORS-simple: preflight would 404 on claim).
- 403 **with the protocol's `text/plain` refusal** (or bodyless `Forbidden…`) → `ClaimError`.
  A 403 with any other body (Cloudflare edge/UA page) → `TransportError` — never a false
  compromise alarm.
- Off-origin response (redirect followed elsewhere) → `TransportError` (net.assertSameOrigin).
- Other statuses / malformed Access-URL bodies → `TransportError`.
- Rewrites `bridge.simplefin.org` → beta host up front (legacy host 302s drop the path).

## Dependencies
Depends on: [[modules/net]], [[modules/errors]] — protocol facts: [[maps/external]]

## Constraints
- Never logs the setup token or resulting Access URL; error causes must not echo creds.
- CF-edge 403 discrimination is heuristic (content-type + body prefix); Stage 3 integration
  re-verifies against the live edge.

## Implementation pointers
`src/claim.ts` (whole file).

## Known gaps
- Demo-token e2e lives in Stage 3 integration suite, not here.
