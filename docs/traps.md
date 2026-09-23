# Traps

> **Read this when** something in the code or the toolchain looks like a bug
> and you are about to fix it. **Not for** how a system is meant to work
> (`docs/architecture.md`) or the conventions a change must follow
> (`CONVENTIONS.md`).

Comments are forbidden in the whole repo. So a deliberate dead end (code that
looks wrong but is right on purpose) cannot explain itself where it sits. This
file holds those explanations. Everything below has been "fixed" at least once and had to be put back.

## Deliberate dead ends

- Claude and Cursor report a turn's total billing usage on the final
  `result`. The live context size comes from the last `assistant` message
  instead. A turn with many tool calls sends several assistant messages. Using
  the first one, or the final billing totals, makes the context bar more and
  more wrong as the turn goes on. `parseAnthropicEnvelopeLine` keeps the last
  assistant usage on purpose and attaches that value to the result event.
- `fetchIssueCandidates` returns `[]` for Bitbucket, and `issueSources.ts`
  has no Bitbucket entry. Goodboy does not show Bitbucket issues, on purpose,
  because Atlassian points issues at Jira. Adding only the source entry ships
  a picker that never lists anything. The mobile companion refuses the same
  provider explicitly, in `commandExecutor.ts`.
- `RemoteHostKind` has no `'bitbucket'`, on purpose. A Bitbucket remote is
  classified as `'other'`, and `remoteHost.test.ts` checks exactly that.
  Adding the member changes that classification and fails the test. It is
  also not the union the pull-request screens switch on. That one is
  `PullRequestProvider`, which already has `'bitbucket'`. So Bitbucket pull
  requests do not need a `RemoteHostKind` member to work.
- `resolve_threads` is the only verdict history. Migration `m140` moved every
  `pending_resolutions` row into it, and `m143` dropped that table. Nothing
  reads a separate queue any more, and a row's state is the answer. Verdicts in
  memory are derived from the row through `threadOutcome`. They are never
  rebuilt by replaying assistant messages. Marker parsing writes rows, but it
  does not own them. `resolve_publications` and `resolve_publication_threads`
  track delivery, and that is what lets an interrupted publish resume.
- `RoutingPicker.onModel(model)` carries only the model string, not the
  provider picked in the picker. A consumer that rebuilds a provider-model
  pair from values captured by an earlier render can save the old provider
  with the new model. There are 11 production mounts across 10 files:
  `ChatInput`, `NotificationCenter`, `DiffViewerContent`, `RoleModelRow`
  (twice), `TaskModelRow`, `AgentSpawnConfig`, `WorkflowBuilderView`,
  `WorkflowStepCard`, `LibraryStepForm`, and `OrchestratorRoutingRow`. Keep the
  provider in current state or a ref when you handle `onModel`. Nobody has ever
  widened the contract to close this. The same stale-pairing bug was fixed at
  the call site instead, separately, at least twice
  (`RoleModelRow`/`TaskModelRow`, then `LibraryStepForm`/
  `OrchestratorRoutingRow` in #1307). Each time the fix tracked the provider in
  a ref instead of adding a provider parameter to `onModel`. This matters for
  more than passing UI state. `LibraryStepForm` saves through
  `step_def_upsert`, whose Tauri command inserts or updates the SQLite
  `step_library` table.
- `LinkedPrChip` and `NewSessionView` read `[data-studio-overlay]` from the
  DOM to tell whether a fullscreen studio is open. In the first, that decides
  navigation inside the session. In the second, it decides how Escape works.
  They check the DOM because that state is split in two: the `sessionStudio`
  union in the store, and the shell that renders every studio. Do not tidy it
  up without first moving fullscreen-studio state into one place.

## Hand-maintained lists the compiler does not check

Each of these is a set or array written out by hand next to an exhaustive
type. Adding a member to the type forces you to update the switch cases. It
never forces you to update the list. Leaving a member out compiles clean and
fails silently at runtime.

- `LENS_KINDS`, used in production only by `readPersistedLens`. A missing
  entry breaks lens restore with no error. A test checks that the set matches
  `LENS_LABEL`, so a missing entry is caught only once its label entry exists.
- `ALL_ISSUE_PROVIDERS` and `CREATE_SESSION_PROVIDERS` decide what the mobile
  companion allows. Their `WorkspaceIntegrationProvider` switches
  (`fetchIssuesFor`, `resolveIssueForSession`) are `never`-checked and will
  ask for a case for a new provider. The gating lists will not. The provider
  then goes missing from mobile issue queries and from session creation.
- `PROVIDER_PRIORITY` ranks pull-request providers and also drives how the
  review target is picked. A provider missing from it still compiles, then
  disappears from availability counts and fallback selection.
- `VALID_SORTS` and `VALID_GROUPS` validate saved session-list preferences. A
  new sort or group key missing here is read back as invalid, silently
  replaced by the default, and overwritten.
- `SIMPLE_LENSES` marks the lenses that still work without a branch. A lens
  left out of it is hidden or cleared for sessions with no branch.
- `GITHUB_ONLY_KINDS` removes GitHub-only resolver actions on other hosts. A
  new GitHub-only action kind left out of it is offered where it cannot work.
- `MARKDOWN_SLOTS` decides which context slots render as markdown. A new
  prose slot left out renders through the plain (non-markdown) path.

## Traps in the toolchain

- A new worktree needs `pnpm install`. In this checkout that install exits 1
  at the `prepare` step. `prepare` runs `lefthook install`, which refuses
  while `core.hooksPath` points at the shared `.git/hooks`. This does no harm.
  Dependencies and native bindings install before `prepare`. So check that
  `node_modules` and `better_sqlite3.node` exist and carry on. Do not repoint
  `core.hooksPath`. The hooks find their tools through the common git
  directory on purpose.
- A worktree installed with `--ignore-scripts` has no `better-sqlite3`
  binding, and both `@goodboy/db` and `@goodboy/core` need it. The root test
  script runs `turbo run test --continue`, so every other package still runs.
  The end of the output can look healthy while both of those suites failed.
  Read the summary, not the last lines.
- Turbo replays cached task results, so a `FULL TURBO` green can be a replay
  and not a real run. When the green has to mean something, run
  `pnpm exec turbo run test --force` and look for a log line reading
  `0 cached`.
- Neither `ci.yml` nor `rust.yml` has a `workflow_dispatch` trigger, so there
  is no "run workflow" button. Pushing another commit to the PR starts them
  again. A finished run can also be re-run from the Actions UI. Closing and
  reopening the PR is the last resort, not the only way.
