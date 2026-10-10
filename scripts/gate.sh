#!/usr/bin/env bash
set -u

cd "$(git rev-parse --show-toplevel)" || exit 1

BASE_REF="${GATE_BASE:-origin/main}"
WORKERS="${GATE_WORKERS:-3}"
LOG_DIR=.gate-logs
TAURI_DIR=apps/desktop/src-tauri
FORMAT_GLOB='\.(ts|tsx|js|jsx|json|md|yml|yaml)$'

mode=full
case "${1:-}" in
  '') ;;
  --quick) mode=quick ;;
  *)
    echo "usage: scripts/gate.sh [--quick]" >&2
    exit 2
    ;;
esac

started=$SECONDS
mkdir -p "$LOG_DIR"
rm -f "$LOG_DIR"/*.log

if ! git rev-parse --verify --quiet "$BASE_REF^{commit}" > /dev/null; then
  echo "gate failed at base: $BASE_REF not found, run git fetch origin main"
  exit 1
fi
MERGE_BASE=$(git merge-base "$BASE_REF" HEAD 2> /dev/null || git rev-parse "$BASE_REF")

step() {
  local name=$1
  shift
  local log="$LOG_DIR/$name.log"
  if ! "$@" > "$log" 2>&1; then
    echo "gate failed at $name: $log"
    exit 1
  fi
}

has_script() {
  grep -q "\"$1\":" package.json
}

changed_files() {
  {
    git diff --name-only --diff-filter=ACMR "$MERGE_BASE"
    git ls-files --others --exclude-standard
  } | sort -u | while IFS= read -r path; do
    [ -f "$path" ] && echo "$path"
  done
}

has_rust_changes() {
  ! git diff --quiet "$MERGE_BASE" -- "$TAURI_DIR" rust-toolchain.toml && return 0
  [ -n "$(git ls-files --others --exclude-standard -- "$TAURI_DIR")" ]
}

in_tauri() {
  (cd "$TAURI_DIR" && "$@")
}

ensure_frontend_dist() {
  [ -f apps/desktop/dist/index.html ] && return 0
  mkdir -p apps/desktop/dist
  echo '<!doctype html>' > apps/desktop/dist/index.html
}

check_formatting() {
  local files
  files=$(changed_files | grep -E "$FORMAT_GLOB" | grep -v 'pnpm-lock.yaml$')
  [ -z "$files" ] && return 0
  echo "$files" | tr '\n' '\0' | xargs -0 pnpm exec prettier --check
}

check_commits() {
  [ "$(git rev-list --count "$BASE_REF..HEAD")" = 0 ] && return 0
  pnpm exec commitlint --from "$BASE_REF" --to HEAD
}

check_website_drift() {
  pnpm --dir website run sync:tokens -- --check && pnpm --dir website exec node scripts/sync-icons.mjs --check
}

check_rust_quick() {
  ensure_frontend_dist
  in_tauri cargo fmt --check && in_tauri cargo check --locked
}

check_related_tests() {
  local desktop packages name status=0
  desktop=$(changed_files | grep -E '^apps/desktop/src/.*\.tsx?$' | sed 's#^apps/desktop/##')
  if [ -n "$desktop" ]; then
    echo "$desktop" | tr '\n' '\0' | xargs -0 pnpm --filter @goodboy/desktop exec vitest related --run --project unit --passWithNoTests --maxWorkers="$WORKERS" || status=1
  fi
  packages=$(changed_files | grep -E '^packages/[^/]+/src/.*\.tsx?$')
  for name in $(echo "$packages" | cut -d/ -f2 | sort -u); do
    [ -z "$name" ] && continue
    echo "$packages" | grep "^packages/$name/" | sed "s#^packages/$name/##" | tr '\n' '\0' | xargs -0 pnpm --filter "@goodboy/$name" exec vitest related --run --passWithNoTests --maxWorkers="$WORKERS" || status=1
  done
  return $status
}

finish() {
  echo "gate ok"
  echo "gate $mode took $((SECONDS - started))s" >&2
  exit 0
}

if [ "$mode" = quick ]; then
  has_script check:rules && step rules pnpm run check:rules --diff "$BASE_REF"
  step prettier check_formatting
  step typecheck pnpm turbo run typecheck --filter="...[$MERGE_BASE]"
  step regressions pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions --maxWorkers="$WORKERS"
  step related-tests check_related_tests
  has_rust_changes && step rust-quick check_rust_quick
  finish
fi

step commits check_commits
step prettier check_formatting
step rules pnpm run check:rules --diff "$BASE_REF"
if has_script check:baselines; then
  step baselines pnpm run check:baselines
else
  echo "gate note: check:baselines is not in this tree yet, skipped" > "$LOG_DIR/baselines.log"
fi
step typecheck pnpm turbo run typecheck
step website-drift check_website_drift
step tauri-commands pnpm run check:tauri-commands
step doc-refs pnpm run check:doc-refs
step test-scripts pnpm run test:scripts
step knip pnpm knip --include files,duplicates,unlisted,dependencies,devDependencies
step knip-production pnpm run knip:production
step test-shards node scripts/check-test-shards.mjs
step vite-build pnpm --filter @goodboy/desktop exec vite build
step packages-tests pnpm turbo run test --filter='./packages/*' --continue
step desktop-unit pnpm --filter @goodboy/desktop exec vitest run --project unit --no-passWithNoTests --maxWorkers="$WORKERS"
step a11y pnpm --filter @goodboy/desktop test:a11y --no-passWithNoTests
if has_rust_changes; then
  ensure_frontend_dist
  step cargo-fmt in_tauri cargo fmt --check
  step clippy in_tauri cargo clippy --locked --all-targets -- -D warnings
  step cargo-test in_tauri cargo test --locked
fi
finish
