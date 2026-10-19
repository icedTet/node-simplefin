---
type: module
status: current
provenance: declared
updated: 2026-10-19
code: [src/access-url.ts]
---

# Module: access-url

## Intent
Turn the credential-bearing Access URL string into a structure where the secret is
addressable but never rides in request URLs (Node's fetch rejects userinfo; headers only).

## Contract
- `parseAccessUrl(value) → {root: URL (no creds, dir-normalized), username, password, href (redacted)}`.
- Rejects with `InvalidAccessUrlError` (a `SimplefinError` — same taxonomy as the rest of
  the SDK): non-absolute, non-https, missing username or password, invalid percent-escapes.
- Credentials are percent-decoded exactly once and go only into the Basic auth header.

## Dependencies
Depends on: [[modules/errors]]. Depended on by: [[modules/client]], [[modules/http]].
Related: [[modules/claim]]

## Constraints
- `href` and any toString must never contain the key.

## Implementation pointers
`src/access-url.ts`

## Known gaps
- No validation of token entropy (32+ char) — server-enforced property; documented only.
