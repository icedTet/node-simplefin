---
type: module
status: current
provenance: declared
updated: 2026-10-19
code: [src/sync.ts]
---

# Module: sync

## Intent
Turn the bridge's operational constraints (45-day recommended range, 90-day hard cap,
~5-day overlap, sequential ≤24/day budget — external.md) into helpers so consumers don't
hand-roll windowing and get it wrong (stage-3 round 1 caught the first version doing
exactly that at 95d).

## Contract
- `splitWindows(start, end, {maxSpanSeconds=45d, overlapSeconds=5d})` — chronological,
  gapless, **each window ≤ maxSpan** (start-anchored; step = maxSpan − overlap gives
  ~overlap-day overlap between consecutive windows); nothing is ever fetched before
  `start`; invalid geometry throws `RangeError` before any request. Default follows the
  server's 45-day *recommended* range (external.md), not the 90-day hard cap.
- `collectAccounts(client, {startDate, endDate?, …windows, maxRequests?})` —
  **startDate is required** (an unbounded default would silently spend ~231 windows of
  quota); endDate defaults to now. More windows than `maxRequests` (default 24 — the
  daily budget) throws `RangeError` before fetching. Sequential fetches (never parallel).
- Merge (identity keys per external.md): accounts by `id`, later fields win; transactions
  by (`account id`, `txn id`), later **value** wins, output **sorted by `posted` asc
  (ties: id)**; errlist keyed by (code,msg,connId,accountId); connections by stable id
  (v2 conn_id; v1 deterministic org-identity synthesis — normalize.md); errors deduped.
- Failure semantics: **all-or-nothing** — any window's error aborts the collect; quota
  spent on earlier windows is not recovered (no resume cursor yet, see gaps).
- Pending transactions that vanish between windows are **not tombstoned** (union merge);
  consumers wanting pending-truth should re-fetch a fresh short window.
- Result carries no request-count telemetry; count `splitWindows` output if needed.

## Dependencies
Depends on: [[modules/client]] (type-only), [[modules/types]] (type-only).
Related: [[maps/external]]

## Constraints
- Never parallelizes across windows (single per-token budget; abuse disables tokens).
- Window guards are pre-network by design: geometry/quota errors cost zero quota.

## Implementation pointers
`src/sync.ts`

## Known gaps
- Random-minute scheduling advice stays in README/docs (a process concern, not code).
- No resume cursor / partial-result channel on window failure; if real users need it,
  add an `onWindow` hook — not before.
