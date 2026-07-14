#!/usr/bin/env bash
# Lightweight secret-pattern guard for local runs and CI.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SCAN_PATHS=(src test scripts docs worker/telemetry/src)
EXCLUDES='! -path ./dist/* ! -path ./node_modules/*'

patterns=(
	'GOCSPX-[A-Za-z0-9_-]{10,}'
	'[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com'
	'live-[a-zA-Z0-9]{20,}'
	'sk-[A-Za-z0-9]{20,}'
	'ghp_[A-Za-z0-9]{20,}'
)

found=0
for pattern in "${patterns[@]}"; do
	if eval "rg -n --glob '!dist/**' --glob '!node_modules/**' '$pattern' ${SCAN_PATHS[*]}" 2>/dev/null; then
		found=1
	fi
done

if [[ "$found" -ne 0 ]]; then
	echo "check-secrets: possible credential patterns detected in source/docs" >&2
	exit 1
fi

echo "check-secrets: ok"
