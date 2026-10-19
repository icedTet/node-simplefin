---
type: module
status: current
provenance: declared
updated: 2026-10-19
code: [src/net.ts]
---

# Module: net

## Intent
Shared isomorphic primitives where runtimes actually differ: fetch access, base64/UTF-8,
legacy host rewrite, origin assertion. Standards-wide globals (URL, TextEncoder) are used
directly where they live; this module owns the ones with runtime-divergent history.

## Contract
- `FetchLike` — the injected seam used by every network caller (tests never monkey-patch).
- `rewriteLegacyHost(url)` — Map-based explicit allowlist (external.md); unknown hosts pass
  through unchanged. Map (not object) so hostname lookups can't hit prototype members.
- `assertSameOrigin(response, requestUrl)` — refuse `response.url` from another
  scheme/host/port; verified portable across Node/Bun/Deno with default `follow`
  (manual/opaqueredirect is browser-divergent — not used).
- `basicAuth(user, pass)` → `Basic <b64>`; `decodeBase64(text)` → UTF-8 string (throws on
  bad bytes — callers wrap).
- `resolveFetch(injected?)` — injected or global `fetch`; clear TypeError if absent.

## Dependencies
Depends on: [[modules/errors]]. Depended on by: [[modules/http]], [[modules/claim]],
public `FetchLike` type via `src/index.ts`. Related: [[maps/external]]

## Constraints
- Node-API-free: standards globals only (fetch/URL/TextEncoder/TextDecoder/atob/btoa).
- Host rewrite table: explicit pairs only — never a general resolver.

## Implementation pointers
`src/net.ts`

## Known gaps
- `LEGACY_HOST_REWRITES` will need review if the bridge finishes its cutover.
