# Pi 0.80.7 Integration and Upstream Provider Adoption Plan

**Repository:** `OnlineChefGroep/pi-zai`  
**Document status:** implementation-ready  
**Target release:** `@onlinechefgroep/pi-zai@0.5.0`  
**Upstream baseline:** Pi `0.80.7`  
**Last updated:** 2026-07-14

## 1. Executive summary

Pi 0.80.7 introduces three provider/runtime changes relevant to `pi-zai`:

1. cache-friendly dynamic tool loading through message-anchored `addedToolNames`;
2. structured session-affinity compatibility through `compat.sessionAffinityFormat`;
3. `toolChoice` support for OpenAI and Codex Responses.

The correct migration is **not** to reimplement these features inside `pi-zai`. Pi remains the owner of providers, tools, requests, sessions, streaming, thinking, and retries. `pi-zai` should become fully aware of the new upstream capabilities, preserve them without mutation, and improve its Z.AI-specific cache diagnostics around them.

The most important technical detail is that Pi 0.80.7 still routes its native Z.AI models through `openai-completions`. Native deferred tool definitions are currently implemented for Anthropic and OpenAI Responses, not for OpenAI Completions. Therefore, when another extension activates tools dynamically, the next Z.AI request receives the changed active tool list and the effective cached prefix can change. `pi-zai` must detect that toolset transition at the provider-request boundary and start a new cache segment before recording subsequent usage.

This plan also resolves four current repository issues discovered during the audit:

- Pi development dependencies are still pinned to `0.80.6`;
- `src/index.ts` reports the extension version as `0.3.0`, while the package is `0.4.1`;
- cache toolset fingerprints are captured only in `before_agent_start`, which is too early for dynamically activated tools;
- `isNativeZaiModel()` currently also classifies `zai-platform` as native, obscuring the boundary between Pi-owned and optional custom providers.

## 2. Non-negotiable architecture boundaries

The implementation must preserve the following invariants.

- Pi owns the agent loop, provider registry, model selection, tool execution, transcript, retries, streaming, compaction, and thinking level.
- `pi-zai` does not replace or proxy Pi's built-in `zai` or `zai-coding-cn` providers.
- `zai-platform` remains opt-in and is not automatically registered during this migration.
- No extension-owned thinking selector, `/zai-thinking` command, or duplicate reasoning state.
- No additional model request is made for diagnostics, benchmarking, telemetry, or capability detection.
- Prompt text, source code, reasoning content, tool arguments, tool results, tool schemas, raw tool names, API keys, and session-affinity identifiers are never uploaded.
- New dynamic-tool measurements are local-only in `0.5.0`; the remote aggregate telemetry schema is unchanged.
- The Pi host remains an optional peer dependency so standalone package installation cannot provision Pi's complete dependency tree.
- No dummy loader tool is added merely to claim support for Pi 0.80.7.

## 3. Upstream delta and required response

| Pi 0.80.7 change | Upstream behavior | Direct Z.AI impact | `pi-zai` action |
|---|---|---|---|
| Dynamic tool loading | `ToolResultMessage.addedToolNames` anchors tools introduced during execution. Anthropic and OpenAI Responses can defer definitions. | Native Z.AI currently uses `openai-completions`, so changed active tools still alter the request tool list and may invalidate the cached prefix. | Recompute the effective toolset at every provider request, classify additive/removal/schema changes, and rotate the cache segment before usage is recorded. |
| `compat.sessionAffinityFormat` | Replaces the removed OpenAI Responses `sendSessionIdHeader` flag with `openai`, `openai-nosession`, or `openrouter`. | The current Z.AI integration manually injects `X-Session-Id` only in experimental mode. It must not accidentally duplicate or impersonate OpenAI/OpenRouter affinity behavior. | Add explicit capability/policy resolution, case-insensitive duplicate protection, exact diagnostics, and regression tests. Keep the default off. |
| OpenAI/Codex Responses `toolChoice` | Supports automatic, required, and named tool selection. | Native Z.AI is not an OpenAI Responses provider, but generic request fields must survive `before_provider_request` unchanged. | Add pass-through contract tests proving the thinking normalizer modifies only `thinking.clear_thinking`. Do not advertise unsupported Z.AI behavior. |
| Fable 5 `xhigh` and `max` | Provider catalog update for Claude Fable 5. | None. | No code change. Record as intentionally out of scope. |
| OpenRouter context/session fixes | Correct context window and `x-session-id` semantics for OpenRouter. | Relevant as a warning against provider-name heuristics and generic raw-header injection. | Resolve capabilities from `model.api` and `model.compat`, while retaining a narrowly scoped Z.AI policy. |

