# Security

## Credential handling

- API keys resolve through Pi's `ModelRegistry`, environment variables, `auth.json`, and `models.json` command providers.
- The extension **never prints key values** in commands, logs, or diagnostics.
- `/zai` and `/zai-doctor` show credential **source names** only (for example `ZAI_PLATFORM_API_KEY`, `auth.json`).

## Resolution priority (Platform)

1. `ZAI_PLATFORM_API_KEY`
2. `ZAI_API_KEY`
3. Pi stored / runtime / models.json sources

`OPENAI_API_KEY` is never used for Z.AI.

## Network probes

`/zai-doctor` optional live probe calls `${baseUrl}/models` with configured auth headers. Response status is shown; response bodies and secrets are not logged.

## Prompt fingerprinting

System-prompt fingerprints:

- canonicalize whitespace and strip known volatile patterns
- never write raw prompt text to output
- expose only short hashes in `/zai` and `/zai-cache`

## Local credential files

If you store keys in `~/.config/zai/credentials.env`:

```bash
chmod 700 ~/.config/zai
chmod 600 ~/.config/zai/credentials.env
```

Never commit credential files. Rotate keys if exposed in chat, logs, or screenshots.

## Preserve thinking warning

Enabling `preserveThinking` replays historical reasoning content in API requests. This increases data sent to Z.AI and may include sensitive intermediate reasoning. Keep disabled unless required.
