---
type: module
status: current
provenance: declared
updated: 2026-10-19
code: [src/wire.ts]
---

# Module: wire

## Intent
Error-body and passthrough helpers shared by the transport gateway and the normalizers,
so "display extraction" (lenient) and "structured projection" (strict-where-spec'd) can
never diverge between the two consumers (a stage-2 gate found exactly that drift).

## Contract
- `collectErrorMessages(record)`: every string in `errors` + every projected errlist msg,
  order-preserved, deduplicated. Never drops a message for a malformed *optional* field.
- `projectErrlist(list)`: entries kept iff `code`+`msg` are strings; malformed optional
  link fields (`conn_id`/`account_id`) sanitize to absent rather than dropping the entry.
- `projectXApiMessage(value)`: string entries of the undocumented array kept; mixed junk
  filtered, not total-dropped; all-invalid → undefined.

## Dependencies
Depended on by: [[modules/http]], [[modules/normalize]]. Related: [[maps/external]]

## Constraints
- No payload-shape validation here (that is the normalizer's trust boundary); these
  helpers handle ERROR metadata and passthroughs, where leniency is the documented policy.

## Implementation pointers
`src/wire.ts`

## Known gaps
- None open.
