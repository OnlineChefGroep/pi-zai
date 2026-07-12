# Cursor implementation plan: native Pi Z.ai extension

> Execute this plan in the existing `OnlineChefGroep/pi-zai` repository. Do not create a new repository, provider proxy, agent runtime, model router, GPU/self-hosted layer, or multi-CLI abstraction.

## 0. Mission

Turn `@onlinechefgroep/pi-zai` into a small, native Pi extension that improves the reliability and observability of Pi's existing Z.ai integration without taking ownership of Pi's provider, credentials, model selection, streaming, retry engine, tools, or session runtime.

The extension must provide trustworthy local insight into:

- input, cached-input and output tokens;
- cache-segment changes;
- latency and retry attempts;
- transport/provider failures;
- API-equivalent cost estimates;
- benchmark results for optional optimizations.

Normal operation must make **zero extra model calls** and **zero extra provider requests**.

Implementation weight: medium, but deliberately bounded. Expect a small storage adapter, request-correlation state, cache fingerprints, diagnostics, commands and tests. Do not turn this into a framework.

---

## 1. Repository and delivery strategy

Use the current repository:

```text
OnlineChefGroep/pi-zai
```

Create one implementation branch:

```text
feat/native-pi-zai-v1
```

Prefer one pull request with three atomic implementation commits:

1. `refactor: restore native Pi provider boundary`
2. `feat: add local SQLite observability and retention`
3. `feat: add diagnostics and benchmark harness`

Do not split the code into new npm packages. Do not create a separate telemetry repository. A shared core may be extracted only after another CLI has a real, implemented requirement; that is outside this task.

Before editing:

1. inspect `README.md`, `src/index.ts`, `src/config.ts`, `src/platform-provider.ts`, `src/model-catalog.ts`, `src/cache/**`, `src/commands/**`, tests and `package.json`;
2. run the existing build and tests;
3. record the current behavior of provider registration, endpoint commands, cache metrics and thinking normalization;
4. keep existing public exports unless they are unsafe or explicitly deprecated in this plan.

---

## 2. Hard architectural boundary

Pi remains the sole owner of:

- credentials and auth storage;
- `ZAI_API_KEY` and all provider environment resolution;
- built-in `zai` and `zai-coding-cn` providers;
- endpoint and selected model;
- model catalog;
- thinking-level selection;
- request construction and streaming;
- response parsing;
- tool execution;
- retry scheduling;
- session lifecycle.

`pi-zai` may only use public Pi extension hooks and exported Pi package APIs.

### Required removals

Remove all runtime behavior that re-registers or unregisters Pi's native providers:

```ts
// REMOVE
pi.registerProvider("zai", ...)
pi.registerProvider("zai-coding-cn", ...)
pi.unregisterProvider("zai")
pi.unregisterProvider("zai-coding-cn")
```

Remove plugin-owned Coding Plan credential references:

```ts
// REMOVE
"$ZAI_API_KEY"
"$ZAI_CODING_CN_API_KEY"
```

Remove `PI_ZAI_*` environment overrides. Plugin settings belong in Pi's global/project settings files. The plugin must never mutate `process.env`.

Do not auto-register `zai-platform` in this release. Keep or delete catalog helpers based on whether they have a tested, non-runtime use, but loading the extension must not add a provider.

### Correct provider-payload behavior

Use Pi's public payload hook only for narrowly scoped Z.ai payload normalization:

```ts
pi.on("before_provider_request", (event, ctx) => {
  if (!isNativeZaiModel(ctx.model)) return;

  return normalizeZaiPayload(event.payload, {
    preserveThinking: config.preserveThinking,
  });
});
```

The normalizer may adjust only documented/required Z.ai thinking compatibility fields. It must not select a model, endpoint, key, retry count or timeout.

### Correct request-header behavior

```ts
pi.on("before_provider_headers", (event, ctx) => {
  if (!isNativeZaiModel(ctx.model)) return;

  applyCorrelationHeaders(event.headers, currentAttempt);
});
```

Correlation must identify `pi-zai`; never impersonate ZCode. Do not set ZCode user agents, referers, version headers or client names.

