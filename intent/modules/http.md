---
type: module
status: current
provenance: declared
updated: 2026-10-19
code: [src/http.ts]
---

# Module: http

## Intent
Sole gateway to the data API. Encodes every verified protocol quirk (auth split, redirect
trap, status taxonomy) in one reviewable place so no other module touches `fetch` for GETs.

## Contract
- `requestJson<T>(access, path, query, {fetch, headers?, signal?}) → Promise<T>`.
- Order of operations: build URL (no userinfo) → Basic auth + Accept headers → fetch
  (follow, default) → **host check on final URL** → content-type gate → status classify →
  JSON parse.
- 403 mapping: protocol error body (`errors`/`errlist` JSON) ⇒ `AccessRevokedError`;
  anything else (HTML edge block) ⇒ `TransportError`. See external.md Cloudflare row.
- Statuses 400/402/403/429/5xx ⇒ typed `HttpError` subclasses carrying `status`, `url`,
  `errors[]` (strings extracted from both v1 and v2 body shapes).

## Dependencies
Depends on: [[modules/net]], [[modules/errors]], [[modules/access-url]]. Related: [[maps/external]]

## Constraints
- Never sends userinfo in URLs; never follows off-host responses silently.
- `headers` option must not let callers override `Authorization` silently — merged after
  (last-wins is acceptable for advanced use; documented behavior).

## Implementation pointers
`src/http.ts` — `classifyStatus` is the taxonomy; `readProtocolBody` the detection.

## Known gaps
- opaqueredirect (manual mode) not used because fetch spec hides Location in that mode;
  final-URL inspection is the portable equivalent.
