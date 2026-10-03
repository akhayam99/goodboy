# Traps

> **Read this when** something in the code or the toolchain looks like a bug
> and you are about to fix it. **Not for** how a system is meant to work
> (`docs/architecture.md`) or the conventions a change must follow
> (`CONVENTIONS.md`).

Comments are forbidden in the whole repo. So a deliberate dead end (code that
looks wrong but is right on purpose) cannot explain itself where it sits. This
file holds those explanations. Everything below has been "fixed" at least once and had to be put back.

## Deliberate dead ends

- `check-ignore -v --no-index` on a bare `.goodboy` answers "not ignored"
  for a directory-only rule (`.goodboy/`) whenever the folder does not exist
  yet on disk, because git cannot tell the probe is meant to be a directory.
  The probe that answers correctly either way is a path clearly inside the
  folder, `.goodboy/worktrees/probe`. `repo.rs::IGNORE_PROBE_PATHS` and
  `goodboy_ignore.rs` both use only that form, on purpose; adding the bare
  name back reintroduces false "not ignored" results.
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
- `syncBranchWithRemote` (the `Sync and try again` of a push that failed on a
  moved remote) has no Rust command of its own. It calls `history_rebase_plan`
  with the branch itself as the base, which fetches `origin/<branch>` and
  plans the rebase of the unpushed commits on it, then replays that plan in a
  copy. A conflict discards the copy and stops. It must never start the
  history rewriter the way `rebaseBranch` does, because the promise on screen
  is that nothing is touched. A failed push counts as "remote moved" only when
  the error matches `isRemoteMovedError`; `verifiedPush` builds its two
  messages through the same module, so changing their wording elsewhere turns
  the button off.
- Review comments come from a `ReviewSource` (`packages/core/src/review-source/`),
  never from `sessionGithub` alone. `activeReviewSourceOf` (review-source slice)
  picks the source of the active mount: its comments, PR or MR number, url,
  head branch and capabilities. Replies and resolves go through
  `reviewSourceFor`, keyed by `resolve_threads.source_kind` and
  `provider_thread_id`; a GitLab thread id is `gitlab:<discussionId>` and its
  `pr_number` is the MR iid, and a Bitbucket thread id is `bitbucket:<rootCommentId>`
  (one thread per inline root comment, replies go under the root). A publication is scoped to the rows of the picked
  source (`approvedPublicationScope({ include })`), so pushing GitLab never
  posts GitHub rows. `resolveStepPlan` leaves a thread open when the source
  cannot resolve (`REVIEW_SOURCE_CAPABILITIES`, Bitbucket replies only). Wording
  follows the same capabilities: where `canResolve` is false the comment has no
  "Resolve without a reply" and the push confirm says the thread stays open.
  Read `sessionGitlabMr` and `reviewSourceThreads` through the selectors, not
  by hand: picking a source in another project calls `setSessionActiveMount`.
- `resolve_threads` is the only verdict history. Migration `m140` moved every
  `pending_resolutions` row into it, and `m143` dropped that table. Nothing
  reads a separate queue any more. What the user sees comes from one column,
  `resolve_threads.stage` (nine stages shown as eight states through
  `resolveRowState`). Only `nextStage` computes it: thread writes go through
  `saveResolveThread`, queue decisions through `advanceResolveStage`. A write
  that calls `upsertResolveThread` directly skips the stage and leaves the row
  lying. The Resolve lens reads its rows from `sessionResolveQueueItems`,
  whose entries carry a copy of the thread row. `projectResolveRows` swaps
  those copies for the fresh rows by thread id, so every thread write shows
  on the queue at once. A projection that sets `sessionResolveThreads` alone
  leaves the queue on the old row: a started resolver stays invisible until a
  reload. Verdicts in
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
  Taking a comment back up (`undeferResolveQueueItem`) only moves a
  `deferred` or `wont_fix` item; the database refuses an `accepted` one.
  Undoing an approval is a reopen (`reopenResolveQueueItem`, stage event
  `user_unapproved`). `reviewComment.undo` in the action registry picks the
  verb from the approval (reopen for `accepted`, take up for `deferred` and
  `wont_fix`), and `reviewComment.matrix.test.ts` walks every state.
  A resolver process can exit while its turn is still settling: the provider
  `done` arrives, then `completeResolvedAgent` runs before the markers are
  saved. `reconcileResolveAttempts` must not fail an attempt in that window, so
  it skips an agent whose turn is still settling (`isTurnSettling` in
  `turnSettled.ts`) besides checking the lease and the live run ids. Markers
  that still arrive on an attempt failed as `interrupted` are recorded rather
  than dropped.
