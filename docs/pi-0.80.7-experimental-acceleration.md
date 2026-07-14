# Experimental Pi 0.80.7 Acceleration Track for Z.AI

**Status:** implementation proposal  
**Target:** `pi-zai` 0.5.x experimental lane  
**Default state:** disabled  
**Principle:** add capabilities without overriding Pi's built-in `zai` provider

## Objective

Do more than merely remain compatible with Pi 0.80.7. Build an opt-in acceleration layer that uses Pi's new dynamic-tool plumbing and existing provider hooks to reduce the initial tool-schema payload, improve cache stability, and expose controlled Z.AI request policies.

This is possible, but the implementation must respect one upstream limitation: Z.AI's documented function-calling API currently says `tool_choice` supports only `auto`. Therefore, `required` or named-tool forcing may be probed experimentally, but cannot be a production dependency until a live contract test proves support.

## What can be implemented now

### 1. Adaptive tool loading for Z.AI

Create one small, stable loader tool and keep selected tool groups inactive at session start.

Flow:

```text
initial request
  -> small stable core toolset + zai_load_tools
  -> model calls zai_load_tools
  -> loader selects and activates a configured tool group
  -> Pi detects tools activated during execution
  -> Pi records addedToolNames on the tool result
  -> next model request contains the newly active tools
  -> pi-zai rotates its cache segment exactly once
```

Pi 0.80.7 already provides the required primitives:

- `pi.getActiveTools()`;
- `pi.getAllTools()`;
- `pi.setActiveTools()`;
- automatic `addedToolNames` generation when an extension tool activates tools during execution.

This gives Z.AI application-level deferred loading even though its current `openai-completions` transport does not support Anthropic/OpenAI Responses native deferred tool definitions.

### 2. Deterministic local tool selection

The loader must not make an additional LLM request. Tool groups can be selected using:

- explicit configured groups;
- deterministic keyword/BM25 matching over local tool metadata;
- previously used tools in the current session;
- project/cwd rules;
- an allowlist of always-active core tools.

No prompt, source code, tool arguments, or tool results leave the machine.

Suggested configuration:

```json
{
  "zai": {
    "adaptiveTools": {
      "mode": "off",
      "maxInitialTools": 8,
      "stickyLoadedTools": true,
      "alwaysActive": ["read", "grep", "find", "ls", "zai_load_tools"],
      "groups": {
        "git": ["git_status", "git_diff", "git_commit"],
        "database": ["db_schema", "db_query"],
        "deploy": ["deploy_status", "deploy_release"]
      }
    }
  }
}
```

Modes:

- `off`: current Pi behavior;
- `observe`: calculate recommendations and cache impact without changing active tools;
- `manual`: loader activates only an explicitly requested group;
- `adaptive`: local deterministic ranking chooses candidate groups;
- `strict`: only allowlisted core tools start active; loader is required to expand capabilities.

`strict` is experimental and must never be the default.

### 3. A Z.AI tool-policy hook

Use `before_provider_request` to inspect and, only when explicitly configured, rewrite the serialized Z.AI Chat Completions payload.

Supported production policy:

- `auto`: preserve Z.AI's documented behavior;
- `none`: candidate only after a live capability test;
- `required`: laboratory probe only;
- named tool: laboratory probe only.

The official Z.AI documentation currently states that `tool_choice` only supports `auto`. Consequently:

- production defaults must leave `tool_choice` unchanged or set it to `auto`;
- unsupported values must never be silently shipped;
- a probe returning a 4xx, ignored behavior, or inconsistent output disables the capability;
- the result is cached by provider/model/version, never globally assumed.

### 4. Capability probes

Add an opt-in command:

```text
/zai-capabilities probe
```

It runs minimal, controlled requests to verify:

- `tool_choice=none`;
- `tool_choice=required`;
- named function choice;
- unknown/deferred tool fields;
- `X-Session-Id` handling;
- `tool_stream=true`;
- cache-token reporting.

Rules:

- never run automatically;
- show expected request count and potential billing before execution;
- use synthetic tools and prompts only;
- store only boolean/result metadata and status codes;
- do not store response text or reasoning;
- expire results when model, endpoint, Pi version, or extension version changes.

### 5. Separate optimized provider lane

Register an optional provider named `zai-optimized` or `zai-labs`, never override `zai` or `zai-coding-cn`.

This provider may use a custom `streamSimple` wrapper to apply verified options consistently:

