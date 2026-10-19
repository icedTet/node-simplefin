---
type: map
status: current
provenance: mixed
updated: 2026-10-19
code: [src/]
---

# External map: SimpleFIN protocol contract

Verified 2026-10-19 against docs (`https://www.simplefin.org/protocol.html` v2.0.0-draft,
`protocol-v1.html` v1.0.7) and live probes of `https://beta-bridge.simplefin.org/simplefin/*`.
**Trust this page over memory.** Each row has provenance.

## Endpoints (root = e.g. `https://beta-bridge.simplefin.org/simplefin`)

| Call | Auth | Response | Provenance |
|---|---|---|---|
| `GET {root}/info` | none | `{"versions":["1.0"]}` — **do not trust for v2 detection**; reports 1.0 while serving v2 via param | live probe; bridge-issues#26 |
| `GET {root}/create` | user session | HTML page; live = 303 → bridge homepage login | live probe |
| `POST {root}/claim/:token` | none; `Content-Length: 0` | 200 `text/plain` Access URL (no trailing newline; trim anyway); 403 `text/plain` "was it already claimed?" = used/missing/possibly compromised | docs + live demo e2e; 403 body re-probed 2026-10-19 |
| `GET {access}/accounts` | Basic (from access URL userinfo) | 200 JSON `AccountSet`; see quirks | docs + live |

`GET` on the claim URL = 404 on the beta root (POST only); via the legacy bridge host you
first get the path-dropping 302 below. `/access`, `/latest`, `/updates`, `cursor`,
`window`, `X-Status`, `X-Next-Cursor` **do not exist** — live-probed 2026-10-19: all
return 404 with no cursor/status headers (don't implement them).

## Access URL & auth

- Form: `https://id:key@host/simplefin` with 32+ char random id/key. Node's `fetch` **rejects
  URLs containing userinfo** — split credentials out and send `Authorization: Basic` manually.
  Provenance: Node 18+ behavior, live.
- Auth failures return **403, never 401** (no `WWW-Authenticate`). Body JSON
  `{"errors":["Forbidden"]}` (v1) / `{"errlist":[{"code":"gen.auth",...}],...}` (v2). Live.

## Query params on /accounts

| Param | Semantics | Provenance |
|---|---|---|
| `start-date` | unix secs, inclusive (≥) | spec v1/v2 |
| `end-date` | unix secs, exclusive (<) | spec v1/v2 |
| `pending` | spec: include pending iff `pending=1` provided, default excluded; live bridge checks **presence** (`pending=0` behaves like 1 — omit to exclude) | spec v1/v2 + live (bridge impl) |
| `account` | filter by id; repeatable; unknown id → 200 empty | spec v2 + live |
| `balances-only` | `1` = no transaction data per spec; live keeps `transactions` key present but empty | spec v2; empty-key detail live-only |
| `version` | `2` selects v2 schema; default serves v1. Explicit `1` (and unknown values like `3`) serve v1 byte-identical to omitted — no server allergy observed | spec + live probes 2026-10-19 |

## Response model differences (v1 → v2)

| v1 (default) | v2 (`version=2`) | Provenance |
|---|---|---|
| `errors: string[]` (display strings — sanitize) | `errlist: {code,msg,conn_id?,account_id?}[]`, code grammar `prefix.[subcode]`, prefixes `gen`/`con`/`act`, fall back to naked prefix on unknown subcode | spec v2.0.0 |
| per-account `org {domain,name,sfin-url,...}` | top-level `connections[] {conn_id,name,org_id,org_url?,sfin_url}`; account gains required `conn_id` | spec v2.0.0 |
| `amount` numeric **string**, positive = deposit; `posted` unix int, **0 when pending**; `available-balance` optional; custom currency = `currency` is a URL → GET `{name,abbr}` | same fields | spec v1/v2 |

Undocumented-but-live fields (capture as optional passthrough on BOTH versions, don't
depend): `holdings[]` (present on live v1 too; bridge-issues #43: "don't depend on its
schema"), transaction `payee`, `memo`, `mcc`, `transacted_at`, `extra`, top-level
`x-api-message: string[]` (present without `start-date`), connection `org_name`.
**Live census (v1 and v2, demo, re-measured 2026-10-19): `mcc` is the only key ever
observed `null`** — 6 of 162 transaction objects (3 unique ids appearing in two mirrored
demo accounts)
— the SDK treats null as absent for payee/memo/mcc, everything else stays strict-typed.
Live probes 2026-10-19.

## Status codes

200 ok; 400 bad request; 402 payment required (unpaid subscription); 403 auth failed /
claim already used / **token revoked** — note the Cloudflare edge also emits bare 403s for
generic library UAs (see Operational constraints; not a protocol response); 429 rate
limited; 5xx server. Live + dev guide + sure client.

## Operational constraints

- **≤24 requests/day/access token** expected; over-quota → warnings in `errors`/`errlist`;
  abuse → **token disabled server-side**. Quotas replenish through the day; per-account
  requests have their own quota. Provenance: `/info/developers`.
- **90-day max date window**; exceeding is capped server-side with a `gen.api` errlist
  entry. Live probe.
- Polling model: daily GET with ~**5-day overlapping windows**, diff by txn `id`;
  schedule at a **random minute** (traffic spikes on the hour). Dev guide.
- `bridge.simplefin.org` currently **302-redirects everything** (incl. pathed API POSTs) to
  `Location: https://beta-bridge.simplefin.org/` — bare root, path dropped (re-probed
  2026-10-19). Treat with `redirect: 'manual'`, rewrite host for the API root, or fail
  explicitly.
- Cloudflare edge **403s requests with generic library UAs** (`Python-urllib/...`). The
  runtime-native UAs that matter here were live-verified as passing: Node/undici, Bun, Deno,
  browsers, and even an empty UA all get 200; only some library signatures are blocked.
  The SDK therefore sends **no custom UA header** — a custom header on the claim POST would
  break its CORS-simple status anyway (bridge-issues#27 + live).
- Browser CORS: `/accounts` echoes `access-control-allow-origin` + credentials; its
  preflight allows the `authorization` header (`OPTIONS /accounts` →
  `access-control-allow-headers: authorization`). Claim POST is a CORS-simple request —
  never add custom headers to it (would trigger preflight; OPTIONS on claim 404s).
  Live (research probes 2026-10-19) + dev guide.
- v2 is opt-in (`version=2`); v1 supported ≥1 year after 2026-03-19. GH discussion #33.

## Security invariants (spec checklist)

HTTPS-only (reject http: URLs); never follow insecure redirects; store access URLs as
securely as financial data; display `errors`/`errlist`/`msg` strings only sanitized; on
claim 403 **with the protocol's `text/plain` refusal body** (not an edge/UA 403), tell the
user the token may be compromised and to disable/recreate it.
