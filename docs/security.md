# Security and privacy

pi-zai is a Z.AI-only Pi extension. This page describes what data leaves your machine, what stays local, and how to control it.

## Summary

| Layer | Status | Where data goes |
|-------|--------|-----------------|
| **Z.AI API** | Always when you chat | Prompts, tool definitions, completions, and preserved reasoning through Pi's normal provider flow |
| **Local metrics** | On by default (`zai.metrics.mode: local`) | Privacy-reduced operational fields in SQLite on your machine |
| **Remote telemetry** | Opt-in, default off | Anonymous daily aggregates to Online Chef Groep when explicitly enabled |

Remote telemetry is off by default. Enable it only through settings plus `/zai-telemetry enable`. See [Architecture — remote telemetry](architecture.md#3-remote-telemetry-opt-in-v030).

Inspect your setup at any time:

```text
/zai-privacy preview
/zai-data status
/zai-telemetry status
```

## Credentials

- API keys resolve through Pi's `ModelRegistry`, `auth.json`, `models.json`, runtime `--api-key`, and environment variables such as `ZAI_API_KEY` and `ZAI_CODING_CN_API_KEY`.
- The extension never prints key values in commands, logs, or diagnostics.
- `/zai` and `/zai-doctor` show credential source names only, such as `ZAI_API_KEY` or `auth.json`.

### Resolution order (Pi native)

1. Runtime `--api-key`
2. `auth.json` for the active provider
3. Provider `apiKey` from `models.json`
4. Environment variable

pi-zai does not add separate credential precedence or shell helpers.

### Local credential files

When storing keys outside Pi:

```bash
chmod 700 ~/.config/zai
chmod 600 ~/.config/zai/credentials.env
```

Never commit credential files. Rotate keys exposed in chat, logs, screenshots, or shell history.

### Secret scanning

GitHub secret scanning flags OAuth client IDs and secrets even when they originate from upstream tools (for example pi-mono Gemini CLI / Antigravity embedded credentials). pi-zai **must not** copy those into docs or source.

Before pushing:

```bash
bash scripts/check-secrets.sh
```

CI runs Gitleaks on the working tree plus the same pattern guard. Historical alerts on orphaned commits can be resolved as false positives once `main` is clean — they are not org-owned secrets.

## Local metrics storage

Default: `zai.metrics.mode: "local"`. Z.AI attempts can be recorded locally as privacy-reduced rows.

### Files

```text
~/.pi/agent/state/pi-zai/metrics.sqlite3
~/.pi/agent/state/pi-zai/local.secret
```

- `local.secret` — random 256-bit key for HMAC project identifiers. Never sent remotely.
- `projectId` — `HMAC(localSecret, canonicalCwd)`. It is not a reversible path hash.
- `sessionHash` — hash of the Pi session id. Local only.

### Stored per attempt (allowlist)

| Field | Purpose |
|-------|---------|
| `occurredAt` | Timestamp |
| `projectId`, `sessionHash` | Local pseudonymous correlation |
| `queryId`, `requestId`, `attempt` | Retry and request correlation without prompt content |
| `provider`, `model`, `endpointKind` | Z.AI routing context |
| `thinkingLevel`, `extensionVersion` | Configuration context |
| `systemFingerprint`, `toolsetFingerprint`, `payloadFingerprint` | Short hashes, local SQLite only |
| Token counters | `input`, `cacheRead`, `cacheWrite`, `output` |
| Latency | `requestToHeadersMs`, `requestToFirstDeltaMs`, `requestToFirstToolDeltaMs`, `totalMs` |
| Tool aggregates | Counts, error counts, and total duration only; never arguments or results |
| `httpStatus`, `errorCategory` | Controlled category labels, never raw provider error bodies |
| `estimatedApiCostMicrousd` | Derived from usage metadata when pricing is known |

### Never stored in local metrics or remote telemetry

- Prompt, source-code, or reasoning text
- Tool arguments or tool-result text
- API keys
- Filesystem paths, hostnames, or repository names
- Raw provider error response bodies
- Install identifiers or reversible project paths

Normal inference data still goes to Z.AI through Pi. “Never stored” describes pi-zai's metrics systems, not the provider request required to run the model.

### Modes

| `zai.metrics.mode` | Behavior |
|--------------------|----------|
| `off` | No attempt records |
| `memory` | In-process only; lost on shutdown |
| `local` | SQLite with memory fail-open if the database cannot open |

Retention is controlled by `retentionDays`, `rollupRetentionDays`, and `maxDatabaseBytes`. Old detail rows roll up to daily summaries before deletion.

### Operator commands

| Command | Action |
|---------|--------|
| `/zai-data status` | Storage kind, row counts, project hash |
| `/zai-data export-json <path>` | Export attempts for the current project |
| `/zai-data export-csv <path>` | CSV export |
| `/zai-data clear-project` | Delete metrics for the current project hash |
| `/zai-data clear-details` | Delete detail rows while retaining daily rollups |
| `/zai-data clear-benchmarks` | Delete benchmark run rows |
| `/zai-data clear-all` | Wipe all local pi-zai metrics and rotate `local.secret` |
| `/zai-data vacuum` | SQLite maintenance |
| `/zai-transport` | Local latency and controlled error-category summary |
| `/zai-privacy preview` | Allowlists, never-remote fields, and aggregate preview |
| `/zai-telemetry status` | Mode, consent, endpoint, and pending UTC days |
| `/zai-telemetry enable` | Write explicit consent after aggregate mode is configured |
| `/zai-telemetry disable` | Remove consent and stop uploads |
| `/zai-telemetry preview [day]` | Render a local aggregate without sending it |
| `/zai-telemetry upload [day]` | Upload one completed UTC day |
| `/zai-telemetry sync` | Upload pending completed days |

## Prompt fingerprinting

- System prompts are canonicalized before hashing.
- Raw prompt text is never written to SQLite, exports, telemetry, or command output.
- `/zai` and `/zai-cache` show short fingerprints only.
- `promptStability.mode: observe` measures structure without changing the request.
- `promptStability.mode: safe` can move recognized volatile lines below an existing `--- dynamic context ---` marker.

See [Cache optimization](cache-optimization.md).

## Preserved thinking

Preserved reasoning is part of the normal Z.AI inference request, not pi-zai telemetry. Current Pi releases send `clear_thinking=false` when Z.AI thinking is enabled and replay compatible historical reasoning through Pi's provider implementation.

The `zai.preserveThinking` setting is an optional explicit override:

| Value | Effect |
|-------|--------|
| omitted | Leave Pi's native payload unchanged |
| `true` | Force `clear_thinking=false` while thinking is enabled |
| `false` | Force `clear_thinking=true` while thinking is enabled |

Preserved reasoning can contain sensitive intermediate analysis and therefore leaves your machine as part of normal Z.AI chat traffic. Forcing it off reduces that replay, but can also reduce reasoning continuity and cache reuse in coding/tool workflows. `/zai` shows the effective policy.

Compaction is a separate boundary: pi-zai asks Pi's compaction process to preserve visible decisions and tool outcomes without replaying hidden reasoning in the compacted summary.

## Network probes

`/zai-doctor` can make explicit diagnostic requests:

- `GET ${baseUrl}/models` for reachability
- three short chat completions for connection-stability probing

The probes use configured authentication. Response status and controlled summaries are shown; secrets and response bodies are not logged.

`/zai-usage` calls Z.AI monitor APIs for Coding Plan quota when credentials exist.

## Remote telemetry (opt-in)

Default: `zai.telemetry.mode: "off"`. Uploads require both:

1. set `"telemetry": { "mode": "aggregate" }` and reload;
2. run `/zai-telemetry enable` and confirm consent.

Completed UTC days can upload on session start or `/zai-telemetry sync`.

Consent file:

```text
~/.pi/agent/state/pi-zai/telemetry.consent.json
```

Disable with `/zai-telemetry disable`; the configured mode remains unchanged.

### Uploaded fields (allowlist)

| Field | Purpose |
|-------|---------|
| `day` | UTC date |
| `extensionVersion`, `promptMode` | Build and prompt-stability mode |
| `attempts`, `errors` | Daily counts |
| Token counters | `input`, `cacheRead`, `cacheWrite`, `output` |
| `turnBucket`, `cacheRatioBucket`, `retryRateBucket` | Bucketed bands only |
| `byProviderModel[]` | Provider/model/endpoint counts |
| `errorCategories{}` | Controlled category labels |

### Never uploaded

- Prompts, source code, reasoning, tool arguments, or tool results
- Paths, install identifiers, or API keys
- Project/session/query identifiers or fingerprints
- Raw provider error bodies
- IP address as an application payload field

`/zai-privacy preview` renders the local aggregate shape. Its status remains `preview-only-not-sent` until both mode and consent are active, then becomes `aggregate-ready`.

Ingest endpoint: `POST https://api.chefgroep.online/pi-zai/telemetry/v1/aggregate`. Override `zai.telemetry.ingestUrl` for staging or self-hosting.

## Benchmark data

`/zai-benchmark` stores run manifests and completed reports in the same local SQLite database. Reports contain aggregated usage, transport, and cache statistics for the benchmark window—not prompt or reasoning content.

## Boundary tests

The package includes tests asserting that:

- remote telemetry `fetch` is isolated to `telemetry/uploader.ts`;
- privacy preview does not call the network;
- telemetry requires aggregate mode plus explicit consent;
- payload normalization performs no thinking mutation when no override is configured.
