# Traps in the store and session state

> **Read this when** you change a store selector, a derived fact, a send, an
> attention count, the session overview or a list written out by hand.
> **Not for** the selector rules ([../typescript/selectors.md](../typescript/selectors.md))
> or how a write names its target ([../typescript/state-writes.md](../typescript/state-writes.md)).

## Selectors and derived facts

### `stageInfoOf` reads only the state it is given

It is kept per session and re-derived only when a recorded read changes, so a value from a module variable, the clock or `useAppStore.getState()` goes stale silently ([state-writes.md](../typescript/state-writes.md#7-derived-facts-are-kept-per-session)).

### A store helper named `select*` is not always a safe selector

`selectWritableMounts` maps `sessionMounts` through `toProjectMounts`, so it and its helpers (`selectMountForPath`, `selectMountById`, `selectActiveMount`) return new objects on each read once mounts load; `selectSessionForPr` builds its match object too. Subscribing to one re-renders forever and crashes with React #185. Select a primitive (`?.mountName`), use `useShallow`, or read `useAppStore.getState()` in the handler; split any object-building selector (`{ project, stage }`) into fields.

A mocked-store unit test misses it. The mock scenes and `apps/desktop/src/__tests__/surfaces/primary-surfaces.test.tsx`, which mounts the main surfaces on the real store, catch it, and `navigation-flows/` beside it clicks into every page.

### A plan's run is found by its link

`planOwnerOf` uses `plan.workflowRunId`, else the planner agent's `workflowRunId`, never the next step of the run's workflow. An orchestrated run creates its next step later, so a template lookup is empty right after Approve and the plan falls back to **Run plan**, **Ready to run** and **Start implementer**. Ask `planOwnerOf` and `planHandoffOf`; do not rebuild the predicate.

### Stored paths are absolute

Every stored project or session path (`projects.root_path`, `session_worktrees.worktree_path`, `retained_worktree_paths`, `worktree_roots`, `resolve_*`, `skills.file_path`) is absolute. Normalize (trailing slash, symlink) before comparing two, and never take a folder that no longer resolves as lost data ([architecture.md](../architecture.md#moving-a-projects-folder)). `project_relocate` rewrites every one of those tables by prefix in one transaction; a table missing from its list brings the bug back.

### The Storage verdict has two owners

Rust decides `safe`, `dirty`, `writing`, `operation`, `not-tracked` and `unavailable` (`folder_verdict`). The live terminals are the store's `terminalTabs`, which Rust cannot see, so `storageFolderStatus` turns `safe` into `terminal-open` when `terminalsInFolder` finds a shell. Never recompute the Rust half from `reasons` in TypeScript or move the terminal half to Rust. Every count of safe folders goes through `summarizeStorage` with the same terminal map.

### A tool's health has one author

An integration's tile word, door dot, page head and Key missing chip all read `integrationKeyChecks`, written by `checkIntegrationKey`; a reader of the keychain drifts. A tool page's Disconnect is the header menu verb, so `IntegrationConnectedRow` takes `hasHeaderDisconnect` there and keeps its own icon only where no page menu exists (the onboarding step, GitHub's account rows). A provider page's `providerAccountChip` reads `providerRailStatus` with the usage window ignored, so the chip stays `Working` while the dot warns of a nearly used window.

### `RoutingPicker` hands the whole route in one call

`RoutingPicker.onChange(route)` carries provider, model and effort. Split into several callbacks in one event, a mount builds the second patch from stale props and writes the old provider back: Cursor then Opus 5.5 on a workflow step kept the old provider, persisted by `step_def_upsert` into `step_library`. A mount applies one patch, never reads the provider from a ref, and never infers it from the model id (`getModelProvider` picks one provider when several share an id).

The route's effort is clamped to its model, and the `effort` a mount hands the picker is what the user saw; neither is the stored effort. To ask "did the pick change the effort", compare with the stored or requested effort: against the clamped one, a saved Max shown as High on Sonnet stayed Max on the Opus the user picked.

## Runs and steps

### Not finished is a skip that carries a summary

A step that did not finish is `skipped` with a reason in `outputSummary`; a `not_finished` status would need a migration. The row word, the "without step N" notes, the end line and the two-in-a-row stop read `notFinishedKindOf`. Never write `outputSummary` on a step the user skips, and never read plain `skipped` as "did not finish". A step stopped by "Every step" or the two-in-a-row rule is `blocked` with no reason; the agent page holds it in the transcript.

### A scout fan-out parent joins every ended child

An ended child is `completed`, `failed`, `skipped`, `blocked` or `stopped` (`TERMINAL` in `store/slices/workflows/scoutTree.ts`). A blocked or stopped child never reaches `advanceScoutTree`, so the code that blocks or stops it calls `joinFanOutParent`, or the parent waits forever. The consolidation prompt names each child's status. `stopped` is published only after `cancelTurnConfirmed`, and the join waits while a child's turn is `running` or `blocked`.

### A turn-end read waits for a question or a split

A `finalizeTurnStream` step that reads the database every turn shifts the orchestrated-run story tests, and the next test fails on a foreign key. `routeQuestions` and `isFanOutRejected` read only when the reply holds a question or a split; keep any new read behind such a condition.

## Sends and attention

### A send writes its row before it delivers

`sendAgentMessage` saves a queued row, then delivers it with the `queue:<id>` delivery id, which is what makes a reload, a drain after load and a crash replay send it once. Add no second composer path to `sendTurn`, and never clear the row before `onStarted`. `drainAgentQueue` refuses while any row of the agent is `sending`, so a send and a drain never race.

A `user_text` with the delivery id is not proof alone: `startTurnRun` saves the row's `writtenTexts` first, and only a count above it means delivered. Keep the `user_text` after the first start check. `sendTurn` resolves at turn end, so answers, plans and a released stop are marked in `onStarted`, which fires after `turn_spawn` resolved: a failed spawn, an early Stop or a build throw fire nothing and the caller keeps its work, and a later rejection still counts as delivered.

`flagUndeliveredAnswers` reads open questions, answered ones and agents, so `useSessionWorkLoads` calls it once all three landed.

### Banner clicks reach every window, and the badge has one writer

The notification plugin reports a click to every window, so each filters on the banner's workspace id. When no window shows it, `main` comes forward first, so a minimized window never switches unseen. Clicks reach the app only for notifications shown after the first listener, which `useAwayAlerts` registers on mount.

Banners, bell rows, toasts, Notifications rows and palette sessions go through `openAttentionTarget`. For another workspace it writes a pending target (`attentionTargetChannel`: local storage plus a Tauri event) and opens it, and the window that shows it lands the target once its board is ready (`useAttentionTargets`).

- `landAttentionTarget` opens the place only while the reason holds; a stale, archived or deleted target says **Already handled** and opens the session when it can.
- Right after a fresh open (`isFreshOpen`) it skips that check: request, resolve and workflow facts arrive after `boardReady`, so a check would call a live failed check handled.
- A notification that carries `place` (reason, mount, note or comment) instead of a `reason` uses `landExactPlace`: no check, request data loaded before a Checks or Comments tab, the place computed again, and the landing dropped if a newer tap or workspace switch came first.

Only `main` writes the dock badge, one number for the app, and clears it on unmount; a second writer flickers between workspaces.

### Two counts for one workspace, and the Rust count is a subset

`workspaces_attention` (`attention.rs`) counts only what is saved: an open question, a fix run waiting for an answer, a failed push, failing checks, an errored session. It follows `deriveSessionStage`: a running session counts for a question or an error, not a failed push or failing checks. It reads the `state_kind` that `deriveSessionState` wrote at the last agent end (the error of a slot nobody re-ran stays, the error of a re-run slot is cleared, and `repairErroredSessions` fixes an old row at launch), and a branch the same SQL finds settled drops an error that predates its latest known merge. A waiting permission or plan, a stopped run, an Auto agent and a Slack reply live in memory, so an unshown workspace can read lower than its door.

The showing window sends the exact count on `goodboy:attention`, and `attentionByWorkspaceOf` takes it only while `windowPresence` says a window shows the workspace. A closed window's old report never hides the database count, but a showing window's zero does hide a count that is behind. The dock badge is this window's count plus `useAttentionElsewhere`, never the sum of the map.

`src-tauri/src/attention/parity.json` is the one source: `build.rs` generates the Rust `REASONS` table from `reasons`, and the Rust test and `attentionParity.test.ts` read its cases. A new reason is a row there and a case in both. `items_of` in `attention.rs` maps rows by position, and a compile-time length check fails until it follows.

### A settled branch hides only what its times prove

`isSettledOf` and the Rust clause drop an error, a stopped run or a reply only when its time is before the merge time. A closed request has no time (its `updatedAt` moves on every refresh, so it would hide a failure that came after the close), a Bitbucket merge has none, and a stopped run's time is the latest of its agents. Where a time is missing the reason stays. Do not fill a missing time with `updatedAt` or `now`.

A write refused because another run owns the session (`writeOwnedSessionState`) leaves a stale `error` that the Rust count shows until the next agent end or the next launch repair. The read side still derives from the agent rows.

## Session overview cards

### There is one overview

It is the cards of `CentralColumn`, in `overviewCardsOf` order. An old `overview.layout` row is never read, so a stored Classic shows the cards; bring back no reader or switch. The timeline is the Activity page (the `activity` lens, `ActivityPage` around `LogPane`, view `all`); the Overview keeps its last three rows and `session.openLog` opens the page. There is no Log drawer: a stored `session-log` panel opens the Overview (`withoutRemovedPages`).

### `buildTimelineStream` is a folder of pieces

It lives in `features/session/timeline/buildTimelineStream/`, and callers import `from '.../buildTimelineStream'`. `index.ts` holds only the entry points (`buildTimelineStream`, `buildRunTreeStream`) and re-exports; each kind of row, the folds, the order (newest first, then a run's execution order) and the decorations have a file of their own, with tests beside them. A rule about one kind of row goes in its piece, never into `index.ts`.

### A large session must open fast

A session of 171 agents and 15,937 turn events froze the Overview. Opening reads summaries, never every turn event: `listAgentRunIdsForSession` returns one row per agent run, and its test bounds the rows. The Log mounts after the frame (`useDeferredValue` in `LogPane`) and draws `LOG_PAGE_ROWS` at a time.

`CentralColumn.bigSession.test.tsx` guards the 100 ms long-task target with work bounds, since wall clocks vary with load: no log rows in the first frame, one page after settling, at most six React commits and 30 IPC calls on open. `timelineFullGutterOf` takes one stream built with `shouldExpandEveryGroup`; never rebuild per found group. Measure in the test and the `u47-big-session-*` scenes before adding first-render work.

### Three shared pieces keep their old defaults

Do not flip them to fix one surface:

- `buildTimelineStream` folds rebase batches only with `shouldFoldHistoryBatches` (the Overview log, view `all`).
- `deriveNextSteps` drops a check fix follow-up and a run's next step only with `isActivityShown` (the default, for the palette's Next group). The cards pass `false` through `useNextCards`, so the Fix card offers **Push** and **Start fix** like the branch header's `checkChainActionOf`; no log row does.
- `useSessionSuggestionsFrom` takes the runs the column already holds.

### `batchId` is whitelisted

The payload key `batchId` sits in the whitelist of `packages/db/src/queries/session-event.ts`, or reading events back drops it. It is written only for `origin` rebase while the history run rebases the same session. Older events fold by origin and a 2 minute gap (`HISTORY_BATCH_WINDOW_MS`).

### The branch story has one reader

`branchStoryOf` reads the facts; `BranchRow` never computes a step word, tone or rank. A row is named by `mount.branch`, never the folder. `isMountBusyOf` (the card gate) and `mountLabelOf` (the branch in titles) are one rule for every overview; add no second gate keyed on `isActivityShown`.

### A null check is not "not needed"

A null `checks` or `reviewDecision` can mean unread or unreadable. `branchStoryOf` skips a step only on `isChecksAbsent` or `isReviewOptional` from a fresh read, projected per host in `mountRequestOf`, never on `checks === null`. A new host sets the flags only when its data proves them ([../mounts.md](../mounts.md)).

### `useBranchDetails` keys on ids, not the mount entry

`refreshSessionPrDetail` replaces the mount entry when a read starts and fails, so an effect keyed on `mountGithub` reruns after its own read, and a failing read (403, offline, the scene mock bridge) loops and pegs the page. The effect keys on mount id, PR number and `fetchedAt`; the store records failures in `mountDetailFailures` and waits 60 s per revision. Add no second TTL in the hook.

### A row title is one sentence

`firstSentenceOf` keeps the first sentence, the first step before an arrow, or the first done line of a recap parsed by `parseRunSummaryText`. Other structured text yields null and the kind fallback, never raw JSON; the full summary goes in `detail.fullText`. A run step's model comes from `agentRanModels`, never `modelOverride` or `effort`. `cardsOutsideRunningOf` drops a running run's gate card (`workflow-next-step`) from the board so the gate shows once.

### Board row counts come from the rows drawn

`nextRowCountOf` counts the rows the board draws; never count a second way. Only one board button is filled.

## Hand-maintained lists the compiler does not check

Each is a list written by hand beside an exhaustive type. A new type member forces new switch cases, never a list entry, so a missing member compiles and fails silently.

| List                                                             | A missing member                                                                                                                                                                        |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ALL_ISSUE_PROVIDERS`, `CREATE_SESSION_PROVIDERS`                | drops out of mobile issue queries and session creation, while the `never`-checked `WorkspaceIntegrationProvider` switches (`fetchIssuesFor`, `resolveIssueForSession`) ask for its case |
| `PROVIDER_PRIORITY` (pull-request providers, review target pick) | drops out of availability counts and fallback selection                                                                                                                                 |
| `VALID_SORTS`, `VALID_GROUPS` (saved session-list preferences)   | reads back invalid and is overwritten by the default                                                                                                                                    |
| `SIMPLE_LENSES` (lenses that work without a branch)              | is hidden or cleared for sessions with no branch                                                                                                                                        |

### The bell sweep names its proof per family

`settleStaleNotifications` marks a row read only by a proof written for its family: the three helper notices, a `continue-agent` row whose agent completed after it, a `retry-action` row older than the process launch stamp, a session archived or deleted, a newer unread duplicate of one key, and one first pass for errors and warnings older than `FIRST_PASS_BEFORE_MS` and than the launch. Never add a rule by session ("a later agent completed") or by a settled branch: a push, a branch clean-up, a sign-in, a budget and any unknown family stay unread, because a clean-up fails after the merge by definition. The first pass has no stored flag, so it runs on every load and reads again a row older than its cutoff that you marked unread; remove `FIRST_PASS_BEFORE_MS` once the release that ships it is two minors old. A standing rule does the same for a dead retry and an archived session: Mark as unread holds until the next load. The bell number counts SQL buckets (`notificationBadgeOf`), which count rows, so it equals the groups only because a key keeps one unread row.

### The `auto` role stays out of every list a person sees

`auto` is in `AgentRole` and every exhaustive map, and out of `SELECTABLE_AGENT_ROLES` (all its `ROLE_REGISTRY` flags are `false`), `DEFAULT_GROUPS`, `GUIDANCE_ROLES` and the Context drawer chips (`ALL_ROLES` in `roleVisibility.ts`). Never add it to complete a list: Auto has its own gate ([auto.md](auto.md#auto-gate-and-screens)).

### The Auto writer roles are written three times

`AUTO_DELEGATION_ROLES` (`packages/core/src/auto/roles.ts`) and `READ_ONLY_ROLES` and `WRITER_ROLES` in `providers/cli_args.rs` name the same ten roles. `the_writer_roles_match_the_auto_writer_roles_of_core` reads `AUTO_WRITER_ROLES` from the TypeScript and fails when the writer lists differ; the read only list has no test and also holds `auto`. A role missing from both Rust lists runs read only. The `auto_delegations` role CHECK (m232) is the third copy, so a new role needs a table rebuild: change all three. A role outside the TypeScript list is rejected by `parseAutoDelegationRole`, never passed to `normalizeAgentRole`, which would make it the Generalist.