- A resolver started through a batch (`startBatch`, `resolve_attempts.batch_id`
  set) never writes the real branch. `drainResolveQueue` makes it a detached
  copy at the branch head (`resolve_copy_prepare`, under the history copy
  reservations with the slug `resolve-<attemptId>`) and hands `sendTurn` the
  `resolveCopyPath`. That turn takes no worktree writer lease, gets the copy
  and its git admin folder as writable roots, and cannot push. The writer
  lease still guards the real branch for resolvers without a batch, and only
  one of them runs at a time. Up to the session limit
  (`resolve_session_settings.parallel_limit`, default 4) batch resolvers run
  at once; the rest stay `queued`. When the turn ends, the work is captured
  from the copy as a candidate (`refs/goodboy/candidates/<attemptId>`, shared
  by every worktree of the repo) and the copy is deleted; the candidate row
  keeps the real worktree path, so Accept cherry-picks onto the real branch.
  A cherry-pick that no longer applies is aborted and the branch reset, the
  candidate turns `stale` and the thread fails with
  `failed:accept_conflict`, so a retry redoes it on top. Every drain releases
  the copies of ended attempts, and app start removes every `resolve-` copy no
  process holds. A copy is never reused across turns: a later turn of the same
  agent without a copy (an operator message) runs on the real branch with the
  lease.
