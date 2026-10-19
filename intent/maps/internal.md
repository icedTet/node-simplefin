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
                                          ▼
public AccountSet ◀── normalize.ts ◀── v1 wire JSON (types.ts)
sync.ts (Stage 3) composes date windows on top of client.getAccounts
```

- `index.ts` re-exports the public surface only; it is the only file allowed to know
  all modules exist.
- `http.ts`/`claim.ts` are the sole `fetch` callers; both accept an injected `FetchLike`
  (net.ts) — tests never monkey-patch globals except one ambient-fallback check.
- Tests: `test/unit/<module>.test.ts` mirror the modules; recorded bridge fixtures land in
  `test/fixtures/` with Stage 3 (hermetic unit tests reuse them).

Module pages: claim, access-url, net, http, client, errors, types, normalize (see index).
