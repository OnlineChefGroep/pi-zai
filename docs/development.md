# Development

Contributor and maintainer workflow. End users can skip this page.

## Repository layout

```text
packages/pi-zai/
  src/           Extension source (TypeScript, strip-only)
  dist/          Build output (published to npm)
  docs/          User and operator documentation
  worker/        Cloudflare Worker ingest (telemetry)
  scripts/       Live benchmarks (cache-affinity A/B)
  test/          Vitest unit tests (*.test.ts next to modules)
```

Monorepo path: `earendil-works/pi-mono` → `packages/pi-zai`.  
Standalone mirror (source of truth for releases): [OnlineChefGroep/pi-zai](https://github.com/OnlineChefGroep/pi-zai).

The monorepo copy is kept for Pi integration tests (`packages/coding-agent/test/suite/regressions/`). Ship user-facing changes to the standalone repo; do not rely on pushing the monorepo fork for releases.

## Requirements

- Node **>= 22.19.0**
- Pi packages **>= 0.80.0** (`@earendil-works/pi-coding-agent` as devDependency for tests)

## Build and test

```bash
cd packages/pi-zai
npm run clean && npm run build
npm test
bash scripts/check-secrets.sh
```

From monorepo root after code changes:

```bash
npm run check
```

Integration regression (coding-agent harness):

```bash
cd packages/coding-agent
node ../../node_modules/vitest/dist/cli.js --run \
  test/suite/regressions/pi-zai-extension-integration.test.ts
```

## Local install in Pi

```bash
cd packages/pi-zai
npm run build
pi install file:/absolute/path/to/packages/pi-zai
/reload
```

Project settings example (`.pi/settings.json`):

```json
{
  "zai": {
    "metrics": { "mode": "local" },
    "telemetry": { "mode": "off" }
  }
}
```

Opt-in remote telemetry: set `"telemetry": { "mode": "aggregate" }`, `/reload`, then `/zai-telemetry enable`.

## Live cache-affinity benchmark

Requires a real `ZAI_API_KEY` and network:

```bash
cd packages/pi-zai
export ZAI_API_KEY='...'
npm run benchmark:cache-affinity
```

Optional JSON output: `PI_ZAI_AB_OUTPUT=/tmp/ab.json`.

This is separate from `/zai-benchmark` (manifest A0–A3, local SQLite run tracking).

## Boundary tests

Runtime guards in `src/boundary.test.ts` (mock-only — no LLM tokens, no network):

- Uses a fake `ExtensionAPI` and a global `fetch` spy; never starts a real Pi session
- `runExtensionLifecycle()` fires `pi.on()` handlers from `index.ts` in-process (including tool execution hooks) to cover a typical session path
- Full lifecycle does not call `fetch` when telemetry is off
- Aggregate upload calls `fetch` only via `telemetry/uploader.ts`
- Provider registration and `PI_ZAI_*` env overrides are verified at runtime

Commands that can fetch (`/zai-doctor`, `/zai-usage`) are not exercised here; they require explicit user invocation. Tool hooks record names/durations/errors only — never args or results.

## Telemetry worker deploy

```bash
cd packages/pi-zai/worker/telemetry
npm install
npm run check
npx wrangler deploy
```

Bind route `api.chefgroep.online/pi-zai/telemetry/v1/aggregate` to the deployed worker. Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Release (maintainers)

Standalone repo [OnlineChefGroep/pi-zai](https://github.com/OnlineChefGroep/pi-zai) is the release source of truth. Publishing is automated by `.github/workflows/release.yml`.

### Cut a release

1. Land product changes on `main` as usual (version stays unchanged).
2. On a release PR, bump `package.json` / `package-lock.json` version, regenerate `src/version.generated.ts` (`node scripts/generate-version.mjs`), and move notes under a dated section in `CHANGELOG.md`.
3. Merge the release PR to `main`. The Release workflow then:
   - skips cleanly if that exact version is already on npm;
   - otherwise runs lint/build/test/package checks, `npm publish --access public --provenance`, and creates GitHub Release `v<version>` (and tag) via `gh`.
4. Optional fallback: push an annotated tag `v<x.y.z>` yourself — `.github/workflows/publish-npm.yml` publishes if npm is still missing that version.

Manual re-run: Actions → **Release** → **Run workflow** (`workflow_dispatch`) on `main` after the version bump is present.

Breaking changes → minor bump (`0.x.0`). Keep `NPM_TOKEN` (or npm trusted publishing OIDC) configured on the repo.

### Local preflight

```bash
npm run clean && npm run build && npm test
npm run check:package
npm run check:consumer-install
```

## Sync standalone repo

After monorepo changes, mirror to `OnlineChefGroep/pi-zai`:

1. `npm run clean && npm run build`
2. Rsync `src/`, `docs/`, `dist/`, `scripts/`
3. Copy `package.json`, `CHANGELOG.md`, `README.md`, tsconfig files
4. Commit and push `main`

Do not publish stale `dist/` artifacts — always `npm run clean && npm run build` first.

## Pi compatibility matrix

- Development dependencies target Pi **0.81.1**.
- Optional peer: `@earendil-works/pi-coding-agent >=0.80.10`.
- CI runs `check:version`, an exact `pi-minimum` lane (`0.80.10`), and a non-blocking `pi-latest` lane.
- Generate/check the runtime version with `npm run check:version` (also runs from `prebuild`).

