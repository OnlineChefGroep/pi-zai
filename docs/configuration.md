# Configuration

## Settings file

Project: `.pi/settings.json`  
Global: `~/.pi/agent/settings.json` (via Pi `getAgentDir()`)

```json
{
  "zai": {
    "preserveThinking": false
  }
}
```

Project settings override global settings.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `ZAI_PLATFORM_API_KEY` | Platform API key (preferred on `zai-platform`) |
| `ZAI_API_KEY` | Coding Plan key; Platform fallback |
| `ZAI_CODING_CN_API_KEY` | Coding Plan CN key |
| `PI_ZAI_PRESERVE_THINKING` | `1`/`true`/`yes` to enable preserved thinking |

`PI_ZAI_PRESERVE_THINKING` overrides settings file when set.

`OPENAI_API_KEY` is never used for Z.AI resolution.

## Platform model catalog

Registered by this extension on `zai-platform`:

| Model | Context | Notes |
|-------|---------|-------|
| `glm-5.2` | 1M | Native `off`/`high`/`max` thinking |
| `glm-5.1` | 200K | Tool streaming |
| `glm-5` | 200K | |
| `glm-5-turbo` | 200K | |
| `glm-4.7` | 204.8K | |
| `glm-4.7-flashx` | 200K | |
| `glm-4.5-air` | 131K | |

Pricing metadata follows [Z.AI pricing docs](https://docs.z.ai/guides/overview/pricing.md) (USD per 1M tokens).

## Reload behavior

On `/reload`, the extension:

1. reloads `zai` settings from disk
2. re-syncs provider registration (preserve thinking overrides)
3. keeps cache metrics unless a new session starts

## Session lifecycle hooks

| Hook | Behavior |
|------|----------|
| `session_start` | Init state; reset cache on new session |
| `model_select` | Update endpoint and credential source |
| `before_agent_start` | Update cache segment fingerprints |
| `turn_end` | Record usage metrics |
| `session_before_compact` | Inject Z.AI compaction instructions |
| `session_before_tree` | Inject Z.AI branch summary instructions |
| `session_compact` | Mark compaction timestamp |
| `before_provider_request` | Enforce `clear_thinking` when cost-first |
