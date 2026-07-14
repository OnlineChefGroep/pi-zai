# Architecture

How pi-zai fits into Pi, what it measures locally, and optional remote aggregate telemetry.

## Role in the stack

pi-zai is a **Pi extension** for Z.AI only. It does not replace Pi's agent runtime, streaming, tool loop, provider transport, or thinking UI.

```text
You  →  Pi (agent, tools, sessions)
         ↓
       Pi native Z.AI providers (zai, zai-coding-cn, optional zai-platform)
         ↓
       Z.AI API
         ↑
       pi-zai hooks (cache metrics, request inspection, headers, local SQLite)
```

| Layer | Owner | pi-zai role |
|-------|--------|-------------|
| Chat & tools | Pi | None — uses Pi as-is |
| Thinking level and Z.AI payload | Pi provider | Observe the mapped payload; apply `clear_thinking` only when the user explicitly configures an override |
| Cache visibility | pi-zai | Z.AI-scoped session totals, current-segment fingerprints, `/zai-cache` |
| Operator UX | pi-zai | `/zai`, `/zai-doctor`, `/zai-usage`, metrics commands |
| Local history | pi-zai | Privacy-reduced attempt rows in SQLite |

**Breaking change in 0.2.0:** pi-zai no longer registers or overrides Pi's built-in `zai` / `zai-coding-cn` providers. Add `zai-platform` yourself in `models.json` if you need metered Platform billing.

## Request lifecycle (one Z.AI turn)

1. **`before_agent_start`** — Start attempt timing; fingerprint the stable system-prompt prefix and active tools; optionally normalize an explicitly marked dynamic suffix in `safe` mode.
2. **Pi provider request builder** — Pi maps its selected thinking level to Z.AI `thinking` and `reasoning_effort`. Current Pi releases use `clear_thinking=false` while thinking is enabled.
3. **`before_provider_request`** — Recapture the active toolset, classify transitions, and rotate the cache segment when tools changed. Leave the payload unchanged by default; only override `clear_thinking` when `zai.preserveThinking` is explicitly `true` or `false`.
4. **`before_provider_headers`** — Set `User-Agent: pi-zai/<version>`; optionally add `X-Session-Id` when `sessionAffinity: experimental` and no upstream affinity header exists.
5. **Pi provider stream** — Normal Z.AI traffic. Prompts, reasoning history, tool definitions, and completions travel through Pi's provider directly to Z.AI.
6. **`after_provider_response`** — Record HTTP status and response-header timing for transport metrics.
7. **`message_update` / `message_end`** — Track first-token timing, output throughput, and streamed usage.
8. **`turn_end`** — Update cache metrics from non-empty provider usage and write a privacy-reduced attempt row to local storage.

Compaction and branch-summary hooks inject Z.AI-focused instructions without replacing Pi's compaction engine.

## Cache scopes

pi-zai exposes two deliberately different scopes:

| Surface | Scope |
|---------|-------|
| `/zai` and `/zai-usage` | All Z.AI-provider messages found in the Pi session |
| `/zai-cache` | Current provider/model/system-prompt/toolset segment only |

The segment resets when its provider, endpoint, model, stable system-prompt fingerprint, or active toolset fingerprint changes. Therefore its token count can be lower than Pi's complete Session Info. All-zero usage objects from connection failures are not treated as cache samples.

## Three data paths

### 1. Z.AI API (always when you chat)

Everything required for inference goes to Z.AI through Pi's providers: messages, tools, thinking configuration, and preserved reasoning when present. This is standard Pi behavior; pi-zai does not add a second API client or proxy for chat.

Other Z.AI HTTP calls from pi-zai, separate from normal chat traffic:

| Call | Command | Purpose |
|------|---------|---------|
| `GET /models` | `/zai-doctor` | Optional connectivity probe |
| Monitor API | `/zai-usage` | Coding Plan quota windows |
| `POST /chat/completions` | `/zai-doctor` | Optional stability probe using three short requests |

