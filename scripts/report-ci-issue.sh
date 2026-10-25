#!/bin/bash
set -euo pipefail
: "${LABEL:?}" "${TITLE:?}" "${MESSAGE:?}" "${RUN_URL:?}"
gh label create "$LABEL" --description "$TITLE" --color "${COLOR:-d93f0b}" 2>/dev/null || true
existing=$(gh issue list --label "$LABEL" --state open --limit 1 --json number --jq '.[0].number // empty')
body="${MESSAGE} Run: ${RUN_URL}"
if [ -n "$existing" ]; then
  gh issue comment "$existing" --body "$body"
else
  gh issue create --label "$LABEL" --title "$TITLE" --body "$body"
fi
