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
- `normalizeV1` / `normalizeV2` (dispatch: `version` in client.getAccounts) both return
  the same AccountSet shape.
- `errorPrefix(code)` — public helper collapsing `prefix.[subcode]` to `prefix.`;
  unknown subcodes behave like the naked prefix (v2 protocol guidance).
- Both versions: server/synthesized connection ids link via `connectionId` (dangling v2
  conn_id refs link nothing); `errlist` — presence-level gate only, entries filtered
  leniently by [[modules/wire]]; msgs surfaced (deduped) in `errors`; `x-api-message` captured leniently; `holdings[]` captured
  defensively — **never gates the payload** (schema not guaranteed; non-objects drop).
- v2 connection unknown keys pass through raw (`org_name` survives); typed fields consume
  the wire key (no duplication).
- v1↔v2 shared capture: one `normalizeAccountCore` mapper; predicates are type guards.
- Structural predicates validate accounts
  (id/name/currency/balance strings, optional transactions arrays of well-formed entries,
  string-array `errors`); anything else → `TransportError` — never a deep TypeError.
- Hyphenated wire keys → camelCase public fields; `errors` verbatim; missing
  `transactions` → `[]`; `pending !== true → false`.
- Connections deduped by (sfin-url, domain, name); synthesized `conn-N` ids are **per
  response, not stable across calls** (documented to consumers).
- `extra` objects pass through untouched.
- Amount/balance strings copied byte-for-byte — no numeric handling anywhere.
- v1↔v2 symmetry is a tested invariant (`test/unit/normalize.test.ts`): the same
  underlying data must normalize to equal models apart from connection identity source.

## Dependencies
Depends on: [[modules/types]] (shapes), [[modules/errors]] (boundary failures),
[[modules/wire]] (error/passthrough helpers). Depended on by: [[modules/client]].
Related: [[maps/external]] (v1/v2 field table)

## Constraints
- The normalization invariant is a Gate-C target every stage.
- Strictness stance (payload data; error metadata is wire.md's domain): wrong-typed
  optional fields **reject the whole payload** (TransportError) rather than normalize to
  undefined — no provenance shows bridges send nulls outside the observed one exception
  below.
- Null-as-absent carve-out, evidence-scoped: `payee`/`memo`/`mcc` only. Live census
  (external.md, 2026-10-19): `mcc: null` in v1 AND v2 demo bodies; if other fields ever
  arrive null in the wild, extend deliberately with a recorded fixture, not silently.

## Implementation pointers
`src/normalize.ts` — `isWireAccountSetV1` predicate; `orgToConnection` holds the dedupe key.

## Known gaps
- v2-only extras observed live but unmodeled (connection `org_name`): preserved via
  passthrough index signatures, not surfaced as typed fields. Revisit with recorded
  fixtures (Stage 3).
