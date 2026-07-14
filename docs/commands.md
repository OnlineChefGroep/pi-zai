# Commands

All commands require an active Z.AI model unless noted.

## `/zai`

Status dashboard for the active Z.AI model:

- provider, endpoint, and model
- Pi-native thinking level and mapped Z.AI request fields
- effective `clear_thinking` policy: native Pi or an explicit settings override
- tool-streaming compatibility flag
- credential source name, never the key value
- latest successful Z.AI provider usage
- assistant stream-wall throughput (output tok/s), first content delta after stream start, and turn-effective throughput
- tool executions for the current process session: counts and durations only
- Z.AI-provider session totals and cache-hit ratio
- prompt-stability counts and fingerprint
- metrics, telemetry, affinity, and prompt modes

The cache section in `/zai` scans Pi session entries but includes Z.AI providers only. It can span multiple Z.AI models or cache segments. Pi's own Session Info remains the authoritative all-provider session total.

## `/zai-endpoint coding|platform`

Switch endpoint by selecting the default model on the target provider through Pi's native `setModel`:

```text
/zai-endpoint coding
/zai-endpoint platform
```

There is no hidden endpoint state. The active endpoint always follows the selected model. `zai-platform` must already be registered in `models.json`.

## `/zai-cache [status|reset-stats|explain]`

Implicit-cache diagnostics for the **current cache segment**.

A segment is defined by provider, endpoint, model, stable system-prompt fingerprint, and active toolset fingerprint. Its totals reset when one of those boundaries changes, so they can be lower than `/zai` or Pi Session Info.

| Action | Description |
|--------|-------------|
| `status` (default) | Current segment key, successful-request token totals, hit/miss ratios, cost, boundaries, and recommendations |
| `reset-stats` | Clear extension-side segment metrics; does not invalidate Z.AI server-side cache |
| `explain` | Explain Z.AI implicit caching, Pi usage fields, ratios, and scope differences |

All-zero usage objects from connection failures are ignored as cache samples. The last-request line therefore refers to the last successful request with non-empty prompt usage.

## `/zai-usage`

Z.AI-provider session usage with endpoint-specific interpretation:

- uncached input, cached input, cache writes, and output
- aggregate Z.AI hit ratio
- Platform endpoint: estimated dollar cost from model metadata
- Coding Plan endpoint: subscription-managed usage plus live quota windows from the monitor API when available

This command does not include non-Z.AI providers used earlier in the same Pi session.

## `/zai-doctor`

Integration checks and optional live probes:

- current Pi GLM-5.2 thinking-level map
- Pi-native versus explicitly overridden preserved-thinking policy
- Platform pricing metadata
- compaction-policy presence
- prompt and tool fingerprint utilities
- optional cache-affinity header (`X-Session-Id`)
- streamed usage and cached-token support
- Pi retry-settings advice
- optional `/models` reachability probe
- optional three-request connection-stability probe

The current GLM-5.2 mapping is:

```text
low / medium / high → Z.AI high
max                 → Z.AI max
```

Network probes use configured credentials and omit key values and response bodies from output.

## `/zai-data [action]`

Local privacy-reduced Z.AI attempt metrics. SQLite is the default storage mode. See [Security](security.md) for the exact allowlist.

| Action | Description |
|--------|-------------|
| `status` (default) | Storage kind, paths, row counts, project/session hashes |
| `clear-project` | Delete metrics for the current project hash |
| `clear-details` | Delete detail rows while retaining daily rollups |
| `clear-benchmarks` | Delete benchmark run rows |
| `clear-all` | Wipe all pi-zai metrics and rotate `local.secret` |
| `export-json <path>` | Export attempts for the current project |
| `export-csv <path>` | Export CSV |
| `vacuum` | Run SQLite maintenance |

## `/zai-transport`

Local transport summary for the current project: attempt count, controlled error count, average request-to-headers, first-delta, first-tool, and total latency. Raw provider error bodies are not retained.

## `/zai-privacy preview`

Local privacy report showing:

- SQLite field allowlist
- fields that are never stored or uploaded
- remote telemetry mode and consent state
- aggregate JSON preview

The preview is not sent unless aggregate mode and explicit consent are both active.

## `/zai-telemetry [action]`

Opt-in anonymous daily aggregate uploads. Requires `zai.telemetry.mode: aggregate` plus explicit consent.

| Action | Description |
|--------|-------------|
| `status` (default) | Mode, consent file, ingest endpoint, pending UTC days |
| `preview [day]` | Build local aggregate JSON for a day without sending it |
| `enable` | Confirm opt-in and write the consent file |
| `disable` | Remove consent and stop uploads |
| `upload [day]` | Upload one completed UTC day |
| `sync` | Upload pending completed days |

## `/zai-benchmark [action]`

A0–A3 cache benchmark harness and local run tracking. Reports use persisted attempts after run start; completion must happen in the same Pi session and provider/model.

| Action | Description |
|--------|-------------|
| `manifest` (default) | Variants, scenarios, and sample gates |
| `instructions <A0–A3> [scenario]` | Setup instructions and settings JSON |
| `start <A1|A2|A3> [scenario]` | Begin a tracked extension run and record its attempt baseline |
| `complete [run-id]` | Finish an active run and print its gate report |
| `status` | Recent runs and active run id |
| `report [run-id]` | Show a stored report |
| `gates` | Compare completed runs with sample targets |

A0 is native Pi without pi-zai and must be run outside the extension. A1 observes prompt stability, A2 adds safe prompt normalization, and A3 adds experimental fixed-session affinity.

## Live cache-affinity script

From the repository root after installing dependencies:

```bash
export ZAI_API_KEY='...'
npm run benchmark:cache-affinity
```

The script compares a fixed `X-Session-Id`, no affinity header, and a rotating-id anti-affinity control. Optional JSON output is configured with `PI_ZAI_AB_OUTPUT`.