## 4. Current-state audit

### 4.1 Dependency baseline

Current package state:

- `@earendil-works/pi-agent-core`: `0.80.6`
- `@earendil-works/pi-ai`: `0.80.6`
- `@earendil-works/pi-coding-agent`: `0.80.6`
- optional peer floor: `@earendil-works/pi-coding-agent >=0.80.0`

Required state:

- development and lockfile baseline on exactly `0.80.7`;
- optional peer floor raised to `>=0.80.7` for the `0.5.0` release;
- CI validates the exact minimum and the newest compatible Pi release independently;
- consumer-install isolation remains mandatory.

### 4.2 Version drift

`package.json` is `0.4.1`, but `src/index.ts` contains:

```ts
const EXTENSION_VERSION = "0.3.0";
```

This corrupts status output, User-Agent metadata, local records, and telemetry release attribution. A single source of truth is a release blocker.

### 4.3 Toolset fingerprint timing

The current flow computes the tool fingerprint in `before_agent_start`:

```text
before_agent_start
  -> getActiveTools()
  -> getAllTools()
  -> updateCacheSegment(...)
```

That snapshot becomes stale when any extension activates tools during a tool execution. The authoritative snapshot must be taken immediately before every provider request.

### 4.4 Provider boundary ambiguity

The provider set currently contains:

```text
zai
zai-coding-cn
zai-platform
```

`isNativeZaiModel()` delegates to this complete set, even though only the first two are Pi-native providers. This should be split into explicit predicates:

- `isPiNativeZaiProvider()` — `zai`, `zai-coding-cn`;
- `isZaiPlatformProvider()` — `zai-platform`;
- `isManagedZaiProvider()` — union used for shared diagnostics;
- `usesZaiThinkingFormat()` — capability-based request-mutation eligibility.

### 4.5 Session-affinity behavior

Current behavior:

```text
sessionAffinity=experimental
  -> before_provider_headers
  -> add X-Session-Id
```

The setting is off by default, which is correct. Missing safeguards:

- case-insensitive detection of an existing upstream header;
- visibility into whether a header came from Pi, a model, or `pi-zai`;
- an explicit distinction between Z.AI's header and Pi's OpenAI/OpenRouter formats;
- tests proving the identifier is never persisted or uploaded;
- a live contract test against the Coding Plan endpoint.

### 4.6 Platform catalog drift

`buildPlatformModelCatalog()` duplicates model metadata that can diverge from Pi's native Z.AI catalog. Pi 0.80.7 includes native `glm-5v-turbo`, while the optional platform catalog does not. The migration must reduce duplication and add a contract check rather than blindly copying every native model to the metered Platform endpoint.

## 5. Target architecture

```text
Pi model + runtime state
        |
        v
resolveZaiCapabilities(model)
        |
        +--> provider ownership: native / platform / other
        +--> API family: openai-completions / responses / custom
        +--> thinking format and level mapping
        +--> tool loading mode: deferred / full-list fallback
        +--> session-affinity policy
        |
        v
provider request boundary
        |
        +--> snapshot effective active toolset
        +--> compare stable fingerprints
        +--> rotate cache segment when required
        +--> apply explicit thinking override only
        +--> apply narrowly scoped headers without duplicates
        |
        v
Pi sends the original upstream request
        |
        v
local-only operational metrics and diagnostics
```