### Forbidden implementations

Do not implement:

- a replacement HTTP client;
- an OpenAI/Anthropic-compatible proxy;
- automatic model routing;
- automatic GLM-5.2 to GLM-4.7 switching;
- hidden subagents;
- second-model reasoning;
- self-hosted GLM, vLLM, SGLang, Hugging Face downloads or quantization;
- OpenCode, OpenClaude, Claude Code or Factory adapters;
- remote analytics in the initial implementation;
- any write to a repository-local metrics database.

---

## 3. Minimal target architecture

Keep the structure compact. Do not create a deep framework hierarchy.

Recommended shape:

```text
src/
├── index.ts
├── config.ts
├── native-zai.ts
├── correlation.ts
├── diagnostics.ts
├── benchmark.ts
├── cache/
│   ├── fingerprint.ts
│   ├── prompt-stability.ts
│   └── metrics.ts
├── storage/
│   ├── types.ts
│   ├── memory.ts
│   ├── sqlite.ts
│   └── migrations.ts
└── commands/
    └── index.ts
```

Use fewer files when natural. Do not introduce dependency injection containers, event buses, ORMs or a generic plugin SDK.

Core interfaces should stay small:

```ts
export interface MetricsStorage {
  initialize(): void;
  recordAttempt(record: ProviderAttemptRecord): void;
  getUsageSummary(filter?: UsageFilter): UsageSummary;
  getCacheSummary(filter?: UsageFilter): CacheSummary;
  getTransportSummary(filter?: UsageFilter): TransportSummary;
  runCleanup(now: number): CleanupResult;
  clearProject(projectId: string): void;
  clearDetails(): void;
  clearBenchmarks(): void;
  clearAll(): void;
  close(): void;
}
```

Provide:

- `MemoryStorage`: always available, session-only;
- `NodeSqliteStorage`: optional persistent implementation using built-in `node:sqlite`;
- automatic fail-open fallback from SQLite to memory.

---

## 4. Configuration

Read only Pi's existing global and project settings files. Project settings override global settings.

Target configuration:

```json
{
  "zai": {
    "preserveThinking": false,
    "promptStability": {
      "mode": "observe"
    },
    "sessionAffinity": "off",
    "metrics": {
      "mode": "local",
      "retentionDays": 30,
      "rollupRetentionDays": 180,
      "maxDatabaseBytes": 33554432
    },
    "telemetry": {
      "mode": "off"
    }
  }
}
```

Supported initial values:

```text
promptStability.mode: off | observe | safe
sessionAffinity:      off | observe | experimental
metrics.mode:         off | memory | local
telemetry.mode:       off
```

`telemetry.mode` must accept only `off` in this implementation. Document future aggregate telemetry, but do not build its network path yet.

Defaults:

- `preserveThinking=false`;
- `promptStability.mode=observe`;
- `sessionAffinity=off`;
- `metrics.mode=local`;
- detailed retention 30 days;
- daily rollup retention 180 days;
- soft database maximum 32 MiB;
- remote telemetry off.

Invalid values must fall back safely and produce at most one concise warning per session.

---

## 5. Local SQLite source of truth

Use one local SQLite database under Pi's resolved user-state directory:

```text
<pi-user-state>/pi-zai/metrics.sqlite3
```

Possible SQLite companion files are acceptable:

```text
metrics.sqlite3-wal
metrics.sqlite3-shm
```

Do not store the database inside a project repository. Do not create one database per project.

Prefer built-in `node:sqlite`; add no ORM and no native addon dependency. Hide the API behind `MetricsStorage` because Node's SQLite API may evolve.

If SQLite cannot be imported, opened, migrated or written:

1. emit one warning;
2. switch to `MemoryStorage` for the session;
3. never block or cancel a model turn.

### Minimal schema

Use the smallest schema that supports the commands and benchmark.

