---
type: module
status: current
provenance: declared
updated: 2026-10-19
code: [src/types.ts]
---

# Module: types

## Intent
The typed contract between wire and callers: wire shapes mirror the protocol JSON exactly
(hyphens included); public shapes are the normalized model from [[modules/normalize]].

## Contract
- Every monetary field is `string` in both worlds. No `number` amounts. Ever.
- Timestamps are unix seconds (`number`); `posted: 0` means pending (pair with
  `transactedAt`).
- `Transaction.amount` positive = deposit into the account.
- Wire types are input-only (we never send JSON bodies); public types are readonly.
- Optional public fields appear via conditional spread — distinguish "absent" from "empty".

## Dependencies
Depended on by: [[modules/normalize]], [[modules/client]], public exports in `src/index.ts`.
Source of truth for field semantics: [[maps/external]]

## Constraints
- Adding a public field means adding it to both wire + normalized + tests in one change.
- Unknown wire fields must not be silently dropped when they carry live-bridge meaning —
  Stage 2 passthrough decision lives in normalize.md.

## Implementation pointers
`src/types.ts`

## Known gaps
- Custom-currency URLs (`currency` = URL) have no typed accessor yet (Stage 4 docs or helper).
