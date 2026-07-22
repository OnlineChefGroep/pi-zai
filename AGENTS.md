# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is

`@onlinechefgroep/pi-zai` is a **Pi extension** (a TypeScript ESM npm library), not a
standalone server. It hooks into Pi's agent loop to add Z.AI cache visibility,
request diagnostics, and local operator metrics (`/zai`, `/zai-cache`,
`/zai-data`, etc.). There is **no long-running service and no port to open** —
metrics persist to a local SQLite file via Node's built-in `node:sqlite`
(`~/.pi/agent/state/pi-zai/metrics.sqlite3`). A small optional Cloudflare Worker
lives in `worker/telemetry/` (its own `package.json`/lockfile); deploying it is
off by default and requires Cloudflare credentials.

### Node version (non-obvious)

The project requires **Node >= 22.19.0** (uses `node:sqlite`). The base VM's
default `node` (`/exec-daemon/node`) is older (22.14). Setup installs Node 22 via
nvm and symlinks `node`/`npm`/`npx` into `/usr/local/cargo/bin` (first on `PATH`)
so the correct version resolves for every command; the startup update script
re-asserts those symlinks. If `node --version` ever reports < 22.19, re-run:
`ln -sf "$(ls -d "$HOME"/.nvm/versions/node/v22.* | sort -V | tail -1)/bin"/{node,npm,npx} /usr/local/cargo/bin/`.

### Commands

Standard scripts (see `package.json` and `.github/workflows/ci.yml`):
`npm run lint` (Biome), `npm run build` (tsc → `dist/`), `npm test` (Vitest),
`npm run check:version`, `npm run check:package`, `npm run check:consumer-install`.
Worker: `npm run check --prefix worker/telemetry` (tsc `--noEmit`).
Tests are fully mock-based — no network, no LLM, no external services.

### Running / manually testing the extension

Full manual E2E inside a live Pi session needs a Z.AI model + credentials
(`ZAI_API_KEY` or `/login`) and an interactive TUI, so `pi -p` (print mode) will
hang waiting on a model provider when no key is configured. To exercise core
functionality without credentials, drive the extension against Pi's
`ExtensionAPI` the way `src/boundary.test.ts` does (via
`test/mock-extension-api.ts`): activate `piZaiExtension(pi)`, fire the
`session_start` → `turn_end` hooks to record a metric to SQLite, then invoke the
`/zai-data` command handler to read it back. Query commands **before**
`session_shutdown`, which tears down the metrics store.

Gotcha: `createMockExtensionApi().registerCommand` only records command *names*
(for assertion), not handlers. To call `/zai-data` (or any command) from a
one-off script, wrap `registerCommand` before `piZaiExtension(pi)` and stash
`options.handler`. Also stub `ctx.sessionManager.getEntries()` (return `[]`) if
you invoke `/zai`, which iterates session entries.

### Optional / gated

- Live cache-affinity benchmark (`npm run benchmark:cache-affinity`) needs a real
  `ZAI_API_KEY` and network.
- Telemetry worker deploy needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
