---
type: module
status: current
provenance: declared
updated: 2026-10-19
code: [src/sync.ts]
---

# Module: sync

## Intent
Turn the bridge's operational constraints (90-day cap, 5-day overlap, sequential ≤24/day
budget — external.md) into helpers so consumers don't hand-roll windowing and get it wrong.

## Contract
- `splitWindows(start, end, {maxSpanSeconds=90d, overlapSeconds=5d})` — chronological,
  gapless, ≤maxSpan+overlap wide; windows never extend past `start - overlap`; invalid
  geometry throws `RangeError` (local, never a wasted request).
- `collectAccounts(client, {startDate?, endDate?, …windows})` — sequential fetches
  (deliberately NOT parallel: one shared per-token budget), merged AccountSet:
  accounts by id (latest window's balance fields win), transactions by
  (account id, txn id) with later occurrence overwriting, errors/errlist/connections
  deduped by identity keys. End defaults to now; start defaults to epoch-0 semantics.
- Result carries no request-count telemetry; callers can count windows via splitWindows.

## Dependencies
Depends on: [[modules/client]] (type-only), [[modules/types]]. Related: [[maps/external]]

## Constraints
- Never parallelizes across windows.
- Dedupe key stability: transaction ids are unique per account (protocol), account ids
  per server; windowing merges rely on that — documented in external.md.

## Implementation pointers
`src/sync.ts`

## Known gaps
- Random-minute scheduling advice stays in README/docs (a process concern, not code).
