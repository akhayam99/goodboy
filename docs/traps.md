# Traps

> **Read this when** something in the code or the toolchain looks like a bug
> and you are about to fix it. **Not for** how a system is meant to work
> (`docs/architecture.md`) or the conventions a change must follow
> (`CONVENTIONS.md`).

Comments are forbidden in the whole repo. So a deliberate dead end (code that
looks wrong but is right on purpose) cannot explain itself where it sits. This
file holds those explanations. Everything below has been "fixed" at least once and had to be put back.

## Deliberate dead ends

- `navigate` closes the open drawer (only Ask survives, `keepAskDrawer`),
  because the drawer belongs to the history entry. A row of the Agents panel
  that opens a page in the center must pass the panel as `drawer`
  (`openSpawned`), or the panel closes under the click. Do not make the panel
  survive every navigation: then it would also stay over pages that have
  nothing to do with the run or Auto it showed.

- The macOS menu bar and the web view share every ⌘ key, and the web view sees
  the key first: a `preventDefault` in a shortcut handler stops the native menu
  item, and a key nothing handles falls through to it. So a key runs once
  whichever path takes it (`app_menu.rs`, `useMenuCommands`), and a menu row
  must carry the registry's combo, never its own. Do not add a ⌘Z item or any
  menu row for Undo: Edit > Undo stays the predefined item, because a custom
  one would steal the press from the text field, the terminal and the Commits
  page that own it. Do not add a second listener for `goodboy://menu`.
- On macOS a right click first selects the word under the pointer, then fires
  `contextmenu`. A policy that reads `window.getSelection()` at that moment
  sees a selection on every row with selectable text and hands the click to the
  webview menu (Look Up, Translate, Services). So `useNativeMenuPolicy` reads
  the selection at the press (`mousedown`, capture) and only a selection held
  before it counts, and only inside `data-reading-region`. Do not move the
  check back into `useObjectMenuTrigger` with the live selection, and do not
  drop `select-none` from `ROW_HOVER`.
- `worktree::foreign` Rust tests (and the origin fetch behind them) read git's
  error text. Under a non-English git locale that text is translated, so the
  fetch runs with `LC_ALL=C` (`git_english`); a test that shells out to git for
  such text must do the same.
- A CLI's Bash tool runs each command as its own session leader (measured: a
  shell under a Goodboy turn had a process group equal to its pid). Signalling
  the CLI's group at the end of a turn misses the dev servers and watchers an
  agent started, so `proc/reap.rs` also walks the tree and matches the
  `GOODBOY_SPAWN_ID` tag. A child that clears its environment escapes the tag;
  the tree snapshot covers it only while its parent lives. Do not shrink the
  reap to `killpg`.
- macOS hides the environment of Apple-signed binaries (`sh`, `bash`, `sleep`)
  from other processes, with `ps -E` and with `KERN_PROCARGS2` alike (System
  Integrity Protection). The tag therefore finds third-party programs (node,
  bun, vite, the provider CLIs) and not those binaries. They are covered by
  the tree and the group while the run is alive, and the end-of-turn reap
  signals the whole process group of the leader, so a restricted child in the
  group dies there. A restricted child that left the group (its own session)
  and whose parent is gone is not found by anything: that is a known limit,
  not a bug to chase with a broader match. A reap test that uses `sleep` as
  the straggler passes on Linux and fails on macOS. The tests use the test
  executable as the child on purpose.
- Never signal a pid taken from an earlier read without asking the kernel
  again. A pid is only a number: the process that had it may be gone and a
  stranger may have it now. `reap.rs` compares the kernel start time and the
  tag right before each TERM and each KILL, and `kill(pid, 0)` is not that
  check. A zombie has no readable identity on macOS, so a zombie leader the
  app still holds is kept in the table without one and is never signalled.
- A side job that prints nothing is not stuck. The Claude CLI answers once, at
  the end, so the idle cap watches the CPU of the whole tree as well as the
  pipes. Do not turn it back into a wall clock.
- The reap waits for the leader with `waitid(WNOWAIT)` and only then calls
  `child.wait()`. Calling `wait()` first frees the pid, the tree is lost, and
  the leader can no longer be proven to be ours. Swapping the order brings
  back the processes that outlive a turn.
- A tagged process can be a daemon the agent started on purpose, such as a
  file watcher daemon of the version control tool or an ssh control master. The
  reap stops it too, and it restarts on demand. That is intended, not a bug.
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
- A pull request is written through its `PullRequestPort`
  (`ReviewSource.pullRequest`, built per host by `pullRequestPortFor`): the
  `store/slices/github` verbs, `usePullRequestView` and the Branch page never
  build `gh` arguments themselves. A control reads `REVIEW_SOURCE_CAPABILITIES`,
  never the host name; a flag is `true` only with its port method and its test
  (`reviewSourceContract.test.ts`, `pullRequestPortContract.test.ts`). Merge readiness is one
  function, `evaluatePrMergeReadiness`, used by the Branch header and the
  companion alike.
