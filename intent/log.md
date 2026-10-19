# Intent Log

Append-only. Format: `## [YYYY-MM-DD] <op> | <subject> | touched: <pages>`

## [2026-10-19] bootstrap | node-simplefin | touched: index.md, architecture.md, testing.md, maps/internal.md, maps/external.md, features/simplefin-sdk.md
## [2026-10-19] implement | stage-0 toolchain + CI scaffold (commits 22ba0bb, 0607cf5) | touched: architecture.md, testing.md
## [2026-10-19] declare | feature simplefin-sdk: staged plan + contract scenarios | touched: features/simplefin-sdk.md
## [2026-10-19] implement | stage-0 gates A/B/C run; validated fixes: real isomorphism enforcement (tsconfig.src.json + lint), CI matrix 22/24 + coverage job, vitest env-gated integration, smoke Windows fix, exports default, engines >=22 | touched: architecture.md, testing.md, maps/external.md, index.md, features/simplefin-sdk.md
## [2026-10-19] query | live re-probes confirmed: bridge 302 drops path (Location=bare root), /access|/latest|/updates 404 no X-headers, claim 403 text body — Gate C F3 adjudicated false-positive | touched: maps/external.md
## [2026-10-19] implement | stage-0 gate round 2: nested exports types per condition (TS1471 fixed, d.cts reachable), full builtinModules + globals isomorphism guard, 403 taxonomy conditioned on protocol bodies, code: pointer completion, dev-floor note, index/log bookkeeping exemption | touched: architecture.md, testing.md, maps/external.md, features/simplefin-sdk.md, index.md
## [2026-10-19] ship | stage-0 gates A APPROVE + C PASS (round 3); final polish: last unconditional 403 mention qualified, backstop wording completed, stage-0 tag moved to green HEAD | touched: maps/external.md, architecture.md, features/simplefin-sdk.md
## [2026-10-19] implement | stage-1 core v1 client: 8 modules + 39 unit tests + module pages; UA policy corrected to runtime-native (external.md operational row rewritten with live evidence); architecture module table updated | touched: modules/claim.md, modules/access-url.md, modules/net.md, modules/http.md, modules/client.md, modules/normalize.md, modules/types.md, modules/errors.md, maps/internal.md, maps/external.md, architecture.md, testing.md, features/simplefin-sdk.md, index.md
