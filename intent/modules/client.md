---
type: module
status: current
provenance: declared
updated: 2026-10-19
code: [src/client.ts]
---

# Module: client

## Intent
The object callers hold: Access URL in, normalized `AccountSet` out. Thin on purpose —
orchestration only, all mechanics live in [[modules/http]]/[[modules/normalize]].

## Contract
- `new SimplefinClient(accessUrl: string | AccessUrl, {fetch?, headers?, signal?})`.
- `getAccounts({startDate?, endDate?, pending?, account?, balancesOnly?, version?}) → Promise<AccountSet>`.
  `version` selects the wire shape requested (default **1**, sent explicitly); output is
  normalized either way. `balancesOnly: true → balances-only=1`, presence semantics.
  Unknown conn_id refs on v2 leave `connectionId` unset (normalize.md).
- `Date | number` (unix seconds) accepted; converted with floor.
- `pending: true → pending=1`; **false/undefined omit the param** (presence semantics,
  external.md) — callers cannot express `pending=0`, by design.
- `account: string | string[]` → repeated params.


## Dependencies
Depends on: [[modules/http]], [[modules/normalize]], [[modules/access-url]], [[modules/types]].
Depended on by: [[modules/sync]] (composition, type-only import).

## Constraints
- No retry logic here (quota discipline is a consumer/Stage-3 concern; silent retries would
  blow the 24/day budget).
- Stateless per call; safe to share one client across accounts.

## Implementation pointers
`src/client.ts`

## Known gaps
- None open; windowing/budget composition lives in [[modules/sync]].
- Explicit `version=1` pinning is an SDK hedge against the documented default flip (v1
  sunset ≥1y after 2026-03-19, GH discussion #33), with server tolerance recorded in
  external.md (live probes: `1`/unknown values → v1 byte-identical to omitted). Revisit
  if any institution server disagrees (Stage 3 live runs).
