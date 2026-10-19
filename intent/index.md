# Intent Wiki — node-simplefin

Isomorphic TypeScript client for the [SimpleFIN](https://www.simplefin.org/protocol.html) protocol,
published as `node-simplefin` on npm.

Read this catalog first, then drill into the pages relevant to your task.

## Pages

| Page | Summary | Status |
|---|---|---|
| [architecture.md](architecture.md) | Package goals, layering, isomorphism strategy, stage plan | current |
| [testing.md](testing.md) | Hermetic unit tests, opt-in live integration, multi-runtime smoke | current |
| [maps/external.md](maps/external.md) | SimpleFIN protocol contract: endpoints, quirks, live-verified facts | current |
| [maps/internal.md](maps/internal.md) | Module layout and data flow inside this repo | in-progress |
| [features/simplefin-sdk.md](features/simplefin-sdk.md) | The SDK build itself: blueprint, contract, stage gates | in-progress |

## Rules

- Every behavior/structure change updates the touched pages in the same commit.
- `maps/external.md` is the single source of protocol facts; code claims must trace to a
  row there (with provenance).
- Module pages get added when their module lands; entry-point files carry
  `// intent: intent/modules/<name>.md` pointer comments.
- Log every operation by appending to [log.md](log.md).