The central design change is a capability layer. Provider names remain useful identifiers, but request behavior must be decided from the active model's API and compatibility metadata whenever Pi exposes it.

## 6. Workstream A — establish the Pi 0.80.7 baseline

### A1. Upgrade dependencies

- [ ] Set all three Pi development packages to `0.80.7`.
- [ ] Regenerate `package-lock.json` without unrelated dependency churn.
- [ ] Raise the optional peer floor to `>=0.80.7`.
- [ ] Confirm `npm install @onlinechefgroep/pi-zai` still installs zero runtime dependencies in an empty consumer project.
- [ ] Confirm Pi package removal remains functional with the optional peer declaration.

### A2. Create a version single source of truth

Preferred implementation:

- generate `src/version.generated.ts` from `package.json` before build;
- add `npm run check:version` that fails when generated and package versions differ;
- use the generated constant for commands, User-Agent, SQLite records, telemetry metadata, and reports;
- run the check in CI and `prepublishOnly`.

Do not maintain a second handwritten version literal.

### A3. Add a compatibility matrix

CI lanes:

| Lane | Purpose |
|---|---|
| `pi-minimum` | Exact Pi `0.80.7`; proves the declared peer floor. |
| `pi-latest` | Latest compatible Pi packages; detects upstream drift early. |
| `package-consumer` | Packed extension in a clean project; proves host isolation. |
| `node-22` | Supported minimum Node line. |
| `node-current` | Early runtime compatibility signal. |

The latest lane may be non-blocking only when upstream has published a newer semver line that intentionally requires migration. The exact minimum lane is always blocking.

## 7. Workstream B — introduce explicit Z.AI capability resolution

### B1. Add `src/capabilities.ts`

Define one normalized result used by hooks, commands, and tests:

```ts
interface ZaiCapabilities {
  providerOwnership: "pi-native" | "platform" | "other";
  apiFamily: string;
  usesZaiThinkingFormat: boolean;
  streamsToolCalls: boolean;
  dynamicToolMode: "deferred" | "full-list-fallback";
  sessionAffinitySource: "none" | "pi" | "pi-zai";
  sessionAffinityFormat?: string;
}
```

Rules:

- Pi-native ownership is based on `zai` and `zai-coding-cn` only.
- Platform ownership is based on `zai-platform` only.
- Dynamic tool mode is inferred from API/compatibility support, not from a hardcoded marketing claim.
- Native Z.AI on `openai-completions` resolves to `full-list-fallback` in Pi 0.80.7.
- Unknown fields fail closed and preserve Pi's behavior.

### B2. Replace overloaded predicates

- [ ] Make `isNativeZaiModel()` mean Pi-native only.
- [ ] Add a separate predicate for all managed Z.AI endpoints.
- [ ] Audit every hook and command to select the narrowest predicate.
- [ ] Ensure no hook accidentally changes non-Z.AI OpenAI-compatible providers.

### B3. Add capability fixtures

Fixtures must cover:

- native `zai/glm-5.2`;
- native `zai-coding-cn/glm-5.2`;
- manual `zai-platform/glm-5.2`;
- native `zai/glm-5v-turbo`;
- unrelated OpenAI Responses model with tool search;
- unrelated Anthropic model with tool references;
- unknown custom OpenAI-compatible model.

## 8. Workstream C — make cache segmentation correct for dynamic tools

### C1. Extract canonical toolset capture

Add a pure helper that:

- obtains the current active tool names from Pi;
- joins them to registered definitions;
- sorts deterministically;
- fingerprints name, description, and parameter schema without persisting raw content;
- returns count, fingerprint, and a privacy-safe change classification.

The fingerprint implementation must remain stable across object key ordering.

### C2. Move the authoritative check to `before_provider_request`

Required sequence:

```text
before_agent_start
  -> capture initial prompt and toolset segment

before_provider_request
  -> recapture current active toolset
  -> detect changes since the previous provider request
  -> rotate segment before request usage can be attributed
  -> arm request/attempt tracking
  -> apply explicit thinking override only
```

This catches tools activated by any extension, not only tools owned by `pi-zai`.

