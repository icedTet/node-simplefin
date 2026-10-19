---
type: map
status: in-progress
provenance: derived
updated: 2026-10-19
code: [src/]
---

# Internal map

Data flow (target state, lands across stages):

```
caller ──setupToken──▶ claim.ts ──accessUrl──▶ access-url.ts (parse) ─▶ SimplefinClient
                                                                        │
caller ──options──────▶ client.ts ──▶ http.ts (fetch+auth+errors) ───────┤
                                                                        ▼
                                                     normalize.ts ◀── wire types (types.ts)
                                                                        │
caller ◀── AccountSet (normalized, string amounts) ◀────────────────────┘
sync.ts helpers (windows/overlap) compose on top of client.getAccounts
```

- `index.ts` re-exports the public surface only.
- `http.ts` is the sole place `fetch` is called; everything else receives an injected
  fetch (testability) via client/claim options.
- Tests mirror this: `test/unit/<module>.test.ts`; fixtures in `test/fixtures/`.

Module pages: to be added as modules land (Stage 1: claim, access-url, http, client,
errors, types; Stage 2: normalize; Stage 3: sync).
