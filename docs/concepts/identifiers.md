# Identifiers

> **Read this when** you need the code name behind a stage, an attention
> reason, a pull request state, a provider or a kind, or the file that owns a
> concept. **Not for** what the words mean on screen
> ([vocabulary.md](vocabulary.md)) or the agent kinds table
> ([agents.md](agents.md#agent-kinds)).

## Session stages

Session stages, in `SessionStage`: `attention` (**needs you**), `running`,
`review` (**in review**), `building`, `done`.

A fix run raises `attention` too:

- a comment that **Needs you** gives the reason `fix-needs-you` (it opens the
  Comments tab)
- a comment that **Couldn't fix** (not one you stopped, not a failed push) gives
  `fix-couldnt-fix`
- a push that failed gives `push-failed`, in red, and sends its own
  notification

All of them also send one notification when the count rises
(`projectResolveRows`), with an action that opens Activity, where the Needs you
row waits.

### Attention reasons

Attention reasons, in `SessionAttentionReason`, rank in this order when several
hold: `needs-approval`, `agent-error`, `run-stopped`, `push-failed`,
`plan-approval`, `open-question`, `run-waits-for-go`, `auto-needs-you`,
`slack-reply-waiting`, `fix-needs-you`, `run-paused-at-limit`, `ci-failed`,
`changes-requested`, `fix-couldnt-fix`, `pr-queued`, `pr-approved`,
`unread-reply`.

`attentionFactsOf` lists every reason that holds in that order.
`deriveSessionStage` takes the first as `attention` and keeps the rest as
`otherReasons`, and `SessionStageInfo.isRunning` tells a session in needs you
that an agent still works.

- `plan-approval` comes from a workflow run whose `orchestrationStop` is
  `plan-approval` (`isRunHeldForPlan`) and opens that run's page.
- `ATTENTION_REASON_META` gives each reason its mark, tone and words for the
  sidebar, the switcher, the hover card, the Board card, the Now chip and Search
  or run. Red is only an agent error, a run that stopped, a push that failed and
  failing checks.
- `pr-queued` ("In merge queue", a pull request GitHub is set to merge) is not a
  needs-you reason. When it wins, the stage is `review` and `attention` still
  carries it, so the marks and words read it while the session stays out of
  Needs you. A queued pull request is never also `pr-approved`.
- The reason text of a stage says "checks", never "CI".

## Pull request state

A pull request has one state word, from `pullRequestKindOf` in
`shared/utils/pullRequestKind.ts`, and every surface that names it reads that
function: the Branch header and menus, the pull request pane and strip, the
detail facts and the ask pack. The order is merged, closed, queued, approved, in
review, draft.

GitHub keeps `isDraft` true on a closed or merged draft, so the flag alone never
makes a word: a closed or merged pull request never reads Draft.

## Other identifiers

- Project kinds: `repo`, `folder`
- `ProviderId`: `anthropic`, `cursor`, `codex`, `gemini`, `copilot`, `opencode`,
  `openrouter`, `moonshot`, shown as Claude, Cursor, Codex, Gemini, Copilot,
  OpenCode, OpenRouter and Moonshot
- `ArtifactKind` and `ArtifactStatus`, and the plan and artifact markers:
  [artifacts.md](artifacts.md#markers)
- A review conversation is a `resolve_threads` row, a fix attempt a
  `resolve_attempts` row ([review-comments.md](review-comments.md))

## Where things live

- `packages/types/src/session-view.ts`: `SessionStage`
- `apps/desktop/src/store/slices/session-view/deriveSessionStage.ts`: works out
  a session's stage
- `apps/desktop/src/store/slices/session-view/sessionStageRequest.ts`: picks the
  worst request across a session's mounts
- `apps/desktop/src/store/runtime/live-work/selectLiveWork.ts`: the one answer
  to what is live right now
- `apps/desktop/src/features/session/agent-kind.ts`: kind labels, their order,
  which ones show in the spawn menu, and kind prompts
- `packages/core/src/roles.ts`: the list of roles and the default model for each
- `packages/types/src/artifact.ts`: artifact kinds, statuses and metadata
- `packages/core/src/context/marker-parsing.ts`: reads plan markers
- `packages/types/src/provider-registry.ts`: `ProviderId`
- `packages/core/src/profile/profileAccess.ts`: which profile fields each role
  reads
- `apps/desktop/src-tauri/src/query_bridge/project.rs`: the `materialize` verb
- `packages/db/src/queries/resolve-thread.ts`: review conversations