```sql
CREATE TABLE schema_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE provider_attempts (
  id INTEGER PRIMARY KEY,
  occurred_at INTEGER NOT NULL,
  project_id TEXT,
  session_hash TEXT,
  query_id TEXT,
  request_id TEXT,
  attempt INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  endpoint_kind TEXT NOT NULL,
  thinking_level TEXT,
  pi_version TEXT,
  extension_version TEXT NOT NULL,
  system_fingerprint TEXT,
  toolset_fingerprint TEXT,
  payload_fingerprint TEXT,
  input_tokens INTEGER,
  cache_read_tokens INTEGER,
  cache_write_tokens INTEGER,
  output_tokens INTEGER,
  request_to_headers_ms REAL,
  request_to_first_delta_ms REAL,
  total_ms REAL,
  http_status INTEGER,
  error_category TEXT,
  estimated_api_cost_microusd INTEGER
) STRICT;

CREATE TABLE daily_rollups (
  day TEXT NOT NULL,
  project_id TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  extension_version TEXT NOT NULL,
  turn_count INTEGER NOT NULL,
  attempt_count INTEGER NOT NULL,
  error_count INTEGER NOT NULL,
  input_tokens INTEGER NOT NULL,
  cache_read_tokens INTEGER NOT NULL,
  cache_write_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_api_cost_microusd INTEGER NOT NULL,
  PRIMARY KEY(day, project_id, provider, model, extension_version)
) STRICT;

CREATE TABLE benchmark_runs (
  run_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  variant TEXT NOT NULL,
  scenario TEXT NOT NULL,
  manifest_json TEXT NOT NULL,
  report_json TEXT
) STRICT;
```

Use integer microdollars, never floating-point dollar storage.

Minimal indexes:

```sql
CREATE INDEX attempts_by_time
ON provider_attempts(occurred_at);

CREATE INDEX attempts_by_project_time
ON provider_attempts(project_id, occurred_at);

CREATE INDEX attempts_by_query
ON provider_attempts(query_id, attempt);
```

Do not index every field.

### SQLite pragmas

