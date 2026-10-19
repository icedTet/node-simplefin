---
type: module
status: current
provenance: declared
updated: 2026-10-19
code: [src/normalize.ts]
---

# Module: normalize

## Intent
One public model regardless of protocol version, so callers never branch on version and
v1-era code keeps working when v2 becomes default.

## Contract
- `normalizeV1(wire) → AccountSet`: hyphenated wire keys → camelCase public fields;
  `errors` pass through verbatim; missing `transactions` → empty array;
  `pending !== true → false`.
- Connections are deduped by (sfin-url, domain, name); ids are synthesized
  `conn-1…N` **per response, not stable across calls** (documented to consumers).
- `extra` objects pass through untouched (type `Record<string, unknown>`).
- Amount/balance strings are copied byte-for-byte — no numeric handling anywhere.

## Dependencies
Depended on by: [[modules/client]]. Related: [[maps/external]] (v1/v2 field table)

## Constraints
- Stage 2 adds `normalizeV2` (conn_id, errlist→errors projection, holdings/passthrough
  capture) behind the same AccountSet type. Both directions must stay symmetric; the
  normalization invariant is a Gate-C target every stage.

## Implementation pointers
`src/normalize.ts` — `orgToConnection` holds the dedupe key.

## Known gaps
- v2 passthrough capture (`holdings`, `payee`, `memo`, `mcc`, `x-api-message`): Stage 2.
