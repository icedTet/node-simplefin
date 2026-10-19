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
- `requestJson<T>(access, path, query, {fetch, headers?, signal?}) → Promise<T>` —
  transport-generic; **payload shape validation lives in the normalizer**, not here.
- Decision precedence: build URL (no userinfo) → Basic + Accept headers → fetch (default
  follow) → `assertSameOrigin` → read body (content-type guides json/text) → error-status
  classify (protocol-body aware) → require `application/json` on success.
- 403 mapping: JSON `errors`/`errlist` body ⇒ `AccessRevokedError`; string bodies are
  JSON-probed so a mangled content-type can't downgrade a real refusal; anything else ⇒
  `TransportError`.
- Error `url` property and messages are **origin+pathname** — query strings (which can
  carry account ids) never enter error fields (errors.md).
- Statuses 400/402/403/429/5xx ⇒ typed `HttpError` subclasses with `errors: string[]`
  extracted from both v1 (`errors`) and v2 (`errlist[].msg`) shapes.

## Dependencies
Depends on: [[modules/net]], [[modules/errors]], [[modules/access-url]]. Related: [[maps/external]]

## Constraints
- Never sends userinfo in URLs; never trusts an off-origin response.
- Caller `headers` merge last (documented override capability).

## Implementation pointers
`src/http.ts` — `classifyStatus` is the taxonomy; `readProtocolBody` the detector.

## Known gaps
- v2 `errlist` full structured codes (not just msg strings) surface in Stage 2 normalize.
