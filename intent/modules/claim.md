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
- Decodes base64 → URL; rejects non-decodable/non-https **before any network call**
  (`InvalidTokenError`).
- POST with **no custom headers** (must stay CORS-simple: preflight would 404 on claim).
- 403 → `ClaimError` (message instructs disable/regenerate; data may be compromised).
- Non-2xx other statuses, non-URL/https/creds-missing bodies → `TransportError`.
- Rewrites `bridge.simplefin.org` → beta host up front (legacy host 302s drop the path).

## Dependencies
Depends on: [[modules/net]], [[modules/errors]] — protocol facts: [[maps/external]]

## Constraints
- Never logs the setup token or resulting Access URL.
- Claim URL userinfo, if any, must not leak into thrown error messages.

## Implementation pointers
`src/claim.ts` (whole file).

## Known gaps
- Demo-token e2e lives in Stage 3 integration suite, not here.