### C3. Classify toolset transitions

Local classifications:

- `unchanged`;
- `tools-added`;
- `tools-removed`;
- `tool-schema-changed`;
- `tool-description-changed`;
- `toolset-reordered-only` — must normalize to unchanged;
- `unknown-change`.

For Pi 0.80.7 Z.AI requests, every material transition starts a new cache segment because Z.AI receives the full active tool list.

### C4. Record privacy-safe local diagnostics

Allowed local fields:

- previous and next fingerprints;
- previous and next tool counts;
- added/removed counts;
- transition classification;
- active API family;
- whether native deferred loading was available.

Forbidden fields:

- tool names;
- tool descriptions;
- JSON schemas;
- tool arguments/results;
- prompt text.

Do not add these fields to remote aggregate telemetry in `0.5.0`.

### C5. Add integration tests

Required scenarios:

1. stable toolset across multiple requests keeps one segment;
2. a loader tool activates one tool during execution and the next request rotates the segment;
3. multiple tools are activated additively in one result;
4. a tool is removed between requests;
5. schema changes under the same tool name rotate the segment;
6. object-key reordering does not rotate the segment;
7. an unrelated provider with native deferred tools is not falsely reported as a Z.AI cache miss;
8. no raw tool metadata reaches storage or telemetry previews.

## 9. Workstream D — align session affinity with Pi 0.80.7

### D1. Preserve the default-off policy

No session-affinity identifier is sent unless the user explicitly enables the experimental Z.AI mode. `observe` may inspect effective behavior but must not add headers.

### D2. Add an explicit policy resolver

The resolver must distinguish:

- Pi's `sessionAffinityFormat: openai`;
- Pi's `sessionAffinityFormat: openai-nosession`;
- Pi's `sessionAffinityFormat: openrouter`;
- `pi-zai`'s explicitly enabled Z.AI `X-Session-Id` behavior.

Do not map Z.AI to an OpenAI or OpenRouter format merely because the transport is OpenAI-compatible.

### D3. Prevent duplicate or conflicting headers

Before adding `X-Session-Id`:

- normalize header names case-insensitively;
- leave an existing upstream value untouched;
- never add OpenAI `session_id`, `x-client-request-id`, or `x-session-affinity` as a substitute;
- record only the source and enabled/disabled state, never the identifier.

### D4. Maintain backward-compatible settings

Keep the existing values for `zai.sessionAffinity` in `0.5.0`:

```json
{
  "zai": {
    "sessionAffinity": "off"
  }
}
```

Semantics:

| Value | Behavior |
|---|---|
| `off` | No inspection beyond normal diagnostics; no injected header. |
| `observe` | Report the effective upstream affinity policy without changing the request. |
| `experimental` | Add only the verified Z.AI `X-Session-Id` header when Pi has not already supplied it. |

A future structured setting can be introduced only if Z.AI exposes multiple documented formats.

### D5. Live validation gate

A controlled live test must verify:

- the exact outbound header set with `off`, `observe`, and `experimental`;
- no duplicate headers;
- no authentication or response behavior regression;
- improved or neutral cache behavior over repeated stable requests;
- the identifier does not appear in logs, exports, SQLite, telemetry preview, or uploaded aggregates.

The live test is opt-in and never runs in public CI.

## 10. Workstream E — preserve new upstream request fields

### E1. Strengthen the payload normalizer contract

`normalizeZaiThinkingPayload()` may modify only:

```text
thinking.clear_thinking
```

It must preserve by identity/value:

- `tools`;
- `tool_choice`;
- `tool_stream`;
- messages and any message-anchored metadata;
- image content;
- model and token limits;
- unknown future provider fields;
- all other thinking properties.

### E2. Add property and fixture tests

- [ ] Undefined `preserveThinking` returns no payload replacement.
- [ ] Explicit true/false changes only `clear_thinking`.
- [ ] Required and named `tool_choice` values survive.
- [ ] Large nested tool schemas survive without cloning loss.
- [ ] Unknown fields survive.
- [ ] Invalid/non-object payloads fail open without throwing.
- [ ] Original payload objects are never mutated in place.

