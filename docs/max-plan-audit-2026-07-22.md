# Z.AI Max plan and pi-zai audit — 22 July 2026

## Executive finding

The observed GLM-5.2 session has excellent cache reuse and strong decode speed, but poor enough connection reliability and first-token latency that the public Max claim **“dedicated resources during peak times”** cannot be treated as demonstrated by the service experience.

This does not prove that no priority allocation exists internally. It does show that the consumer-visible outcome is not equivalent to reserved or reliably available capacity.

## Plan under test

The account is on `LM Coding Max-Monthly Plan` and the subscription page advertises:

- everything in Pro plus 20× Lite usage;
- advanced use on mid-to-large repositories;
- first access to flagship models and features;
- dedicated resources during peak times.

The public usage policy separately says concurrency is dynamically adjusted based on resource availability, with only the general ordering `Max > Pro > Lite`. That is weaker than a guaranteed availability or service-level commitment.

## Thinking controls

GLM-5.2 has three operational behaviors in Pi:

```text
off  -> thinking.type = disabled
high -> thinking.type = enabled, reasoning_effort = high
max  -> thinking.type = enabled, reasoning_effort = max
```

Pi may expose `low`, `medium`, `high`, and `max`, but `pi-zai` maps `low`, `medium`, and `high` to Z.AI `high`. Only `max` selects the heavier third behavior.

## Native Pi token accounting

```text
requests       = 171
uncached input = 988,092
cached input   = 38,264,384
cache write    = 0
output         = 123,341
```

### Prompt total

```text
prompt_total
  = uncached_input + cached_input + cache_write
  = 988,092 + 38,264,384 + 0
  = 39,252,476 tokens
```

### Session cache-hit ratio

```text
hit_ratio
  = cached_input / prompt_total
  = 38,264,384 / 39,252,476
  = 0.974827...
  = 97.48%
```

### Last request

```text
uncached = 1,290
cached   = 327,744
output   = 694

prompt_total = 329,034
hit_ratio    = 327,744 / 329,034
             = 99.608%
```

## Platform-rate equivalent

The Coding Plan is subscription-managed. The following uses GLM-5.2 Platform rates only as an economic comparison:

```text
uncached input = $1.40 / 1M tokens
cached input   = $0.26 / 1M tokens
output         = $4.40 / 1M tokens
cache write    = $0.00 / 1M tokens in the current catalog
```

### Actual cached equivalent

```text
uncached_input_cost
  = 988,092 / 1,000,000 × 1.40
  = $1.3833288

cached_input_cost
  = 38,264,384 / 1,000,000 × 0.26
  = $9.94873984

output_cost
  = 123,341 / 1,000,000 × 4.40
  = $0.5427004

actual_equivalent_total
  = 1.3833288 + 9.94873984 + 0.5427004
  = $11.87476904
```

### Cost contribution

```text
uncached input share = 1.3833288 / 11.87476904 = 11.65%
cached input share   = 9.94873984 / 11.87476904 = 83.78%
output share         = 0.5427004 / 11.87476904 = 4.57%
```

Output is 3.14× more expensive per token than fresh input and 16.92× more expensive per token than cached input. It was nevertheless only 4.57% of this session's metered equivalent because the cached prompt volume was more than 310× the output-token volume.

Therefore:

```text
higher price per token != largest total optimization opportunity
```

### No-cache counterfactual

```text
all_prompt_as_uncached
  = 39,252,476 / 1,000,000 × 1.40
  = $54.9534664

no_cache_total
  = 54.9534664 + 0.5427004
  = $55.4961668

cache_savings_equivalent
  = 55.4961668 - 11.87476904
  = $43.62139776
```

Cache reduced the metered equivalent by:

```text
43.62139776 / 55.4961668 = 78.60%
```

## Performance

```text
last stream decode        = 72 output tok/s
session stream average    = 73 output tok/s
assistant-stream decode   = 82 output tok/s
turn-effective throughput = 30 output tok/s
mean request to headers   ≈ 11.9 s
mean first visible delta  ≈ 11.9 s
mean turn wall            ≈ 22.9 s
```

The model is fast after generation begins. The dominant interactive weakness is the roughly 12-second silent period before visible output, followed by tool/runtime wall time.

## Reliability and metric semantics

The displayed transport sample was:

```text
stored logical turns = 68
terminal errors      = 10
terminal error rate  = 10 / 68 = 14.71%
```

This must not be described as `10 failed network attempts out of 68 provider attempts`.

The current tracker stores one row at turn end. Internal retries overwrite the in-flight attempt record; the final attempt number is retained, but earlier attempts are not stored as separate rows. The current transport table therefore measures completed logical turns and terminal outcomes, not all wire attempts.

The old `Avg tool duration` label was also misleading. It represented summed tool wall time per stored turn, not average latency per individual tool execution.

## Extension causality

The observed provider remains Pi-native. `pi-zai` does not replace the provider or transport. In default observe mode it also leaves the thinking payload unchanged.

However, version 0.5.3 injected a `pi-zai/<version>` User-Agent and `Accept-Language` header. Public cross-client reports indicate that Z.AI may route or throttle differently based on client identity. That does not prove the header caused these incidents, especially because similar complaints occur across clients and networks, but it makes the mutation inappropriate for a supposedly native observe baseline.

The fix suppresses only those extension-added identity values while preserving:

- Pi-native headers;
- user-supplied headers;
- the opt-in experimental `X-Session-Id` affinity header.

## Benchmark defects corrected

1. A0 instructed users to disable the extension and then run extension-only commands. A0 is now explicitly an external native-Pi control.
2. A3 previously combined A2 safe prompt normalization with affinity and compared that bundle against A1. A3 now equals A1 plus affinity only.
3. A fixed 5-percentage-point cache-hit gate is impossible when A1 already reaches 98–99%. The gate now uses relative miss-rate reduction.
4. Transport and tool labels now match the actual stored quantities.
5. `/zai-usage` now separates per-token rates from total session cost contribution.

## Max-plan verdict

The subscription page's `20× Lite usage` is a quota statement, not an availability statement. The authenticated monitor showing only 18% of the five-hour allowance used rules out simple quota exhaustion for the observed connection failures.

The phrase `dedicated resources during peak times` is not accompanied by a public SLA, minimum success rate, queue-time target, reserved concurrency number, or incident-credit policy. The usage policy simultaneously says limits are dynamically adjusted based on resource availability.

A fair conclusion is:

> Max likely receives preferential allocation relative to lower tiers, but the public evidence and observed failures do not support interpreting “dedicated resources” as guaranteed, isolated, or reliably available capacity.

## Required provider disclosure

To make the Max claim technically auditable, Z.AI should publish or expose per account:

- assigned concurrency by model and time window;
- queue time separately from prefill and generation time;
- terminal and recovered retry rates;
- error codes without collapsing overload, quota, routing, and connection resets;
- whether client identity affects routing or throttling;
- a concrete definition of `dedicated resources`;
- an availability or successful-request target for Max during peak hours.
