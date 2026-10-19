---
type: map
status: current
provenance: declared
updated: 2026-10-19
code: [src/]
---

# Internal map

Data flow (Stage 1 as built):

```
caller ──setupToken──▶ claim.ts ──accessUrl──▶ access-url.ts (parse) ─▶ client.ts
                                   (root, user, pass)                    │
caller ──options──────▶ client.ts ──▶ http.ts ──▶ net.ts (fetch+auth+redirect)
                                          │
                        version 1 │ version 2 (wire param + normalizer dispatch)
                                          ▼
public AccountSet ◀── normalize.ts (V1 | V2 predicates, capture) ◀── wire.ts (helpers)
sync.ts composes quota-safe windows on top of client.getAccounts (sequential by design)
```

- `index.ts` re-exports the public surface only; it is the only file allowed to know
  all modules exist.
- `http.ts`/`claim.ts` are the sole `fetch` callers; both accept an injected `FetchLike`
  (net.ts) — tests never monkey-patch globals except one ambient-fallback check.
- Tests: one file per network-facing module (claim, access-url, http, client) plus a
  dedicated normalize.test.ts (v2 + symmetry + prefix) and toolchain/index-identity checks.
  Recorded bridge fixtures live in `test/fixtures/` (re-record via scripts/record-fixtures.mjs).

Module pages: claim, access-url, net, http, client, errors, types, normalize, wire, sync (see index).
Fixtures: test/fixtures/*.json with *.meta.json provenance (record via scripts/record-fixtures.mjs).
