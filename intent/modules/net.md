---
type: module
status: current
provenance: declared
updated: 2026-10-19
code: [src/net.ts]
---

# Module: net

## Intent
Shared isomorphic primitives: fetch resolution/injection, UTF-8 base64, legacy host rewrite.
Keeps the `node:`-free guarantee of src honest by owning the only global-touching code.

## Contract
- `FetchLike` — the injected seam used by every network caller (tests never monkey-patch).
- `rewriteLegacyHost(url)` — map known-redirecting hosts (external.md) before requests.
- `basicAuth(user, pass)` → `Basic <b64>`; `decodeBase64(text)` → UTF-8 string (throws on
  bad bytes — callers wrap).
- `resolveFetch(injected?)` — fallback to global `fetch` with a clear TypeError if absent.

## Dependencies
Depended on by: [[modules/http]], [[modules/claim]]. Related: [[maps/external]]

## Constraints
- Must stay dependency-free and Node-API-free (only standards globals: fetch/URL/TextEncoder/
  TextDecoder/atob/btoa).
- Host rewrite table is a **allow-list with explicit targets** — never a general resolver.

## Implementation pointers
`src/net.ts`

## Known gaps
- `LEGACY_HOST_REWRITES` will need review if the bridge finishes its cutover.
