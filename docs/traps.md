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
  reads a separate queue any more. What the user sees comes from one column,
  `resolve_threads.stage` (nine stages shown as eight states through
  `resolveRowState`). Only `nextStage` computes it: thread writes go through
  `saveResolveThread`, queue decisions through `advanceResolveStage`. A write
  that calls `upsertResolveThread` directly skips the stage and leaves the row
  lying. Verdicts in
  memory are derived from the row through `threadOutcome`. They are never
  rebuilt by replaying assistant messages. Marker parsing writes rows, but it
  does not own them. `resolve_publications` and `resolve_publication_threads`
  track delivery, and that is what lets an interrupted publish resume.
  An active `resolve_publications` row is the publish lock. It carries a
  `holder` (window and launch) and a `heartbeat_at` refreshed every 10s. A
  window claims the row only when it has no holder, is its own, or went
  silent for more than 60s; otherwise the publish returns `busy`. On
  session load and before every publish, an active row silent for more than
  60s is closed as failed with the error `The app stopped while publishing`:
  a reply caught in `sending` turns `uncertain`, and retry checks GitHub before
  posting again. The in-memory map in `publicationLock.ts` is only a fast lane.
- `RoutingPicker.onModel(model)` carries only the model string, not the
  provider picked in the picker. A consumer that rebuilds a provider-model
  pair from values captured by an earlier render can save the old provider
  with the new model. Every `onModel` consumer keeps the provider in current
  state or a ref. Nobody has ever widened the contract to close this. The same
  stale-pairing bug was fixed at the call site instead, separately, at least
  twice
  (`RoleModelRow`/`TaskModelRow`, then the old step library form and
  `OrchestratorRoutingRow` in #1307). Each time the fix tracked the provider in
  a ref instead of adding a provider parameter to `onModel`. This matters for
  more than passing UI state when the consumer persists the pair, as
  `step_def_upsert` does into the SQLite `step_library` table.

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

## Traps in the toolchain

- A new worktree needs `pnpm install`. In this checkout that install exits 1
  at the `prepare` step. `prepare` runs `lefthook install`, which refuses
  while `core.hooksPath` points at the shared `.git/hooks`. This does no harm.
  Dependencies and native bindings install before `prepare`. So check that
  `node_modules` and `better_sqlite3.node` exist and carry on. Do not repoint
  `core.hooksPath`. The hooks find their tools through the common git
  directory on purpose.
- The pre-commit hook in `lefthook.yml` finds `prettier` and `commitlint` in
  the main checkout's `node_modules` (through the common git directory),
  because a worktree does not always have its own install. It still runs the
  binary from the current directory, so prettier finds files that exist only
  in the worktree, such as ones added in this commit.
- A worktree installed with `--ignore-scripts` has no `better-sqlite3`
  binding, and both `@goodboy/db` and `@goodboy/core` need it. The root test
  script runs `turbo run test --continue`, so every other package still runs.
  The end of the output can look healthy while both of those suites failed.
  Read the summary, not the last lines.
- Turbo replays cached task results, so a `FULL TURBO` green can be a replay
  and not a real run. When the green has to mean something, run
  `pnpm exec turbo run test --force` and look for a log line reading
  `0 cached`.
- `pnpm test -- <arg>` never reaches turbo. pnpm passes the `--` through, and
  turbo hands everything after it to every package's vitest. `--force` dies
  there with `CACError: Unknown option`, and a file name still runs every
  package. Force a run with `pnpm exec turbo run test --force`. Run one file
  with `pnpm --filter @goodboy/<pkg> exec vitest run <path>`.
- commitlint requires a lower-case subject, so a camelCase identifier in the
  subject fails the `commit-msg` hook. Name it in the body instead. The whole
  header is capped at 72 characters.
- `registry.test.ts` requires migration versions to form a contiguous range
  from 1. Two open pull requests that each add a migration merge in numeric
  order. If the higher one merges first, it leaves a gap and turns `main` red.
  Renumbering is covered in [architecture.md](architecture.md) → Database
  migrations.
- SQLite lets `DROP TABLE` remove a table a view still reads, and it keeps
  the view. The next `ALTER TABLE ... RENAME`, on any table, checks every
  view and fails with `error in view <name>: no such table`. So a reset that
  drops tables one by one strands `live_agents` (m156), and the replayed
  chain dies at m015's table rebuild. Reset a database with
  `reset_database` in `db.rs`, never with a loop of `DROP TABLE`. The
  launch check that heals such a file needs a missing core table too, on
  purpose: a broken view alone is not proof of a wipe, and resetting on it
  would erase a live database.
- `cargo fmt` formats the whole crate, whatever file you give it, and `main`
  is not fmt-clean (`rust.yml` runs the check as advisory). A local run
  rewrites files the change never touched. Revert those hunks before you
  commit.
- Neither `ci.yml` nor `rust.yml` has a `workflow_dispatch` trigger, so there
  is no "run workflow" button. Pushing another commit to the PR starts them
  again. A finished run can also be re-run from the Actions UI. Closing and
  reopening the PR is the last resort, not the only way.
