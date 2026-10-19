# AGENTS.md

## Intent wiki

This repo keeps an intent wiki in `intent/`. Before implementing any task:
read `intent/index.md`, then the relevant module/feature pages and `intent/maps/`.
After changing behavior: update the touched intent pages in the same change
(rules in `intent/index.md`). Pointer comments `// intent: intent/modules/<x>.md`
mark module entry points.

## Working rules

- The SimpleFIN protocol facts used by this SDK are recorded in `intent/maps/external.md`.
  Verify against it before coding against the API; do not re-derive from memory.
- Amounts and balances are decimal strings end to end. Never parse to float in the SDK.
- All HTTP behavior claims (status codes, headers, quirks) must be traceable to
  `intent/maps/external.md` entries with a provenance note.
- Unit tests must run hermetically (no network). Live-bridge tests are opt-in only.
- Micro-commits: one atomic task per commit, `type(scope): description` format.