Apply on open:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;
PRAGMA auto_vacuum = INCREMENTAL;
PRAGMA busy_timeout = 25;
```

Rules:

- prepared statements only;
- at most one short transaction per completed provider attempt;
- no writes on stream-delta events;
- never hold a transaction during a network/model request;
- a database lock must degrade to memory rather than delay the model turn;
- close/checkpoint at safe lifecycle points.

### Project and session identities

Never store raw paths or raw Pi session IDs.

```ts
const projectId = sha256(`pi-zai:project:${canonicalCwd}`).slice(0, 16);
const sessionHash = sha256(`pi-zai:session:${piSessionId}`).slice(0, 16);
```

Fingerprints are local diagnostic identifiers, not identity or security tokens.

---

## 6. Privacy allowlist

Persist only explicitly allowed technical fields:

- timestamps;
- local project/session hashes;
- generated query/request IDs;
- attempt number;
- provider/model/endpoint kind;
- thinking level;
- Pi and extension versions;
- system/toolset/payload fingerprints;
- token counters;
- latency values;
- HTTP status;
- controlled error category;
- estimated API-equivalent cost.

Never persist:

- API keys, cookies or authorization headers;
- complete headers;
- prompts or system-prompt text;
- assistant output or reasoning;
- tool arguments/results;
- source code, diffs or shell output;
- raw paths;
- environment values;
- arbitrary exception objects or provider error bodies.

Build serialization from an allowlist. Do not redact a broad object after the fact.

---

## 7. Retention, rotation and wipes

SQLite replaces rotating operational JSONL files. JSON, CSV and Markdown are export/report formats only.

Run cleanup:

- at most once per UTC day during `session_start`;
- after a benchmark completes;
- after retention settings change;
- when database size exceeds the soft limit.

Cleanup sequence:

1. aggregate expiring detailed rows into `daily_rollups`;
2. delete detailed attempts older than `retentionDays`;
3. delete rollups older than `rollupRetentionDays`;
4. delete incomplete benchmarks older than seven days;
5. run incremental vacuum only when useful;
6. checkpoint WAL outside active model work.

If the database remains over the configured limit, delete oldest detailed rows first while retaining the most recent seven days where possible. Preserve rollups longer than details.

Commands:

```text
/zai-data status
/zai-data clear-project
/zai-data clear-details
/zai-data clear-benchmarks
/zai-data clear-all
/zai-data export-json <path>
/zai-data export-csv <path>
/zai-data vacuum
```

Behavior:

- `clear-project`: delete current project-hash records;
- `clear-details`: keep rollups, remove detailed attempts;
- `clear-benchmarks`: remove benchmark rows;
- `clear-all`: delete database plus WAL/SHM after confirmation;
- exports remain local and use only the privacy allowlist.

Never touch Pi sessions, settings, credentials or repository files.

---

## 8. Cache fingerprinting and prompt stability

### Full tool fingerprint

The current implementation fingerprints active tool names only. Replace this with a deterministic fingerprint of complete active tool definitions:

```ts
interface CanonicalToolFingerprintInput {
  name: string;
  description?: string;
  parameters?: unknown;
  promptGuidelines?: string[];
  source?: string;
}
```

Canonicalization:

1. select only stable semantic fields;
2. recursively sort object keys;
3. sort tools by name;
4. normalize absent optional values;
5. serialize deterministically;
6. SHA-256 hash.

Discovery order alone must not change the fingerprint. Description or JSON-schema changes must change it.

### System prompt modes

`off`:

- no analysis;
- no rewrite.

`observe`:

- analyze stable and volatile sections;
- calculate fingerprints;
- report likely cache-breaking drift;
- never modify the prompt.

`safe`:

- modify only prompts containing the exact marker:

```text
--- dynamic context ---
```

- preserve all content;
- keep the stable prefix before the marker unchanged;
- normalize the dynamic suffix placement only;
- operation must be idempotent;
- if validation fails, return the original prompt unchanged.

Do not heuristically move timestamps, git status or errors when the marker is absent.

---

## 9. Request, query and attempt correlation

Maintain:

- stable session hash for the Pi session;
- stable query ID for one logical user turn;
- unique request ID for each provider attempt;
- explicit attempt counter.

Example:

```text
session: sess-9f2718c21803810d
query:   q-0042-43ecad15
request: q-0042-43ecad15-a1
attempt: 1
```

Retry:

```text
q-0042-43ecad15-a2
```

Persist a canonical payload fingerprint per attempt. Equivalent payload objects must produce the same fingerprint regardless of object-key order.

Use public Pi request/response hooks. Never take ownership of retry scheduling.

### Session affinity

Modes:

- `off`: calculate only required internal IDs; send no experimental affinity header;
- `observe`: calculate/report capability; send nothing;
- `experimental`: send only explicitly approved session/query/request correlation headers.

Keep `experimental` disabled by default. Do not claim it improves cache until benchmark evidence exists.

Never spoof official ZCode identity.

---

## 10. Timing and error classification

Capture timestamps when public hooks/events permit:

```text
request_start
headers_received
first_thinking_delta
first_text_delta
first_tool_delta
response_end
```

Derived values:

```text
TTFH  = headers_received - request_start
TTFT  = first visible/model delta - request_start
total = response_end - request_start
```

Store null when a timestamp is unavailable. Do not invent precision.

Controlled error categories:

```text
dns
tcp_connect
tls
certificate
proxy
timeout_before_headers
http_4xx
http_429
http_5xx
stream_interrupted
context_overflow
authentication
unknown_transport
```

Do not persist raw error bodies.

`/zai-doctor` should inspect without changing configuration:

- Pi and extension versions;
- current provider/model/endpoint kind;
- credential source label, never credential value;
- DNS A/AAAA;
- IPv4/IPv6 reachability where practical;
- TCP and TLS timing;
- certificate issuer/expiry/hostname match;
- ALPN;
- proxy variable names/presence only;
- `NODE_EXTRA_CA_CERTS` presence/path;
- recent controlled error category;
- storage and retention health.

Diagnostics must be bounded and user-invoked. Do not run network diagnostics on every model turn.

---

## 11. Commands and output

Preserve the existing commands where useful, but remove or deprecate commands that mutate native provider ownership.

Target compact command surface:

```text
/zai
/zai-cache
/zai-usage
/zai-transport
/zai-doctor
/zai-data
/zai-benchmark
```

`/zai` must clearly show:

```text
Provider            zai
Model               glm-5.2
Endpoint            Coding Plan
Thinking            high
Preserve thinking   false
Prompt mode         observe
Affinity            off
Metrics             local
Remote telemetry    off
```

`/zai-usage` must label dollar output as:

```text
Estimated Platform API-equivalent cost; not Coding Plan billing.
```

Do not imply that cached Coding Plan tokens are billed at a documented discount unless Z.ai explicitly documents it.

---

## 12. Remote telemetry levels: design only

Do not implement remote telemetry transport in this pull request.

Document the future levels:

### Level 0: metrics off

- no database;
- no history;
- no network.

### Level 1: local only

- default;
- SQLite history and local commands;
- no uploads.

### Level 2: anonymous daily aggregate

Future explicit opt-in only. Potential payload may contain bucketed population metrics such as extension major/minor, Pi major/minor, OS family, model, prompt mode, cache-ratio bucket, TTFT bucket and controlled error counts.

It must not contain stable installation, project, session, request, IP, location, repository, hostname, path, prompt or endpoint identifiers.

### Level 3: explicit diagnostic/benchmark submission

Future one-time command with preview and confirmation.

For now, implement only configuration validation that rejects any telemetry mode other than `off`, plus documentation. Do not add a Worker endpoint or analytics dependency.

---

## 13. Benchmark harness

The benchmark is required before enabling optional optimizations by default.

### Variants

```text
A0  Native Pi, extension not loaded
A1  pi-zai loaded, observe-only
A2  A1 + explicit-marker safe prompt mode
A3  A2 + experimental session affinity
```

GLM-4.7 and second-model calls are excluded.

### Controlled variables

Keep identical:

- Pi version;
- extension commit except feature flags;
- provider/model;
- thinking level;
- repository state;
- prompts;
- active tools and schemas;
- retry/compaction settings;
- network location and approximate time window.

### Scenarios

1. **Stable conversation**: 12 turns, unchanged prompt/tools, no compaction.
2. **Explicit dynamic context**: 12 turns where only content below the marker changes.
3. **Tool drift**: unchanged tools; order-only change; description change; schema change; added MCP tool.
4. **Real coding session**: 20-30 turns with read/search/diff/test/failure/repair/one compaction.
5. **Controlled failure**: pre-header failure, timeout, interrupted stream, 429 and 500 where safely reproducible.

Do not generate abusive provider load or bypass limits.

### Required measurements

Per attempt:

```text
timestamp
run/variant/scenario/cohort
session/query/request/attempt IDs
provider/model/thinking level
system/tool/payload fingerprints
input/cache-read/cache-write/output tokens
request-start/headers/first-delta/end timestamps
TTFH/TTFT/total latency
HTTP status/error category
estimated API-equivalent cost
local plugin/storage overhead
```

### Sample size

Before changing defaults:

- at least five independent sessions per principal variant/scenario;
- at least 12 turns per session;
- at least 60 measured turns per variant;
- target at least 240 total turns for A0-A3 comparison.

### Acceptance gates

Observe-only:

- zero extra model/provider requests;
- zero provider/auth/model/endpoint changes;
- less than 5 ms median local hook overhead;
- less than 15 ms p95 local hook overhead;
- no response/tool behavior changes.

SQLite:

- no writes during stream deltas;
- p95 attempt-completion storage overhead below 5 ms under normal conditions;
- locks/corruption/read-only state never block a turn;
- database remains bounded.

Safe prompt mode may become recommended only if it yields either:

- at least 10 percentage points higher cache ratio; or
- at least 15% fewer newly processed input tokens;

with no quality, tool-call, error-rate or meaningful p95-latency regression.

Experimental affinity may become recommended only if it yields either:

- at least 10 percentage points higher cache ratio; or
- at least 15% lower median TTFH/TTFT;

without increased 429s, transport errors or cross-session contamination.

Generate local JSON and Markdown reports on demand. Do not automatically upload them.

---

## 14. Tests

Required unit tests:

- config defaults/validation/precedence;
- no environment mutation;
- canonical JSON stability;
- tool-order-independent fingerprint;
- fingerprint changes for description/schema changes;
- prompt marker parsing and safe-mode idempotence;
- no heuristic rewrite without marker;
- session/query/request/attempt lifecycle;
- payload-fingerprint stability;
- privacy allowlist serialization;
- SQLite migration and schema versioning;
- prepared insert/query summaries;
- retention by age and database limit;
- rollup generation;
- clear-project/details/benchmarks/all;
- corrupt/locked/read-only database fallback;
- memory mode writes no files;
- metrics off writes no files.

Required contract/integration tests:

- native provider unchanged with extension loaded;
- native model unchanged;
- native auth source unchanged;
- endpoint unchanged;
- no extra model/provider request;
- payload normalizer touches only allowed thinking fields;
- feature-hook absence fails open;
- metrics errors never block a turn;
- safe mode returns original prompt on validation failure.

Run:

```bash
npm run build
npm test
npm pack --dry-run
```

Add no new runtime dependency unless unavoidable and justified in the PR.

---

## 15. Implementation sequence

### Phase 1: restore native boundary

1. delete native provider re-registration/unregistration;
2. delete plugin credential/env override logic;
3. stop automatic Platform provider registration;
4. move thinking handling to the public payload hook;
5. audit endpoint-selection commands and remove native-provider mutation;
6. add boundary contract tests;
7. update README/configuration/troubleshooting docs.

Stop and fix before proceeding if loading the extension changes provider, model, endpoint, auth source or number of provider requests.

### Phase 2: correlation, fingerprints and local storage

1. implement config schema;
2. implement canonical hashing;
3. implement full tool fingerprint;
4. implement prompt analysis/off-observe-safe;
5. implement request/query/attempt state;
6. implement `MemoryStorage`;
7. implement SQLite migrations/storage;
8. implement retention, wipe and export;
9. wire existing cache/usage commands to storage queries;
10. add privacy and failure-mode tests.

### Phase 3: diagnostics and benchmark

1. implement bounded user-invoked doctor checks;
2. implement controlled error categories;
3. implement transport summaries;
4. implement benchmark manifest, observations and report generation;
5. add A0-A3 fixtures/instructions;
6. keep experimental affinity disabled;
7. document results, but do not change defaults until sample gates are met.

---

## 16. Definition of done

The work is complete only when all are true:

1. `pi-zai` never replaces Pi's native `zai` providers, credentials, endpoint or model.
2. Normal operation creates no additional model/provider call.
3. The extension never mutates Pi credential environment.
4. Cache/tool/payload fingerprints are deterministic and diagnostically useful.
5. Local history uses one bounded SQLite database outside repositories.
6. Database failure degrades to memory-only without blocking Pi.
7. No prompt, code, output, path, secret or raw provider payload is persisted.
8. Rotation/retention/wipes/exports are tested.
9. Safe prompt mode changes only explicitly marked dynamic context.
10. Session affinity remains off unless benchmark gates are met.
11. Remote telemetry remains unimplemented and off.
12. Build, tests and package dry-run pass.
13. README explains exactly what is local, what is sent nowhere, and how to wipe it.

---

## 17. Cursor agent operating rules

- Execute, do not redesign the product outside this document.
- Reuse existing code where correct; remove unsafe duplication.
- Keep changes minimal and typed.
- Do not introduce speculative abstractions.
- Do not add a network service.
- Do not implement GLM-4.7 offload.
- Do not modify other repositories.
- Do not change defaults based on a tiny benchmark.
- Preserve backward-compatible commands when possible; clearly deprecate unsafe behavior.
- After each phase, run targeted tests before continuing.
- In the final PR summary, report:
  - files changed;
  - behavior removed;
  - behavior added;
  - privacy/storage model;
  - exact test commands and results;
  - benchmark status;
  - remaining explicitly deferred work.