Secrets and response bodies are not printed.

### 2. Local metrics (on by default)

**Setting:** `zai.metrics.mode` — default `local`.

**Storage:**

```text
~/.pi/agent/state/pi-zai/metrics.sqlite3
~/.pi/agent/state/pi-zai/local.secret
```

A completed Z.AI attempt can produce one row containing token counts, latency, HTTP status, controlled error category, local HMAC project/session hashes, tool aggregates, and short fingerprints. **No prompt, source-code, reasoning, tool-argument, or tool-result text is stored.**

Retention is bounded (`retentionDays`, `maxDatabaseBytes`). Detail rows roll up to daily summaries before deletion.

**Operator surface:** `/zai-data`, `/zai-transport`, `/zai-benchmark`.

Full allowlist: [Security](security.md).

### 3. Remote telemetry (opt-in, v0.3.0+)

**Setting:** `zai.telemetry.mode` — default `off`. Set it to `aggregate` to permit uploads after explicit consent.

| Piece | v0.3.0 status |
|-------|----------------|
| Client daily uploader | **Built** — `src/telemetry/uploader.ts` |
| `telemetry.mode: aggregate` | **Available** through settings |
| `/zai-telemetry` commands | **Built** — status, preview, enable, disable, upload, sync |
| Opt-in flow | **Built** — settings mode plus `/zai-telemetry enable` |
| Cloudflare Worker ingest | **Scaffold** — `worker/telemetry/` requires deployment and route binding |
| Analytics Engine backend | **Scaffold** — dataset `pi_zai_telemetry` |
| Privacy preview JSON | **Built** — `preview-only-not-sent` or `aggregate-ready` |
| Boundary tests | **Built** — network upload isolated to uploader; privacy preview never calls the network |

Uploads run only when both conditions are true:

1. `zai.telemetry.mode: "aggregate"` in settings
2. consent file written by `/zai-telemetry enable`

Completed UTC days upload on session start or `/zai-telemetry sync`. Payloads contain anonymous daily aggregates only: turn buckets, cache-ratio bands, controlled error-category counts, and token totals. They never contain prompts, code, reasoning, fingerprints, install IDs, paths, or raw errors.

**Ingest URL:** `https://api.chefgroep.online/pi-zai/telemetry/v1/aggregate` (override with `zai.telemetry.ingestUrl`).

#### Aggregate payload (schema 1)

- `day`, `extensionVersion`, `promptMode`
- `attempts`, `errors`, token counters
- `turnBucket`, `cacheRatioBucket`, `retryRateBucket`
- `byProviderModel[]`, `errorCategories{}`
- no project/session/query IDs or fingerprints

Encrypted diagnostic bundles are a separate potential later phase.

## Configuration surfaces

| Surface | Scope |
|---------|-------|
| `.pi/settings.json` | Project overrides for `zai.*` |
| `~/.pi/agent/settings.json` | Global defaults |
| Environment variables | Pi credential resolution only — no `PI_ZAI_*` overrides |

See [Configuration](configuration.md).

## Benchmark variants (A0–A3)

Used to compare cache strategies before changing defaults:

| Variant | pi-zai loaded | Distinction |
|---------|---------------|-------------|
| A0 | No | Native Pi control |
| A1 | Yes | Observe prompt stability |
| A2 | Yes | Add safe prompt normalization |
| A3 | Yes | Add experimental `X-Session-Id` |

Track runs with `/zai-benchmark start` … `complete`. Live script: `npm run benchmark:cache-affinity` (see [Development](development.md)).

## Related docs

- [Security](security.md) — allowlists, wipe commands, credential rules
- [Cache optimization](cache-optimization.md) — scopes, ratios, and fingerprints
- [Thinking](thinking.md) — Pi-native mapping and explicit override behavior
- [Commands](commands.md) — slash-command reference
- [Development](development.md) — build, test, release
