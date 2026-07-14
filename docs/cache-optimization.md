# Cache optimization

Z.AI uses **implicit context caching**: repeated prompt prefixes are recognized automatically. There are no manual cache breakpoints, `cache_control` markers, or `prompt_cache_key` fields for Z.AI.

Official reference: [Z.AI Context Caching](https://docs.z.ai/guides/capabilities/cache)

## How Pi maps usage

| Pi field | Z.AI meaning |
|----------|----------------|
| `usage.input` | Uncached prompt tokens |
| `usage.cacheRead` | Cached prompt tokens (`prompt_tokens_details.cached_tokens`) |
| `usage.cacheWrite` | Cache-write tokens when a provider reports them |

Hit ratio:

```text
cacheRead / (input + cacheRead + cacheWrite)
```

Non-hit ratio:

```text
(input + cacheWrite) / (input + cacheRead + cacheWrite)
```

Pi's Session Info labels the combined prompt total as **Input**, then splits it into **Cached** and **Uncached**. pi-zai command output uses `Cached input`, `Uncached input`, and `Cache write` explicitly to avoid treating `usage.input` as the total prompt size.

## Full session versus current segment

`/zai` scans Pi's session entries and reports totals for Z.AI providers only. These totals can span model changes and multiple cache segments.

`/zai-cache` deliberately reports the **current segment** only. A segment is keyed by:

- provider
- endpoint (`coding`, `platform`, or `coding-cn`)
- model id
- stable system-prompt fingerprint
- toolset fingerprint

Segment metrics reset when any key changes or when the extension starts a new session. This is why `/zai-cache` can show fewer tokens than Pi's full Session Info. Cross-endpoint and cross-model cache transfer is not assumed.

### Dynamic tools on Z.AI

Pi 0.80.7 can activate tools during a tool execution and annotate `addedToolNames` on the tool result. Providers with native deferred loading keep the cached prefix; Z.AI's `openai-completions` path instead receives the full active tool list on the next request. pi-zai therefore:

1. fingerprints the active toolset immediately before each provider request;
2. classifies additive/removal/schema transitions without storing raw tool names in metrics;
3. starts a new cache segment exactly once when the effective toolset changes.

Optional `zai.adaptiveTools.manual` mode uses this plumbing for application-level deferred loading via `zai_load_tools`.

All-zero usage objects from connection failures or local command responses are ignored. They do not replace the last successful cache sample or increment the provider request count.

## Prompt stability

Fingerprints canonicalize content without logging raw prompts:

- strip recognized volatile lines such as git status, timestamps, and token counts
- ignore content below the explicit dynamic-context marker when calculating the stable prefix
- hash active tool definitions in stable sorted order

The default `promptStability.mode` is `observe`: it measures structure without changing the prompt. `safe` can move recognized volatile lines below an existing marker.

```text
You are a coding agent. Follow project conventions.

--- dynamic context ---
Current git status: ...
Current timestamp: ...
```

Volatile line prefixes recognized by the extension:

- `Current git status`
- `Current git diff`
- `Latest test failure`
- `Current timestamp`
- `Ephemeral diagnostics`
- `Context tokens:`
- `Token count:`

## Preserved thinking and cache

Current Pi releases send `clear_thinking=false` while Z.AI thinking is enabled. pi-zai leaves that native behavior unchanged unless `zai.preserveThinking` is explicitly set.

Z.AI documents preserved thinking as beneficial for coding and agent scenarios because exact historical reasoning blocks can improve reasoning continuity and cache reuse. Forcing `preserveThinking: false` changes the request to `clear_thinking=true`; that is now an explicit trade-off rather than the default.

See [Thinking](thinking.md).

## Compaction

On compaction and branch summarization for Z.AI sessions, the extension injects deterministic instructions:

- preserve visible decisions, paths, and tool outcomes
- avoid replaying hidden reasoning in the compacted summary
- use fixed section headings for stable summaries

A compaction is a legitimate context boundary. Pi's full Session Info may include usage before and after it, while current-segment diagnostics focus on the active cache shape.

## Recommendations

`/zai-cache status` includes recommendations when:

- the segment hit ratio is low or moderate
- a recent provider/model/prompt/toolset change reset the segment
- cache writes exceed reads

Reset extension-side segment metrics only:

```text
/zai-cache reset-stats
```

This does **not** invalidate Z.AI server-side caches.

## Best practices

1. **Stable system prompt** — edit durable rules rarely; put dynamic context after the marker.
2. **Stable toolset** — avoid adding or removing tools mid-session when possible.
3. **One endpoint per workflow** — do not assume cache transfer between Coding Plan and Platform.
4. **Append history exactly** — preserved reasoning blocks must remain complete and unmodified.
5. **Compare scopes correctly** — use `/zai` for Z.AI session totals and `/zai-cache` for the current segment.

## Platform billing note

On `zai-platform`, cached tokens use discounted pricing from model metadata (`cost.cacheRead`). `/zai-usage` and `/zai-cache` show estimated dollar values on Platform. Coding Plan output is marked `subscription-managed` because Pi's model catalog reports zero per-token prices for that subscription endpoint.

## Cache-affinity benchmark snapshot (2026-07-12)

A live A/B run compared no affinity, a fixed `X-Session-Id`, and a rotating id on the Z.AI Coding Plan endpoint.

### Settings

| Parameter | Value |
|-----------|-------|
| Trials per mode | 2 (`PI_ZAI_AB_TRIALS=2`) |
| Turns per trial | 4 (`PI_ZAI_AB_TURNS=4`) |
| Stable prefix lines | 200 (`PI_ZAI_AB_PREFIX_LINES=200`) |
| Model | `glm-4.6` |

### Warm-turn cache hit ratio (turn 0 excluded)

| Mode | Median | Aggregate | Avg latency | Errors |
|------|--------|-----------|-------------|--------|
| fixed `X-Session-Id` (experimental) | 97.9% | 97.9% | 3100 ms | 0 |
| no `X-Session-Id` (default) | 98.6% | 98.6% | 4543 ms | 0 |
| rotating id (anti-affinity control) | 98.8% | 98.8% | 2357 ms | 0 |

Per-trial medians: fixed 97.9%, 97.9%; none 98.8%, 98.4%; rotating 98.8%, 98.8%.

### Conclusion

**Inconclusive.** All modes achieved roughly 98% warm-turn cache hits, and the fixed id did not clear the benchmark's five-percentage-point improvement gate. `sessionAffinity` therefore remains off by default and experimental when enabled. This single run is not evidence of a general quality or latency improvement.
