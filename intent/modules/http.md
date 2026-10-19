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
- 403 mapping: a body carrying an `errors` **array** or `errlist` **array** ⇒
  `AccessRevokedError` (key presence alone — e.g. `{"errlist":null}` — proves nothing);
  string bodies are JSON-probed so a mangled content-type can't downgrade a real refusal;
  anything else ⇒ `TransportError`.
- Error `url` property and messages are **origin+pathname** — query strings (which can
  carry account ids) never enter error fields (errors.md).
- Statuses 400/402/403/429/5xx ⇒ typed `HttpError` subclasses carrying `errors: string[]`
  (legacy strings + errlist msgs, deduped) and `errlist: ProtocolError[]` (via
  [[modules/wire]] helpers shared with the normalizers).

## Dependencies
Depends on: [[modules/net]], [[modules/errors]], [[modules/access-url]], [[modules/wire]].
Depended on by: [[modules/client]]. Related: [[maps/external]]

## Constraints
- Never sends userinfo in URLs; never trusts an off-origin response.
- Caller `headers` merge last (documented override capability).

## Implementation pointers
`src/http.ts` — `classifyStatus` is the taxonomy; `readProtocolBody` the detector.

## Known gaps
- None open (helpers lifted to [[modules/wire]]).