### E3. Do not overclaim `toolChoice`

Pi 0.80.7's new `toolChoice` support applies to OpenAI and Codex Responses. Documentation and `/zai-doctor` must report the active API's actual support. `pi-zai` must not present this as a new guaranteed Z.AI capability without a verified Z.AI contract.

## 11. Workstream F — synchronize model metadata without taking ownership

### F1. Use Pi's active model as the runtime source of truth

For built-in `zai` and `zai-coding-cn`:

- read model ID, API, context window, max tokens, input modalities, reasoning flag, thinking map, and compatibility metadata from `ctx.model`;
- do not shadow the native catalog in extension state;
- do not re-register or patch built-in providers.

### F2. Add an installed-Pi catalog contract test

At test time, resolve Pi's built-in models and validate assumptions used by `pi-zai`, including:

- `glm-5.2` uses `openai-completions`;
- `thinkingFormat` is `zai`;
- `zaiToolStream` is enabled where expected;
- the GLM-5.2 thinking map remains compatible;
- `glm-5v-turbo` is recognized as text+image;
- context and output limits are read rather than duplicated.

When upstream changes an assumption, CI should fail with a targeted message naming the changed capability.

### F3. Keep Platform API opt-in

`buildPlatformModelCatalog()` remains an exported helper for manual configuration. It must not auto-register `zai-platform`.

Before adding `glm-5v-turbo` or another native model to the Platform catalog, verify all of the following against Z.AI's Platform documentation:

- model is available on the metered endpoint;
- input modalities match;
- context and output limits match;
- thinking format matches;
- tool streaming is supported;
- pricing and cache pricing are current.

Native Coding Plan availability alone is insufficient evidence.

### F4. Reduce duplicated metadata

Add one of these contract-safe approaches:

1. derive shared model metadata from installed Pi exports when a stable public export exists; or
2. retain the explicit Platform catalog but compare overlapping fields against Pi fixtures in tests.

Do not import private source paths from Pi packages in production code.

## 12. Workstream G — improve diagnostics and operator visibility

### G1. `/zai-doctor`

Add a Pi 0.80.7 compatibility section:

```text
Pi compatibility
  Pi version: 0.80.7
  Provider ownership: Pi native
  API family: openai-completions
  Dynamic tools: full-list fallback
  Toolset tracking: provider-request boundary
  Session affinity: off / observe / experimental
  Affinity source: none / Pi / pi-zai
  Thinking mutation: native unchanged / explicit override
  Tool choice: active API capability
```

Warnings:

- Pi version below the supported floor;
- stale or unknown capability metadata;
- duplicate session-affinity headers;
- dynamically changed tools without a new segment;
- extension/package version drift;
- unexpected provider registration conflicts.

### G2. `/zai` status

Add concise local state:

- active API family;
- active tool count;
- toolset generation number;
- last toolset transition classification;
- current cache segment age/request count;
- whether dynamic tool loading is deferred or full-list fallback.

Do not display raw tool names by default.

### G3. `/zai-cache`

Explain why a segment changed:

```text
Segment reset: active toolset changed after a tool result
Mode: full-list fallback (Z.AI / openai-completions)
Tools: 5 -> 8
```

This should distinguish tool transitions from model, endpoint, system-prompt, compaction, and explicit reset boundaries.

## 13. Workstream H — documentation and migration guidance

Update:

- [ ] `README.md` — supported Pi baseline and inherited 0.80.7 behavior;
- [ ] `docs/architecture.md` — capability layer and request-boundary flow;
- [ ] `docs/cache-optimization.md` — dynamic tool behavior for Z.AI fallback;
- [ ] `docs/configuration.md` — session-affinity semantics and compatibility floor;
- [ ] `docs/commands.md` — new doctor/status fields;
- [ ] `docs/security.md` — dynamic-tool privacy boundary and affinity identifier handling;
- [ ] `docs/troubleshooting.md` — stale cache segment, duplicate header, and unsupported Pi version cases;
- [ ] `docs/development.md` — Pi version matrix and live contract test;
- [ ] `CHANGELOG.md` — explicit migration notes for `0.5.0`.

