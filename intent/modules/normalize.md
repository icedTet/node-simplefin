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
v1-era code keeps working when v2 becomes default. Also the **trust boundary**: raw JSON
enters here and either becomes a typed model or a typed error.

## Contract
- `normalizeV1(input: unknown) → AccountSet`. A structural predicate validates accounts
  (id/name/currency/balance strings, optional transactions arrays of well-formed entries,
  string-array `errors`); anything else → `TransportError` — never a deep TypeError.
- Hyphenated wire keys → camelCase public fields; `errors` verbatim; missing
  `transactions` → `[]`; `pending !== true → false`.
- Connections deduped by (sfin-url, domain, name); synthesized `conn-N` ids are **per
  response, not stable across calls** (documented to consumers).
- `extra` objects pass through untouched.
- Amount/balance strings copied byte-for-byte — no numeric handling anywhere.

## Dependencies
Depends on: [[modules/types]] (shapes), [[modules/errors]] (boundary failures).
Depended on by: [[modules/client]]. Related: [[maps/external]] (v1/v2 field table)

## Constraints
- Stage 2 adds `normalizeV2` (conn_id, errlist→errors projection with naked-prefix
  fallback, holdings/passthrough capture) behind the same AccountSet type; the
  normalization invariant is a Gate-C target every stage.

## Implementation pointers
`src/normalize.ts` — `isWireAccountSetV1` predicate; `orgToConnection` holds the dedupe key.

## Constraints
- Strictness stance: `null` or wrong-typed optional fields **reject the whole payload**
  (TransportError) rather than normalize to undefined — no provenance shows bridges send
  nulls; if live v2-shaped data disagrees, revisit with a recorded fixture (Stage 3).

## Known gaps
- v2 passthrough capture (`holdings`, `payee`, `memo`, `mcc`, `x-api-message`): Stage 2.
- Defensive `errlist`-on-success projection: Stage 2 (wire default is v1; external.md).
