#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "== GitHub Auth =="
if command -v gh >/dev/null 2>&1; then
  gh auth status >/dev/null && echo "OK: gh auth active" || echo "WARN: gh auth not active"
else
  echo "WARN: gh CLI not installed"
fi

printf "\n== Git Sync ==\n"
git fetch origin --prune >/dev/null 2>&1 || true
DIVERGENCE="$(git rev-list --left-right --count origin/main...main 2>/dev/null || echo 'unknown')"
echo "origin/main...main: $DIVERGENCE"

printf "\n== Working Tree ==\n"
git status --short

printf "\n== Nested Repos ==\n"
NESTED="$(find . -type d -name .git -not -path './.git' -maxdepth 4 || true)"
if [[ -n "$NESTED" ]]; then
  echo "$NESTED"
else
  echo "OK: none found"
fi

printf "\n== Secret-Risk Tracked Files ==\n"
TRACKED_ENV="$(git ls-files | grep -E '(^|/)\.env($|\.|_)' || true)"
if [[ -n "$TRACKED_ENV" ]]; then
  echo "$TRACKED_ENV"
else
  echo "OK: no tracked .env files"
fi

printf "\n== Recent GitHub Actions ==\n"
if command -v gh >/dev/null 2>&1; then
  gh run list --repo crystalclearhouse-data/crystal-clear-voices -L 5 || true
else
  echo "SKIP: gh CLI not available"
fi

printf "\nAudit complete.\n"