Documentation must state clearly:

- Pi 0.80.7 dynamic tool loading is inherited;
- native deferred definitions do not currently apply to Z.AI's `openai-completions` path;
- `pi-zai` tracks the resulting cache boundaries but does not own dynamic tools;
- Fable 5 changes are unrelated;
- OpenAI/Codex Responses `toolChoice` is preserved but not relabeled as a Z.AI feature.

## 14. Implementation PR stack

### PR 1 — `chore(pi): establish the 0.80.7 compatibility baseline`

Scope:

- Pi dependency and lockfile upgrade;
- optional peer floor;
- version single source of truth;
- exact-minimum/latest CI lanes;
- package-consumer regression guard.

Merge gate:

- all existing tests green;
- clean consumer installation;
- package and runtime version match.

### PR 2 — `refactor: add Z.AI capability and provider ownership model`

Scope:

- `src/capabilities.ts`;
- native/platform/managed predicate split;
- fixtures for Pi-native, platform, and unrelated providers;
- no behavior change beyond corrected classification.

Merge gate:

- every hook has an explicit ownership/capability predicate;
- built-in providers remain untouched.

### PR 3 — `fix(cache): track dynamic tool transitions at request boundaries`

Scope:

- canonical active-tool capture;
- provider-request recapture;
- segment transition classifications;
- local metrics/status fields;
- cross-extension dynamic-tool integration harness.

Merge gate:

- no missed transition in the full test matrix;
- no raw tool metadata persisted or uploaded.

### PR 4 — `fix(provider): align affinity and payload pass-through with Pi 0.80.7`

Scope:

- session-affinity policy resolver;
- duplicate-header protection;
- thinking normalizer contract tests;
- tool choice and unknown-field preservation;
- doctor diagnostics.

Merge gate:

- default produces byte-equivalent relevant request behavior;
- experimental affinity is narrowly scoped and leak-free.

### PR 5 — `test(docs): synchronize catalogs, live contracts, and 0.5.0 guidance`

Scope:

- installed-Pi model contract tests;
- optional Platform catalog validation;
- documentation updates;
- changelog and release checklist;
- opt-in live Z.AI test script.

Merge gate:

- all acceptance criteria below are evidenced;
- no unverified Platform model metadata is published.

## 15. Test matrix

| Area | Test | Expected result |
|---|---|---|
| Version | Package versus runtime constant | Exact match; no handwritten drift. |
| Host isolation | Install packed tarball in empty project | Pi host tree is absent. |
| Pi minimum | Install/test with `0.80.7` | Green. |
| Pi latest | Install/test with newest compatible release | Green or targeted capability-drift failure. |
| Dynamic tools | Add tool during another tool's execution | Next Z.AI request starts a new segment. |
| Stable tools | Repeated identical requests | Segment remains stable. |
| Reordering | Same tools, different object/key ordering | No segment reset. |
| Schema drift | Same tool name, changed schema | Segment resets. |
| Deferred provider | OpenAI Responses tool search fixture | Capability resolves to deferred; no false Z.AI claim. |
| Payload | `tool_choice=required` plus thinking override | Only `clear_thinking` changes. |
| Unknown fields | Future nested payload fields | Preserved. |
| Affinity off | Normal request | No extension affinity header. |
| Affinity observe | Normal request | Diagnostics only; no header mutation. |
| Affinity experimental | Verified Z.AI request | One `X-Session-Id`, no duplicates. |
| Privacy | Storage/export/telemetry preview | No raw tools or affinity ID. |
| Model contract | Native GLM-5.2 | API/thinking/tool-stream assumptions match installed Pi. |
| Vision model | Native GLM-5V-Turbo | Recognized without extension catalog ownership. |
| Platform boundary | Manual platform fixture | Never mistaken for Pi-native. |

## 16. Release strategy