- stable session ID;
- cache-retention policy;
- tool-stream policy;
- validated tool-choice capability;
- request/response diagnostics;
- controlled model metadata.

Activation must be explicit through model selection. Removing the extension must restore normal Pi behavior immediately because the native provider remains untouched.

This lane is appropriate for experiments that cannot be expressed safely through request/header hooks alone.

## What cannot be safely forced today

### Native provider-side deferred tool definitions

Pi's native deferred loading uses provider-specific protocols:

- Anthropic `defer_loading` and `tool_reference` blocks;
- OpenAI Responses `tool_search_call` and `tool_search_output` items.

Z.AI currently exposes an OpenAI-compatible Chat Completions API. Its public documentation describes normal `tools`, `tool_choice=auto`, `tool_calls`, and `tool_stream=true`, but does not document deferred definitions or tool-reference messages.

Injecting Anthropic/OpenAI Responses fields into production Z.AI requests would be protocol guessing. It may be tested in the capability probe, but must not be enabled without positive endpoint evidence.

### Guaranteed forced named tool calls

Although Pi's low-level OpenAI Completions type can represent `auto`, `none`, `required`, and named function choices, Z.AI documents only `auto`. A payload rewrite is technically possible; guaranteed provider behavior is not.

### Transparent proxying of arbitrary Pi tools

`pi.getAllTools()` exposes metadata, not arbitrary execution functions. `pi-zai` can activate existing tools, but cannot safely become a universal proxy that executes every other extension's tool internally. A generic `zai_tool_invoke` gateway would require a new execution contract or explicit cooperation over Pi's event bus.

## Recommended implementation order

### Experiment A — dynamic activation proof

- register `zai_load_tools`;
- create two synthetic tool groups;
- start with one group inactive;
- activate it inside the loader execution;
- verify Pi emits `addedToolNames`;
- verify the next Z.AI request contains the new definitions;
- verify `pi-zai` creates one new cache segment;
- measure cached-token and latency changes.

Success criterion: no functional regression and materially smaller initial tool payload.

### Experiment B — local adaptive selection

- implement deterministic ranking;
- run against captured metadata fixtures, not live user prompts in CI;
- evaluate recall of required tools across a benchmark task set;
- guarantee always-active recovery via the loader;
- compare initial token count, first-token latency, tool success, and total turns.

Success criterion: at least 95% required-tool recall with lower initial schema tokens and no unrecoverable missing-tool case.

### Experiment C — tool-choice capability probe

Test `auto`, `none`, `required`, and named selection against each supported Z.AI model/endpoint.

Success criterion for enabling a value:

- accepted consistently;
- semantically obeyed;
- works in streaming and non-streaming modes;
- works with thinking enabled;
- no malformed tool-call deltas;
- repeatable across at least 20 controlled trials.

Until then, only `auto` is supported.

### Experiment D — optimized provider

Build only after A-C have stable evidence. The custom provider must be opt-in and pass differential tests against native Pi:

- identical text/tool semantics;
- identical thinking replay;
- identical usage accounting;
- equal or better cache/latency;
- no additional credential surface;
- clean unregister/rollback.

## Metrics

Track locally:

- initial active tool count;
- initial serialized tool-schema bytes;
- loaded tool count per turn;
- loader invocations;
- missing-tool recovery rate;
- cache read tokens and ratio;
- time to first token;
- time to first tool call;
- total tool turns;
- task success;
- capability-probe results.

Never persist raw prompts, tool names outside explicitly user-authored configuration, tool schemas, arguments, results, reasoning content, session IDs, or credentials.

## Safety and rollback

- all acceleration modes default to `off`;
- unknown capability results fail back to native Pi behavior;
- the native provider is never overwritten;
- loader failure reactivates the original toolset;
- adaptive selection always retains a recovery loader;
- capability probes are explicit and synthetic;
- one setting disables the full experimental lane;
- removing `pi-zai` leaves sessions and native Pi providers usable.

## Decision

Implement the compatibility plan and the experimental acceleration lane in parallel, but release them differently:

- `0.5.0`: Pi 0.80.7 baseline, correct dynamic-tool cache segmentation, capability diagnostics;
- `0.5.x` experimental: adaptive loader in `observe`/`manual` modes;
- later minor release: `adaptive` mode after benchmark evidence;
- separate prerelease tag: optional `zai-labs` provider and unsupported-field probes.

This produces actual new capability rather than merely mirroring upstream, without making the stable extension depend on undocumented Z.AI behavior.
