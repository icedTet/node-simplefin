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
addressable but never rides in request URLs (Node fetch rejects userinfo; headers only).

## Contract
- `parseAccessUrl(value) → {root: URL (no creds, dir-normalized), username, password, href (redacted)}`.
- Rejects (TypeError) non-absolute, non-https, or missing username/password.
- Percent-encoding is decoded exactly once (fetch re-encodes headers? no: creds go into the
  Basic header raw — wire-identical to curl -u).

## Dependencies
Depended on by: [[modules/client]], [[modules/http]]. Related: [[modules/claim]]

## Constraints
- `href` and any toString must never contain the key.
- Credentials are treated as opaque ASCII in practice but stored decoded (TextEncoder in
  net.basicAuth handles UTF-8).

## Implementation pointers
`src/access-url.ts`

## Known gaps
- No validation of token entropy (32+ char) — server-enforced property; documented only.