Release as `0.5.0` because the supported Pi floor changes and cache-segmentation semantics become more precise.

Release sequence:

1. merge the five PRs in order;
2. run blocking CI on `main`;
3. run the opt-in live Z.AI contract suite with affinity off and experimental;
4. inspect `npm pack --dry-run --json`;
5. install the packed artifact into a clean Pi 0.80.7 environment;
6. run `/zai-doctor`, `/zai`, `/zai-cache`, one stable tool workflow, and one dynamic-tool workflow;
7. publish with provenance;
8. verify npm metadata, optional peer behavior, GitHub tag, and release notes;
9. perform one post-publish clean install and smoke test.

## 17. Rollback strategy

Every new behavior must fail open toward Pi-native behavior.

- Capability resolution failure: report unknown and do not mutate the request.
- Toolset capture failure: retain the current segment, mark diagnostics incomplete, and never block the model request.
- Affinity conflict: keep the upstream header and skip extension injection.
- Storage failure: use existing memory/fail-open behavior.
- Live validation regression: release without experimental affinity changes; keep the default off.
- Platform metadata uncertainty: omit the model rather than publish guessed values.

A rollback release must not lower the Pi peer floor unless the code is tested against that older version.

## 18. Definition of done

The migration is complete only when all statements are true.

- [ ] Package, lockfile, tests, and peer metadata target Pi `0.80.7`.
- [ ] No stale hardcoded extension version exists.
- [ ] Native and Platform Z.AI providers have separate ownership predicates.
- [ ] Effective active tools are fingerprinted immediately before every Z.AI provider request.
- [ ] Dynamic tool activation starts a new Z.AI cache segment exactly once.
- [ ] Stable or reordered-equivalent toolsets do not create false resets.
- [ ] Pi 0.80.7 request fields, including `tool_choice` and unknown future fields, survive unchanged.
- [ ] Session-affinity headers are default-off, non-duplicating, provider-correct, and privacy-safe.
- [ ] No built-in Pi provider is registered, replaced, or patched by the extension.
- [ ] No raw prompt, code, reasoning, tool, credential, or affinity data leaves the machine.
- [ ] Native `glm-5v-turbo` is recognized through Pi without duplicated ownership.
- [ ] Platform catalog changes are backed by Z.AI Platform evidence.
- [ ] CI covers exact-minimum Pi, latest Pi, package isolation, capability fixtures, and dynamic tools.
- [ ] Documentation accurately distinguishes inherited Pi features from `pi-zai` functionality.
- [ ] `0.5.0` installs cleanly and passes a real Pi 0.80.7 smoke test.

## 19. Explicitly deferred follow-up

After `0.5.0`, a separate RFC may evaluate first-class opt-in `zai-platform` registration through Pi's provider API. That work must remain disabled by default, must never shadow the native providers, and must have independently verified Platform endpoint metadata, credentials, pricing, and lifecycle behavior.

It is deliberately excluded from the Pi 0.80.7 compatibility release so provider ownership and cache correctness are solved before adding another registration path.

## 20. Upstream references

- [Pi news](https://pi.dev/news)
- [Pi AI changelog 0.80.7](https://github.com/earendil-works/pi/blob/v0.80.7/packages/ai/CHANGELOG.md)
- [Pi coding-agent changelog 0.80.7](https://github.com/earendil-works/pi/blob/v0.80.7/packages/coding-agent/CHANGELOG.md)
- [Dynamic tool loading PR #6474](https://github.com/earendil-works/pi/pull/6474)
- [Session-affinity format PR #6496](https://github.com/earendil-works/pi/pull/6496)
- [OpenAI/Codex tool choice PR #6588](https://github.com/earendil-works/pi/pull/6588)
- [Pi extension documentation](https://github.com/earendil-works/pi/blob/v0.80.7/packages/coding-agent/docs/extensions.md)
- [Pi 0.80.7 Z.AI model catalog](https://github.com/earendil-works/pi/blob/v0.80.7/packages/ai/src/providers/zai.models.ts)
