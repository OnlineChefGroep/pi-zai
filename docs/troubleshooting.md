# Troubleshooting

## `/zai-doctor` network probe fails

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| `No credentials` | Key not in env or auth store | Set `ZAI_PLATFORM_API_KEY` or configure Pi auth |
| HTTP 401 | Invalid or rotated key | Update credentials |
| HTTP 403 | Region or product restriction | Try Platform vs Coding endpoint |
| Connection drop on Coding Plan | Network path to `/coding/` endpoint | Use Platform; check VPN/firewall |
| Timeout | Slow network | Retry; check `curl` to base URL |

## Low cache hit ratio

1. Run `/zai-cache status` and read recommendations.
2. Move volatile content below `--- dynamic context ---`.
3. Avoid changing tools or system prompt mid-session.
4. Stay on one endpoint and model.
5. Confirm `clear_thinking` is true (default) — preserved thinking hurts cache.

## `clear_thinking` not true

Check `/zai`:

- `Preserved thinking: enabled` disables cost-first mode
- Disable via settings or unset `PI_ZAI_PRESERVE_THINKING`

## Extension not loading

- Pi version must be **>= 0.80.0**
- Run `/reload` after install
- Check Pi extension errors on startup

## Platform cost shows `$0.00`

Coding Plan sessions always show `subscription-managed`. Switch to `zai-platform` for metered estimates.

## Coding Plan vs Platform confusion

`/zai` shows the active endpoint from the **selected model's provider**, not a separate toggle. Use `/zai-endpoint` or Pi model picker.

## Pi version too old

```bash
pi --version
```

If below 0.80.0, upgrade Pi before installing this extension.