- `RoutingPicker.onModel(model)` carries only the model string, not the
  provider picked in the picker. A consumer that rebuilds a provider-model
  pair from values captured by an earlier render can save the old provider
  with the new model. Every `onModel` consumer keeps the provider in current
  state or a ref. Nobody has ever widened the contract to close this. The same
  stale-pairing bug was fixed at the call site instead, separately, at least
  twice
  (the old role row and `TaskModelRow`, then the old step library form and
  `OrchestratorRoutingRow` in #1307). Each time the fix tracked the provider in
  a ref instead of adding a provider parameter to `onModel`. This matters for
  more than passing UI state when the consumer persists the pair, as
  `step_def_upsert` does into the SQLite `step_library` table.
- A push count never reads `@{upstream}` or the `branch.ab` line of `git
status` directly. A branch cut from a remote-tracking ref (`worktree add -b
<b> <path> origin/main`) tracks that ref under git's default
  `branch.autoSetupMerge`, and `git push origin <b>` does not move it, so
  `@{u}..HEAD` counts the branch's own commits against main forever. That is
  how a suggestion kept asking to push 8 commits already on origin.
  `branch_remote::branch_remote` compares HEAD with `<remote>/<branch>` and is
  the one reader for `worktree_status`, `worktree_commits` (`pushed`) and
  `project_git_status`; `upstream` is that ref or null. New branches are cut
  with `--no-track` and the in-app push passes `--set-upstream`, but old
  branches still track main, so do not "simplify" back to `@{u}`.

- Rewrite history drags rows with pointer events and its own hit testing
  (`useHistoryDrag`), not HTML5 drag and drop. In the Tauri window the native
  file drop handler owns every drag session while `dragDropEnabled` is on, so
  WebKit never sends `dragover` or `drop` to the page: an HTML5 drag starts and
  then does nothing, while jsdom tests stay green. Turning `dragDropEnabled`
  off is not the fix, because the composer's file drop listens through
  `onDragDropEvent`. `history-drag-keeps-file-drop.test.ts` holds both.
- The query socket sits in `~/.goodboy/query/`, not in `~/.goodboy`. Codex
  and Claude turns get the socket folder as a writable directory
  (`--add-dir`), so they can connect. Moving the socket back beside the
  database puts `data.db`, `file-versions/` and `history-copies/` inside that
  directory. This only matters where `--add-dir` confines anything: Codex in
  `workspace-write` and Claude outside `bypassPermissions`. Claude in
  `bypassPermissions` (the default), Cursor, OpenCode and Antigravity have no
  OS sandbox and can write there anyway. `turn.rs` has a test that fails when
  a provider's `--add-dir` contains those paths.
- `StepTree` (the workflow builder and the Studio editor) reads top down,
  step 1 first and **Add step** last, while `RunTree` and the activity
  timeline read bottom up to NOW. That split is on purpose: a recipe reads like
  text, a run reads like a log. Aligning one to the other, or copying the
  `flex-col-reverse` of the run back into the plan, breaks the lane geometry in
  `StepTreeLane` and the reorder keys, where up means earlier.
- Every timeline row draws its own piece of the rail in its own `<svg>`, so
  the joins only stay seamless while every row shares one pixel grid. Never
  animate a row with a `transform` that outlives the animation (a keyframe
  with `fill-mode: both` leaves one behind and puts the row on its own layer),
  and never give lines and elbows different `shape-rendering`. Grow rows with
  `Reveal`, which moves only the grid track.

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

- Impact counts deleted sessions on purpose. Deleting a session is a soft
  delete: `purgeSessionForDelete` frees the transcript, file versions, slots,
  decisions and images, and keeps the row with `deleted_at`. Never add
  `s.deleted_at IS NULL` to `packages/db/src/queries/impact.ts` or
  `impact-pull-requests.ts`: `impact-lifecycle.test.ts` fails on it. The
  filters on `a.deleted_at` stay: those are agents removed from a workflow.
  Windows and durations read `COALESCE(last_activity_at, updated_at)`, and
  the purge leaves `updated_at` alone, so a session deleted today stays in the
  window of its last activity.
- Impact never reads `github_pr_cache`. The boot cleanup
  (`runDatabaseHygiene`) deletes cache rows whose branch has no live session,
  which is exactly the work that shipped. Merged pull requests come from
  `mount_pr_links` and the `pr_merged` session events, keyed by host,
  repository and number. A detached project deletes its mount and its links,
  so the same boot cleanup writes a `pr_merged` event for every merged link
  that has none yet (`backfillMergedPullRequestEvents`). A merge done in
  Goodboy carries host and repository in its payload (`mountPrEventPayload`),
  so it and the observed transition dedupe to one event.

## Traps in the store

- A store helper named `select*` is not always safe as a `useAppStore`
  selector. `selectWritableMounts` maps `sessionMounts` views through
  `toProjectMounts`, so it and every helper built on it (`selectMountForPath`,
  `selectMountById`, `selectActiveMount`) return new objects on each read once
  a session's mounts load. `selectSessionForPr` builds its match object too.
  Subscribing to one of those objects re-renders forever and crashes with
  React #185. Select a primitive field (`?.mountName`), wrap the selector in
  `useShallow`, or read `useAppStore.getState()` inside the handler that needs
  it. `apps/desktop/src/__tests__/surfaces/primary-surfaces.test.tsx` mounts
  the main surfaces on the real store to catch this, and
  the `navigation-flows/` folder next to it clicks into every page of the app.
- Every path stored for a project or a session (`projects.root_path`,
  `session_worktrees.worktree_path`, `retained_worktree_paths`,
  `worktree_roots`, `resolve_*`, `skills.file_path`) is absolute. Never
  compare two of them without normalizing (trailing slash, symlink) first,
  and never assume a folder that no longer resolves means the data is gone:
  see [architecture.md](architecture.md#moving-a-projects-folder). A
  `project_relocate` touches every one of those tables by prefix in one
  transaction; missing one of them from that list reintroduces the exact bug
  it fixes.

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
- The search index (m211) is kept current by triggers on fourteen source
  tables (`sessions`, `messages`, `agents`, `session_artifacts`,
  `session_decisions`, `open_questions`, `session_external_tasks`,
  `workspace_starred_issues`, `github_pr_cache`, `mount_pr_links`,
  `session_worktrees`, `workflows`, `steps`, `diff_comments`). A table
  rebuild (`CREATE ..._new`, `DROP`, `RENAME`) drops the triggers of the
  table it drops, so the rebuilding migration must
  create them again; `m211-search-index.test.ts` fails when one is missing
  from the latest schema. A trigger body reads only its own row and the
  `search_*` tables, never another source table: a trigger that names a
  table breaks the next `ALTER TABLE ... RENAME` of that table's rebuild,
  exactly like a view does.
- `cargo fmt` formats the whole crate, whatever file you give it. `main` is
  fmt-clean and `rust.yml` blocks on it, so a local run only touches files
  the change edited. If it rewrites others, your toolchain is not the one in
  `rust-toolchain.toml`.
- Neither `ci.yml` nor `rust.yml` has a `workflow_dispatch` trigger, so there
  is no "run workflow" button. Pushing another commit to the PR starts them
  again. A finished run can also be re-run from the Actions UI. Closing and
  reopening the PR is the last resort, not the only way.
- Moving uncommitted work out of a folder never uses `git clean`, `git stash`
  or a copy followed by a blanket delete. The bootstrap move records the folder
  with a temporary index (`Git::index_file`, the only repo env that survives
  the launcher), verifies the copy by hash and clears by exact paths whose
  content still matches. Ignored files stay where they are on purpose.
- After the first push into an empty repository `origin/HEAD` is not set, so
  `worktree_repo_default_base_branch` returns nothing and the base branch
  picker is empty. `remote set-head origin <branch>` after the push fixes it;
  the publish and the probe both do it.
- A selector passed to `useAppStore` must return a stable value. A selector
  that builds an object (`{ project, stage }`) loops the render; select the
  project and the stage separately. The mock scenes catch this, unit tests with
  a mocked store do not.