- `sessionGithub` is a projection of the write destination mount
  (`sessionActiveMount`), re-derived only when a GitHub write lands. A page
  about one branch reads `sessionPullRequestOf({ mountId })` or
  `branchGithubOf({ mountId })` (github slice), keyed by the shown mount, never
  `sessionGithub` alone: the Pull request page and the Checks tab (`BranchChecks`) both do;
  for a GitLab or Bitbucket host the Checks tab also picks its review entry with
  `selectedReviewEntryOf({ mountId })` (no fallback to another mount's entry) and reads
  `usePullRequestView({ mountId })`, so Analyze starts on the shown branch,
  and so do the branch tabs (`branchScopeOf({ mountId })`) and the `pullRequest` action
  target (`mountId`, carried into its facts). The lifecycle writes of that target (`markPrReady`,
  `mergePr`, `reopenPr`, `convertPrToDraft`, `closePr`) and their refresh take the same `mountId`
  through `PrWriteOptions`: a write without one lands on the active mount's repository, where
  another pull request can carry the same number. So do `requestReview`, `editPr`, the reviewer search port (`usePullRequestPort({ mountId })`), the create form's reviewer step and the Scribe settle (`work.mountId`). `refreshMountPr` keeps the known request when a poll of
  the same branch and repository answers empty.
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
  "Resolve" and the push confirm says the thread stays open.
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
  `resolveCopyPath`. The copy mirrors every `node_modules` of the main tree
  (root and workspace packages, depth 3): the folders are real, `.pnpm` and
  other real entries are symlinks to the main tree, and pnpm's own relative
  links are recreated so a workspace package resolves to the copy's code,
  not the main tree's. A main tree without dependencies yields a copy
  without them. Nothing is written into the main tree. That turn takes no
  worktree writer lease, gets the copy
  and its git admin folder as writable roots, and cannot push. The writer
  lease still guards the real branch for resolvers without a batch, and only
  one of them runs at a time. Batch resolvers run in a lane: one lane per
  mount worktree path, at most one agent holding it (`running` or `waiting`
  for an answer, see `resolveLane.ts`), the rest `queued` in creation order.
  A retry, Fix anyway, rewrite reply, steer or typed message of an agent
  whose lane is held by another agent is turned into a queued attempt
  (`queueTurnInLane`, called by `prepareTurn`) and a recheck waits for a free
  lane (`ThreadRecheck.isQueued`); two branches still run side by side. The
  copy starts at the lane tip (`resolve_copy_prepare` takes `startSha`: the
  last ready candidate of the lane, else the branch head), so each fix is
  built on the one before. When the turn ends, the work is captured from the
  copy as a candidate (`refs/goodboy/candidates/<attemptId>`, shared by every
  worktree of the repo) and the copy is deleted when its agent is done.
  Capture keeps tracked changes only: untracked files, symlinks out of the
  checkout, ignored paths and `node_modules` never enter a candidate. In a
  copy the capture is stacked: the copy stays on the candidate tip and a run
  with several fixes is split into one candidate per fix, each based on the
  one before (all or nothing, else one shared candidate). The ready candidates
  of a mount form a chain by `baseSha`; a ready candidate whose base is not
  the previous link is broken, and so is one whose base is a fix that was
  refused, deferred or made stale, or that the branch took as a copy under
  another commit (`laneChainOf` weighs every candidate of the mount, not only
  the ready ones, so a refused first fix cannot leave the next one heading the
  chain). `reconcileResolveLane` (after load, refuse, defer, switch to reply
  only, a turn, an accept and every source sync) runs one at a time per
  session, discards the broken fixes first and then has the lane rebuild their
  comments on top, with `LANE_REBUILD_HINT` and the model of the run that made
  them (a split fix is named after its run: `attemptOfCandidate`). When the
  rebuild cannot start, the fixes stay discarded and the comments it took back
  up are set aside again. That is also how fixes the old parallel runs left
  side by side migrate: the first ready one stays, the rest are rebuilt, with
  no schema migration. Refusing or deferring a link drops its candidate and
  rebuilds the ones after it; taking a deferred fix back up rebuilds it.
  Accept of a link fast-forwards the branch through that link, accepting the
  earlier links with it (`acceptResolveQueueItem`); an earlier link that is
  deferred or refused blocks it. A cherry-pick that no longer applies, or a
  branch that no longer contains the base of the fix (`the branch moved`), is
  aborted and the branch reset, the links turn `stale` and the threads fail
  with `failed:accept_conflict`, so a retry redoes it on top; the fixes after
  them are rebuilt. A branch that only moved ahead takes the fix by cherry-pick
  and each link records the commit it landed as. An accept that finds the
  answer moved a revision without changing is repaired and tried once more
  (`withStaleRecovery`), for every link of the chain; a link whose answer
  really changed stops it and the error names that comment
  (`staleCommentName`). Every drain
  releases the copies of ended attempts, and app start removes every
  `resolve-` copy no process holds. A copy is never reused across turns: a
  later turn of the same agent without a copy (an operator message) runs on
  the real branch with the lease. `resolve_session_settings` is no longer
  read; the parallel limit it held is gone.
- `RoutingPicker.onChange(route)` carries the whole route (provider, model and
  effort) in one call. It used to be three callbacks fired in one event, and a
  mount that built the second patch from
  props captured by the render before the first wrote the old provider back:
  picking Cursor then Opus 5.5 on a workflow step left the step on its old
  provider. The same bug was patched at the call site again and again with
  refs and microtask queues (#1307 and others) before the contract changed. A
  mount applies the route in one patch. It never splits it back into a
  provider write and a model write, never reads the provider from a ref, and
  never infers the provider from the model id (`getModelProvider` answers for
  one provider when several share an id). This matters most when the consumer
  persists the pair, as `step_def_upsert` does into the SQLite `step_library`
  table. The route's effort is already clamped to the model it names, and the
  `effort` a mount hands the picker is the value the user saw. Neither is the
  effort the mount stored. A mount that asks "did the pick change the effort"
  compares with the stored or requested effort. Comparing with the clamped one
  calls a pick unchanged when only the clamp hid the difference: a saved Max
  shown as High on Sonnet stayed Max on the Opus the user picked.
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

- Rewrite history and the issue chip drag with pointer events on one shared
  engine (`usePointerDrag`: 5 px threshold, window listeners that are removed
  on finish, an Esc layer, an opt-in to start on a button that still clicks).
  Each keeps its own hit test (`useHistoryDrag` for commit rows,
  `useTaskDrag` for `data-task-drop` targets). Neither uses HTML5 drag and
  drop. In the Tauri window the native
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
  `Reveal`, which moves only the grid track. Its grid element carries `min-w-0`; without it the widest unbreakable child sets the column and a body overflows the rail.
- The sign-in CLIs speak through their exit code. `claude auth status` and `codex login status`
  exit 1 when you are signed out, with a perfectly good answer on stdout, and
  `cursor-agent status` can say "Logged in (unable to fetch user details)" while every run
  fails with "Authentication required". Reading a non-zero exit as "unknown", an unknown
  as "not signed in", or a local token as proof of a server account each made providers
  connect and disconnect on their own. `probeOutcomeOf` and `providerHealth.ts` keep the
  three apart: a probe with no answer never changes the standing, a lost sign-in needs two
  answers 10 seconds apart, and only a refused run or a `verified` answer speaks for the
  server. Do not collapse them back into one connected flag.
- Explore decides text from content, not from the extension. `explore_read`
  sends an image or a PDF extension as a data URL, and reads the first 8 KB of
  anything else: a NUL byte or invalid UTF-8 returns `Binary { size }` with no
  payload; a multibyte sequence cut at the 8 KB edge still counts as text. Do
  not bring back an extension list, and do not widen the data URL list: a
  `.mts`, a `.jsonc` or a file with no extension must stay readable.
- The background repo check (`worktree/base_divergence.rs`) passes
  `--no-prune` to its fetch on purpose. A user's `fetch.prune=true` makes a
  plain `git fetch` prune, and a check that runs every few minutes must not
  delete remote-tracking branches behind the user's back. Its scenes stay
  quiet because `quietSceneRepoCheck` replaces `checkRepoDivergence` in the
  scene host, where there is no Tauri to answer.
- `Markdown` (`packages/ui/src/components/Markdown/index.tsx`) keeps the React
  element of every block between renders and reuses it when the block is
  unchanged, so a long answer that grows by a word renders only its last block.
  `parseStableMarkdown` gives an unchanged block the same object (key: its
  index and its JSON), and the element cache matches on that object plus the
  block id. Do not wrap blocks in a `memo` component to "simplify" it: the
  renderer lives in `index.tsx` because the lint and style ratchets are keyed to
  that path. An open code fence (`isClosed: false`) stays plain text and is
  highlighted only once its closing fence arrives, so a streamed block never
  swaps colors on every line. `markdown.perf.test.tsx` counts `parseInline`
  calls to prove it.

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
- The `auto` role is in `AgentRole` and in every exhaustive map, and it is left
  out of every list a person sees on purpose: `SELECTABLE_AGENT_ROLES` (all its
  flags in `ROLE_REGISTRY` are `false`), `DEFAULT_GROUPS`, `GUIDANCE_ROLES`, and
  the visibility chips of the Context drawer (`ALL_ROLES` in `roleVisibility.ts`
  drops it). Do not add it to one of them to make a list complete. Showing Auto
  is the release that turns the experiment on.
- `AUTO_DELEGATION_ROLES` (`packages/core/src/auto/roles.ts`) and the
  `READ_ONLY_ROLES` and `WRITER_ROLES` of `providers/cli_args.rs` name the same
  ten roles in two languages. `the_writer_roles_match_the_auto_writer_roles_of_core`
  reads `AUTO_WRITER_ROLES` out of the TypeScript file and fails when the two
  writer lists differ; the read only list has no such test. `READ_ONLY_ROLES`
  also holds `auto`, which is not a delegation role. A role missing from both
  Rust lists runs read only. The role CHECK of `auto_delegations` (m232) is the
  third copy: a new Auto role needs a table rebuild. Change one, change all.
  A role id outside the TypeScript list is rejected by
  `parseAutoDelegationRole`, never passed through `normalizeAgentRole`, which
  would turn it into the Generalist.
- Auto's glyph is `CONCEPT_ICONS.auto` (`Orbit`), not a sparkle: the AI glyph
  ratchet bans `Sparkles` everywhere. Its color token `agent-auto` is its own
  cyan and not `primary`, so it does not move if the primary color changes.

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

- A plan's run is found by its link (`plan.workflowRunId`, else the planner
  agent's `workflowRunId`) in `planOwnerOf`, never by the next step of the
  run's workflow. An orchestrated run creates its next step later, so a lookup
  through the template returns nothing right after Approve and the plan falls
  back to **Run plan**, a chip that says **Ready to run** and a **Start
  implementer** card. Ask `planOwnerOf` and `planHandoffOf`; do not rebuild
  the predicate.
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
- A failed publication advances the thread revision, so the approval is no
  longer current and a fresh `preparePublication` for that thread answers
  `not_ready`. Retrying one reply goes through `publishThreadNow`, which
  resumes the failed single-thread publication instead of preparing a new one.
  A reply the viewer posted by hand is marked posted with
  `setResolveThreadReplyPosted`, a write that leaves the revision alone: going
  through `updateResolveThread` would bump it and strand an approved reply.
- A prepared push preview lives as a `previewed` publication row while the
  panel is open, and `useReviewPush` holds its phase in page state. Every way
  out of that state must close the row with `cancelPublication`: Cancel, the
  header toggle, a re-arm, the page unmounting and a `missing` answer. A
  preview prepared by a request that resolves after the page left is cancelled
  when it lands (the phase is no longer `preparing`). Leaving one out leaves a
  `previewed` row nobody can confirm. The header Push never narrows to the
  selected comment: only `Push only this one` passes `threadIds`.

- Never derive repository state from an agent's transcript. A fix agent that
  commits quietly (`commit -qam ... && log --oneline -1`) prints no
  `[branch sha]` line, and a regex over tool output reads "no commit" for a
  commit that exists. Whether a CI fix committed, and whether that commit is
  pushed, come from `readCheckFixCommit` (`listBranchCommits`: the newest
  commit made after the fix started, and its `pushed` flag). A check chain
  reads that fact through `selectCheckChain`; `commitOf` is only the fallback
  when the repository is unreadable. Re-read after a push
  (`useCheckFixCommitSync` does it when the mount's head or upstream distance
  changes) or the card keeps saying "not pushed".

- A CI fix chain is keyed by the check URL it analyzed, and a push makes
  GitHub start a run with a new URL. After the push, `checkTargetOf` keeps the
  latest analysis of the mount (same URL, or same check name) so the chain does
  not fall back to `none`, and `checkOutcomeOf` reads the new run by name: the
  old URL still listed is "running", never "still fails". An agent carries no
  mount id: `checkTargetOf` ties an analyst to its mount through
  `selectCheckMount`, which matches the analyzed URL against the pull requests
  and check runs of each mount. Agents started since m233 also store
  `agents.mount_id`, set to NULL when the worktree row is removed. The Activity
  row of a CI fix agent resolves its mount through `ciFixMountOf`: the stored
  mount while it is still attached, then `selectCheckMount`, then the one
  attached mount whose `repoSlug` is the repo in the job URL, then the session's
  only attached mount, else it opens the chat. Older agents have no stored
  mount, and two mounts of one repo cannot be told apart by the URL, so that row
  opens the chat.

- The CI fix roles are `ci-debugger` and `ci-fixer`, stored as their own kind.
  An older version stored `debugger` and `implementer` on the same agents, and
  `ciFixRoleOf` still reads those as CI roles when the agent has a failed-check
  source. A stored role nobody knows reads as the generalist and warns once in
  development, so a downgrade or a newer build never breaks the Activity list.
  The generic Next card "Review the changes" must not fire on a `ci-fixer`: the
  CI fix card owns that step.

- A scout fan-out parent consolidates once every child has ended, and an ended
  child is `completed`, `failed`, `skipped`, `blocked` or `stopped`
  (`TERMINAL` in `apps/desktop/src/store/slices/workflows/scoutTree.ts`). A
  child that ends blocked or stopped never reaches `advanceScoutTree`, so the
  place that blocks or stops it calls `joinFanOutParent`; without that call a
  last child that ends blocked leaves the parent waiting forever. The
  consolidation prompt names the status of each child. `stopped` is published
  only after the exit is confirmed (`cancelTurnConfirmed`), and the join also
  waits while a child's turn is `running` or `blocked`, so the parent never
  consolidates over a child that is still alive.

- An Auto artifact is approved only while `auto_artifacts.approved_revision`
  equals the live `session_artifacts.revision`. A hand edit or a restore writes
  the artifact row alone, so `approval_state` can still say `approved` for a
  revision that is gone. Read approval through `effectiveApproval`
  (`packages/core/src/auto/ledger.ts`), and never compare the stored state.
- The reservation of a first attempt is owned by `auto_delegations.first_attempt_id`,
  an id minted at admission. The attempt row does not exist until
  `startAttempt`, so find that reservation by owner id, never by joining
  `auto_attempts`.
- Never bring back a dollar ceiling per child or hold money for one at admission.
  A held amount refuses children and pauses the tree on money nobody spent, and a
  ceiling charged for an unknown cost bills the user for nothing. A child's money is
  its telemetry while it runs (`autoLiveUsdSql`) and its reconciled cost after;
  `autoReservedUsdSql` skips `owner_kind = 'attempt'` so old rows with an amount
  hold nothing.
- Never add a fixed count of agents, runs or turns as a hard stop of an Auto tree.
  The spend cap, the no progress streak and the time limit already guard it, and a
  count ends a useful tree with no way forward. `delegations_used`, `attempts_used`
  and `turns_used` are information only, and `grants` is a dead column kept for old
  rows.
- The admission rule is written twice on purpose: as one guarded SQL statement
  (`autoAdmissionTreeStatement`), which decides, and as `diagnoseAdmission`,
  which only names the refusal. A new limit goes into both, and
  `admit.sqlite.test.ts` checks the SQL on its own so a stale snapshot cannot
  admit what the guard refuses.
- A message to an Auto agent never goes through the plain turn path while the Auto runtime
  runs: `spawnAgent` (first message) and `sendTurn` (every later operator message) call
  the door `currentAutoUserTurnPort`, which queues a `user` outbox row. The door exists
  only in the main window and only while delegation is on; in another window the plain
  turn answers, and an `<<auto>>` block in its reply is never applied: only `settleAutoTurn`
  applies a block. Never send an Auto root a turn by hand with
  `origin: 'operator'` expecting the plain path; a delivery uses `origin: 'delegation'`.
- `auto_*` money columns are REAL dollars. Compare them through
  `autoRemainingUsdSql` and `AUTO_USD_EPSILON`, not with `===`.
- m232 rebuilds `auto_delegations` with `PRAGMA foreign_keys = OFF` around the
  drop: without it, dropping the table cascades into `auto_attempts`. Any later
  rebuild of an `auto_*` table follows the same procedure and its test counts
  the child rows before and after.
- The sql of m230 is pinned by hash in `registry.test.ts`. While the release is
  unshipped, a change to it needs the new hash pasted there; once shipped, it
  is immutable.
- The Auto resume is admitted twice on purpose too: `autoResumeTreeStatement`
  (phase, run, attempt limit and money in one guarded update) decides, and
  `diagnoseResume` only names the refusal. It accepts `deciding` and
  `delegating`, because one turn may answer several questions after it already
  handed work over; `delegate` accepts `deciding` only.
- A `finalizeTurnStream` step that reads the database on every turn shifts the
  timing of the orchestrated-run story tests: the next test starts while the
  last turn is still settling and fails on a foreign key. `routeQuestions` and
  `isFanOutRejected` therefore read only when the reply holds a question or a
  split. Keep any new read there behind such a condition.
- An adopted source (Move to Auto) is a delegation row with `adopted = 1`, so
  `isAutoChildAgent` is true for it too, but the delegation lines, the Work rail and
  `autoTreeOfAgent` skip it on purpose: it stays an ordinary agent in the lists.
  Its role is the delegation role of its kind, and a Generalist takes `implementer`
  because the role column has no other value for it; the chat never shows that.
- The registry reads `isAutoOn` from the settings and the compile gate only, because
  `when` sees facts and not React context. A scene or a test that needs Move to Auto
  open through the context drives the panel (`MoveToAutoPanel`) or the feature
  function with `isReleased`.
- A child of an Auto tree is found by its delegation row (`isAutoChildAgent`),
  never by a flag on the turn input: a reattached turn after a reload has no
  input, and the question and split gates must still hold for it.
- A plain-folder session's marker is `.goodboy/session.json` inside a `.goodboy`
  folder; older sessions may still hold `.goodboy` as one file. Only
  `marker_read` in `session_dir.rs` knows both shapes, and `file_versions.rs`
  must read the marker through it. A second reader that tests `.goodboy.is_file()`
  broke file versions in every plain-folder turn from #1533 until it was fixed. Build
  test session folders with `session_dir_create_blocking`, never by hand.
- Saved versions of a plain folder keep their before copies where file
  versions always kept them, `file-versions/<session-id>/<version-id>-<name>`
  with a `file_versions` row. Everything new (the first copy, the index, staged
  runs, turn manifests) lives in `folder-versions/`, which older builds never
  read. A new place or name for the before copies is a new on-disk format and a
  minor release. Nothing is ever written inside the user's folder: a restore
  writes a temporary file next to its target and renames it over. A staged run
  is finished at startup only when it is not live and older than a minute; a
  second window booting while a turn runs must not finish that turn early.
- `inPlaceFoldersOf` answers where an agent may write now: unmounted projects
  of kind `folder`. It is not the history of a session. Tracking a folder with
  git turns it into a repo, and its old sessions still own saved turns there, so
  every view of past changes (Changes, the turn card, the turn list load) goes
  through `historyFoldersOf` and `historyCandidatesOf`, which keep a repo that
  holds turns of the session. Reading history through the writable selector
  loses it silently on conversion.
- The materialize bridge hands a plain folder to the agent only when the
  session holds that folder's saved copy (`holdsFolderCapture`, kept by
  `createFolderSnapshotPort`). A turn that started on a repository mount has no
  writer lease or saved copy on the folder, so it is refused with a pointer to
  the next turn.
- Unlinking a plain folder forgets its first copy and staging. It refuses while
  a turn is open on the folder: `removeProject` reads `isTurnOpen` before it
  unlinks, and `forget_folder` returns `FolderBusy` under the folder lock, so a
  turn started in another window keeps its staging.

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
- A terminal or script view subscribes to the output events before it asks
  for the snapshot, and writes an event only when its `offset` plus length is
  past the snapshot's end (the first bytes of a partly covered chunk are cut).
  Subscribing after the snapshot loses what prints in between; writing every
  event after it prints the overlap twice. Offsets are byte counts, so compare
  them on bytes, never on decoded text.
  A character can be split across two events: decode the bytes of one run with one
  streaming `TextDecoder` (`base64Bytes`, then `decode(bytes, { stream: true })`, and a last
  `decode()` at exit), never `atob` text per event. Script runs and the provider lifecycle
  runs do.
- `lsof` exits 1 when it finds nothing: no listener, or a pid that died between
  the two reads. The monitor reads exit 0 and 1 as success and anything else,
  or a timeout, as a failed snapshot; treating 1 as an error would show a
  broken monitor on a quiet machine.
- The webview content security policy lives in `apps/desktop/src-tauri/tauri.conf.json`
  and the dev server has none, so a scene never shows what it blocks. `img-src`
  admits `'self'`, `data:` and `blob:` and nothing remote: a preview built with
  `URL.createObjectURL` (the composer chip, the workspace chat bubble) is a
  broken box without `blob:`, with only a console error. `csp-img-src.test.ts`
  pins the rule; widen no other directive for an image.
- Three frames paint before the splash: the native window, the `index.html`
  shell, then React. Each must paint the same chrome, so `backgroundColor` in
  `tauri.conf.json` is the dark chrome (`#0e1012`, never the old gray) and the
  shell restates the `styles.css` chrome, primary and 6% cover strength as
  literals, because the stylesheet is not loaded yet. Change a token and
  `boot-shell-paints-the-chrome.test.ts` fails until `index.html` follows. The
  window is created hidden and shown by `useRevealWindow` after first paint;
  never show it in Rust setup again, or light users see dark first.
- A Rust test that writes a script and then runs it can fail on Linux with
  `Text file busy`: another test forks while the script is still open for
  writing, and the child holds that handle until it execs. The probe then
  reads "did not start" instead of the help it was meant to judge. Wait until
  the script runs before the assertion, as `runnable` in
  `providers/cli_probe.rs` does.

## History stashes are shared across worktrees

`refs/stash` belongs to the repository's common directory. Another worktree
or a terminal may push or drop an entry while a rewrite runs. History saves
and applies the exact stash SHA and verifies its unique message. It never
pops an entry or restores whichever stash happens to be first. Cleanup in
`drop_own_stash` finds the entry's index by SHA, runs `git stash drop` on it
and checks that the SHA Git printed is the one it meant to drop; if another
worktree shifted the slot, it puts the dropped entry back with
`git stash store` and keeps ours. Ambiguous entries are retained rather than
deleting a user's stash. Goodboy never writes `refs/stash` or its reflog by
hand. Ignored files
must be checked against both the current HEAD and target: stash push's
cleanup can overwrite a directory that HEAD tracks as a file, even when
the rewrite does not change that path.
`overlap_for_repo` in `apps/desktop/src-tauri/src/history/dirty.rs` also
honors `core.ignorecase` when checking these file and directory collisions.

If the shared entry disappears before verification, `find_stash` in
`apps/desktop/src-tauri/src/history/dirty.rs` searches commit objects for the
exact unique message and verifies the stash parents against the captured HEAD.
`move_branch_with` protects the verified commit in `refs/goodboy/stash/<sha>`.
The guard ref outlives a clean restore: `prune_guards` removes guards older
than 14 days (by the stash commit date) on the next job, never the one a
journal still names. A `stash pending` intent whose stash does not exist (the
push failed on an `index.lock`, or the app died before it) is rolled back by
`roll_back_intent`: the backup ref is deleted and the journal removed, so it
never blocks a later rebase, undo or plan load. `pending_stash` reads
"pending, nothing found" as none. Object discovery before the private ref
exists cannot survive simultaneous immediate Git object pruning.

The journal's seventh line is `restoring` while a restore runs and is cleared
when the restore reports a conflict or fails, so it survives only a crash
between applying the stash and recording `restored`. `bring_back` then asks
`is_restored` (no unmerged paths, untracked files byte-equal to the stash,
a stash path now changed) and finishes instead of applying twice. **Done,
forget it** (`forget_saved`) clears the journal and keeps the guard ref; a
stash whose object is gone is clearable, never an error.

`history/dirty.rs` uses Git's stash capture and cleanup command. The writer
lease covers cooperating Goodboy writers; an external editor writing during
Git's capture and reset is outside that lease. Do not treat the lease as a
filesystem write lock. Cleanup failure retains the stash instead of repeating restoration.

## New drawer actions host

The New drawer keeps the Start button in a sticky host at the end of its body (`actionsHost` in `NewDrawerBody`), not in the `DrawerFrame` `dock` slot: a dock is a footer bar and `forbidden-patterns` fails the build on it. The Run, Agent and Write panels portal their actions into that host through `Docked`, so each panel must render nothing until the host node exists. `WritePanel` lives in `features/artifacts` and reaches the drawer as the `writePanel` prop from `DrawerHost`, because `features/session` must not import artifacts components.

## The Projects tree has one current branch and one rebase source

The session rail has no level for a worktree: the open rail stays on the session level, and the row of the mount the Branch page shows (`isOpened` in `SessionLevel/WorktreeRow`, from `useBranchIdentity`, which needs an active mount or a `diffMountPath`) is the only one that draws its status line and its pages. A session with the Branch lens but no resolvable mount draws no pages in the rail at all; a test world must set `sessionActiveMount`. What you fold is remembered per branch in `goodboy:session-rail-tree-open:v1`, so clear it between tests, and a click on a row that is not current writes an open choice (`useRailTreeOpen.open`) or the saved collapse would hide the page it just opened. The pages of the current row navigate with `mode: 'replace'`, as a tab switch always did; a push there makes Back walk through tabs.

Rebase all has one source for per-branch state: the batch in the store (`rebaseAllRuns`, read through `rebaseAllBranchOf`). The row chip (`branchRowChipOf`) and the card header (`rebaseAllSummaryOf`) both read it, so do not keep a second per-branch list. A late answer lands by run id: `patchRun` drops it when the run was cleared or replaced, and Abort lets the branch in flight finish, then marks the queued ones skipped. After a branch is `rebased` the row draws no behind chip even when its git status is stale, which is why the chip reads the batch before the status.

A rebase stop in Goodboy never leaves the worktree mid-rebase: `rebaseBranch` replays on a copy, so a conflict stop has no rebase in progress and no unmerged file in the worktree. "No rebase in progress" alone therefore cannot settle a stale `Conflict`. `isRebaseStopSettled` also needs the branch head to have moved past the head the stop recorded (`HistoryStop.head`, `rebaseConflict.head`, the `head` payload of `history_stopped`), or, with no recorded head, the branch to be level with its base. `settleStaleRebases` uses only a git read that started after the record (`readWorktreeStatusRead().readAt`), so a status fetched before the stop cannot clear it. A mock scene that seeds a conflict run must give the run the same head as its worktree status, or the stop settles on mount. The one exception is **Resolve myself**: it starts the rebase in the worktree on purpose and marks the run `rebaseConflict.isHere`, which `settleStaleRebases` leaves alone (like a run handed to Auto), so the panel can still offer **Push** after `git rebase --continue` moved the head.

## A tool's health has one author

The rail dot, the folded Integrations dot, the page chip and the key-missing notice of an integration all read `toolHealthOf` (`features/integrations/toolHealthOf.ts`); a dot and a chip written separately drift. The keychain answer reaches it through `useToolSecrets` for the rail (keyed by binding id, so a late answer for a replaced binding is dropped) and `useCredentialSecret` for the page; **Check again** asks both to read again through `requestCredentialRecheck`. The Disconnect of a settings page is the header menu verb, so `IntegrationConnectedRow` takes `hasHeaderDisconnect` there and keeps its own Disconnect icon only where no page menu exists (the onboarding step, GitHub's account rows). A provider page does the same with `providerAccountChip`: it reads `providerRailStatus` with the usage window ignored, so the chip stays `Working` while the dot warns that a window is nearly used up.

## Hints when a fix starts

The hint a person types before a fix is plain text carried as a field, never re-parsed out of a prompt to rebuild it. Four rules keep it safe.

- `rulesOfKickoff` (`apps/desktop/src/features/chat/utils/resolverKickoffParts.ts`) tries every `Operator notes` marker from the last to the first and keeps the first split that matches the message, so a hint that holds the marker, a heading or a code fence still splits, and so does a comment that holds it. Do not go back to splitting on the last marker only.
- The echo **Your hint** reads the hint back from the sent message with `hintOfMessage` (`apps/desktop/src/features/chat/utils/hintOfMessage.ts`), which anchors on the fixed guidance line (`OPERATOR_NOTES_GUIDANCE`) written just before the notes. Change that sentence in one place; the golden prompt files under `__prompts__` and the echo follow it. The rewriter keeps its own `note` line and has no echo.
- A draft is cleared by `settleStartHint` only when its captured revision is still current, and only from a callback that fires when the agent's first turn started (`onKickoffAccepted` in `spawnAgent`, `onAccepted` in `spawnPushFixer` and `startHistoryRewriter`). A resolver launch counts as accepted when its batch and attempt are recorded: its kickoff drains afterwards, and a refused drain shows **Failed** with the batch hint, which **Retry** reuses.
- `analyzeFailingChecks` rejects a second call that carries a hint while the same check is being analyzed, instead of returning the running agent and dropping the hint.

## Session overview cards

- There is one overview: the cards of `CentralColumn`, in the order `overviewCardsOf` returns. An `overview.layout` row left by an older version is never read, so a stored Classic shows the cards; do not bring back a reader or a switch. The timeline of earlier versions lives in the Full log drawer (`LogPane`, view `all`).
- Three shared pieces keep their old defaults for the other callers: `buildTimelineStream` folds a batch of rebase events only with `shouldFoldHistoryBatches` (the Log drawer, view `all`), `deriveNextSteps` drops what a timeline row already offers only with `isActivityShown` (the cards pass `false` through `useNextCards`, so a Fix row offers **Push** and **Start fix**), and `useSessionSuggestionsFrom` takes the runs the column already holds. Do not flip those defaults to fix one surface.
- `batchId` is a payload key and must also sit in the whitelist of `packages/db/src/queries/session-event.ts`, or it is dropped when events are read back. It is written only for `origin` rebase while the history run is a rebase of the same session. Events recorded before it existed fold by origin and a 2 minute gap (`HISTORY_BATCH_WINDOW_MS`).
- The branch story has one reader of the facts: `branchStoryOf`. Never compute a step word, a tone or a rank in `BranchRow`. A row is named by the branch (`mount.branch`), never by the folder. The per branch card gate (`isMountBusyOf`) and the branch in card titles (`mountLabelOf`) are one rule for every overview; never add a second gate keyed on `isActivityShown`.
- A null `checks` or `reviewDecision` does not mean "not needed": it also means not read or unreadable. `branchStoryOf` skips a step only from `isChecksAbsent` and `isReviewOptional` on a fresh read, projected per host in `mountRequestOf`. Do not skip on `checks === null` alone, and a new host must set the flags only when its data proves it (see docs/mounts.md).
- `useBranchDetails` must not depend on `mountGithub` itself: `refreshSessionPrDetail` replaces the mount entry when a read starts and when it fails, so an effect keyed on that object reruns after its own read and a failing read (403, offline, the mock bridge in scenes) loops without end and pegs the page. The effect keys on mount id, PR number and PR `fetchedAt`; the store records a failed read in `mountDetailFailures` and waits 60 s per revision. Do not add a second TTL in the hook.
- A row title is one sentence cut by `firstSentenceOf` (first sentence, first step before an arrow, first done line of an orchestrator recap parsed by `parseRunSummaryText`). Any other structured text yields null and the kind fallback, never raw JSON. The full text of an agent summary goes in `detail.fullText`. The model in the step card of a Running row comes from `agentRanModels` (through `agentModelLineOf`), never from `modelOverride` or `effort` directly. A Running run row reads its gate from `useRunView`, the same `primary` as the run page, and `cardsOutsideRunningOf` drops that run's gate card (`workflow-next-step`, a run owner) from Needs you so it shows once. Only one button in the column is filled: the first Needs you row, else the first waiting run (`runLeadOf`), else the first Next row.
- The Needs you and Next cards are one `NextStackView` each, filtered by `OVERVIEW_CARD_OF_GROUP`. Their counts come from `nextRowCountOf`, the same rows the cards draw; never count rows a second way. Only one button is filled across both cards (`canLead`).

## Auto gate and screens

Auto has one gate and the legacy role grid never lists it. `AUTO_GATES.isDelegationEnabled` (compile time, read through `AutoReleaseContext` by `useIsAutoOn`) decides whether Auto exists and whether a start is Auto; there is no per person setting. An old `agents.autoExperiment` row can still sit in a database: never read it, a stored `false` must not hide Auto. `visibleAgentKinds()` stays static, so do not add `auto` to a role list to make a menu complete. A test of the role start renders under `AutoReleaseContext` false (or `SessionDraftPane isAuto={false}`).

- Delegation cards are inserted into the transcript by time: before the first user or handoff row at or after the last settle of their batch. Do not anchor them on a run id; the delegation row does not keep the run that created it.
- The approval of a plan tells Auto once. `approveAutoPlan` reads the artifact before the swap and does not send "Approved plan vN." when that version was already approved, which is what a second window sees. The swap itself is idempotent, so the read is the guard.
- `useAutoTreeActions.stop` stops the live children and the root agent turn by turn. The tree phase is written by the scheduler, not by this button; once the tree stop of the runtime exists, replace the body and keep the name.
- A mock scene that shows an Auto chat must give every agent a `lastViewedAt` after its `lastFinishedAt`; otherwise the chat marks it viewed on every render of the real store.
- A composer in a drawer never reads the session's `selectedAgentId`. In an Auto session that id is the Auto root, so a `ChatInput` that reads it shows the root's draft, queue and "running" state in a child's drawer and sends the child's message to Auto. `ChatView` passes `agentId` down and `ChatInput` threads it through `useAgentSelection`, `useTurnRouting` and `cleanupSentAttachments`; any new hook in the composer takes the agent id from there, never from the store. The pin is `ChatInput/drawerComposer.test.tsx`, and the toolbar width at the drawer minimum is the `drawer-composer` probe of `validate:scenes`.
- History: Claude refuses a Bash command holding a variable, even if the allow list names it ("A variable in this command can't be checked before it runs"). That is why the old Auto bridge confinement used an absolute path and not `$GOODBOY_BIN`. Auto no longer holds any Bash rule, but the lesson stands for any future allow rule: a read-only command such as `ls` proves nothing about confinement, because Claude allows it without a rule, so probe with a command that writes.
- An Auto child that fails to start must say why. `launchChildren` settles it with `code: message` (`kickoff_failed: <the error>`, or `agent_not_created: <the error>` when the child agent itself could not be created), never the bare code; the row and Auto's next message read that text. Do not drop `outcome.message` when you add a refusal. A `rewriter` agent needs a `historyRewriters` copy binding, so a delegated one always throws in `leaseTurnWriter`: admission refuses it instead of creating a child that can never start.
- A bridge act that publishes work (push, open or merge a request, approve, decline) must join `ACT_VERBS` in `query_bridge/auto_child.rs`, or an Auto child can call it. The refusal keys on the socket peer's pid and its parent chain, never on the run id the request carries. Only `spawn_one` records turn pids (`spawn_turn`): a new spawn path that hands a process the bridge env without `spawn_turn` makes every act from it `caller_unknown`, and one that records an Auto child as `HandStarted` leaves the bridge open to it.
- An Auto writer attempt records its online branch sha in `baseline_json.remote` only at launch (`attemptToLaunch`); a new launch path that skips it gets no watch, and `result_json.verified.remote` stays absent, which reads as "not watched", never as "unchanged". A failed read must stay `unknown`.
- A writer's changed files are the status snapshot diff plus the tree diff between its start head and its end head (`readCommittedFilesOf`). Compare trees, never commit ids: a rewrite to the same tree must list nothing, and a failed diff read must fall back to the status list, not to "no change".
- An Auto check verdict is never green unless every ticked script exited 0 on a clean tree whose head did not move (`runAutoChecks`): `unknown`, `timed_out`, a dirty tree and a moved head all read `not_checked`. A rerun refused because the head moved or the tree is dirty must leave the old verdict untouched; overwriting it would swap a real result for a statement about newer code. The rerun waits 30 minutes on the Auto bridge (`longTimeoutMs`), not the 30 seconds of Stop and Retry. The scripts run in the main window's Scripts runner and stay in its run list; a new check path must go through `runAutoChecks` so the per worktree queue serializes it.
- A publish is written in two places that must agree: `result_json.verified.publish` of the settled delegation and the same path in the envelope of its last ended attempt (`publishAct` patches both in one transaction). A plain push is never sent before the attempt settles: it is recorded as `pushing` and sent only after `claimAutoAttemptPublishStatement` proves the tree is still at that generation, not stopping and owned by this window, and a failure there must stay `completed` with a `failed` record, never fail the delegation. A force push must never reuse a lease read after the agent worked: the lease is the online sha recorded at attempt start; a lost lease is retryable only by reading the online copy again, keeping a new backup and asking for a new confirm. Before any push `executePublish` reads the online sha back, because a result that was pushed but not saved would otherwise be force pushed twice. The backup ref keeps the online sha the force push replaces, made at the settle, not at the confirm.

## Diff file body height

Each `DiffFile` body is `content-visibility: auto`, and its `contain-intrinsic-size` is `auto <estimate>px` from `features/diff/lib/bodyEstimatePx` (rows x 20 px, hunk and gap rows 28 px). A fixed estimate such as 480 px made the main diff content jump: a body above the viewport that rendered for the first time (scrolling up, or after a tree jump) took its real height and shifted everything under the reader, and the macOS webview has no scroll anchoring. Adjust the constants in `bodyEstimatePx`, never a per-file class. The estimate is not the whole fix: wrapped long lines and threads still miss it, so `DiffView` also runs `useScrollAnchor` on its file cards (see "Scroll anchoring in the webview"), held while `anchorTo` snaps a picked file to the top. jsdom has no layout, so the test pins the estimate; the real check is a long multi-file diff scene, scrolled up.

## Scroll anchoring in the webview

`overflow-anchor: auto` does nothing in the macOS webview (WKWebView) or WebKitGTK: WebKit keeps CSS scroll anchoring behind a flag. Any long scroller whose rows change height above the reader (`content-visibility` rows, images that load late, rows inserted above) needs `useScrollAnchor` (`shared/hooks/useScrollAnchor`), today the chat transcript and the diff. Never add the CSS property back as the fix: the hook sets `overflow-anchor: none` itself, because WebView2 on Windows is Chromium and would compensate a second time. A new smooth `scrollTo` or `scrollIntoView` on such a scroller calls the hook's `suspend()` first, or the first compensation cancels the smooth scroll halfway. A settle loop that snaps the view (the diff's `anchorTo`, the chat's bottom pin, the reveal hold at an answer top) passes `shouldHold`, or the two fight for `scrollTop`. In the chat that is `isHolding` from `useScrollPin`, true while the view is pinned to the bottom or held at a revealing answer, so one of the two owns `scrollTop` at any moment and a frame never gets two writes. An answer that grows below the reader is not a change above it: the anchor row's top does not move, so the hook shifts nothing. A row estimate still matters with the hook: the content stays still, but every estimate error changes `scrollHeight`, and the overlay thumb resizes and slides.

## Live mark for the text reveal

The text reveal animates only text that came through `readTurnStream` in this window. `liveTextRegistry.mark` is called there and nowhere else: `appendTurnEvent` and `bufferTurnEvent` also run for a Cmd+R re-attach replay and know nothing about their source, so marking in them would write in a replayed answer word by word. The mark is keyed by run id, not item key, because the stored event has no item key; a host decides at mount time, and a text that was not live at mount grows live only when the registry is live again. The 1.5 s live window is the lag cap in `revealNumbers.ts`: a host that mounts later shows the text whole.

## The reveal hold in the chat scroll

A revealing answer is found by `[data-reveal-answer]` in `useScrollPin`, and the hold at its top is tracked in refs (`isAnchoredRef`, `isLockedRef`, `ownTopRef`), not in state. Three things break it. A scroll write that does not go through `applyFollow` is read as the reader's: `ownTopRef` is how `onScroll` tells the two apart, so never assign `scrollTop` elsewhere in the pin. A reader who reaches the bottom while an answer is revealing sets the lock, and the lock only clears once no revealing answer is in the DOM; without it the follow would pull the view back up to the answer top. And a row that carries `data-reveal-answer` must clear it when its reveal ends, or the hold never lets go: derive it from `isRevealing`, never set it by hand.

`freshenNode` clones the last block's element tree with its children spread (`cloneElement(node, undefined, ...children)`); passing the array as one child makes React ask for keys on the static children and the console guard fails the test. A fresh span key is leaf index plus the piece start, so a span keeps its fade across frames only while it stays in the same parent.

A fresh span exists only while the block is the last one and its piece is alive. A table row fades with a delay, so its piece must outlive the delay: `pieceLifetimeMs` adds the stagger to the fade, and the pacer holds the next words for that time. Change the stagger or the row cap in `revealNumbers.ts` only; a delay longer than the piece lifetime would show the row at full opacity before its fade starts.

## Partial output writes a text twice if the whole line is not dropped

With `--include-partial-messages` (Claude) the same text arrives as `text_delta` stream events and again as the whole `assistant` line; Cursor with `--stream-partial-output` does the same with timestamped lines and a line without a timestamp. `takeStreamedBlock` drops the whole block only when it is contained in the text still pending in `ctx.streamedText`, so a CLI that changes the final text (trimming, a different join) shows it twice. `ctx.streamedText` resets on `message_start` and `result`, never between a delta and its whole line. The flag is added by `partial_output_args` after the probe, not by `turn_args`, so `turn_args` tests stay pure and a fake CLI must list the flag in its `--help`. `queueTurnEventInsert` merges the stored deltas by agent and run and writes the held text before the next event of that agent, so a new event kind needs no special case, but a path that writes `turn_events` without it would reorder text.

## Codex needs the own git folder of a linked worktree, not only the common one

A session worktree keeps its index, `HEAD` and `rebase-merge` in `<repo>/.git/worktrees/<name>`, outside the worktree folder. Codex in `workspace-write` still refuses writes there when only `<repo>/.git` is an `--add-dir` root: a commit fails on `index.lock` and a rebase on `rebase-merge` with "Operation not permitted". Adding the per-worktree folder too makes both work (checked with Codex 0.162.1). `buildTurnWritableRoots` takes `worktreeGitDirs` from `worktree_git_dir` for every writable mount; the common folder stays, because refs and objects live there. A new place that hands a writer its roots calls `resolveTurnWritableRoots`, never rebuilds the list.

## A read-only Cursor run needs `--trust`, a writer needs `--force`

`cursor-agent` 2026.10.22 and later asks for workspace trust in headless mode and the turn ends with "Workspace Trust Required" unless the argument list has `--force` or `--trust`. `turn_args` and `side_job_args` stay pure and never carry `--trust`; `workspace_trust_args` adds it after the probe, like `partial_output_args`, so a fake Cursor CLI must list `--trust` in its `--help` and a new Cursor spawn site must call it. Never replace `--trust` with `--force` on a read-only job: `--force` grants shell and write rights.

## Hover card triggers

- A `FactCard` or `Tooltip` trigger must be a DOM element that takes a ref, pointer handlers and `aria-describedby`. A component wrapper drops them silently and the card never opens; spread the span props onto the element (`TimelineRunGlyph`) or wrap a native element.
