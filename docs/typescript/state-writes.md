# State writes

> **Read this when** you write a store action, a navigation address, a loader,
> an undo or a retry. **Not for** how to declare a type
> ([data.md](data.md)) or how to write a test ([../testing.md](../testing.md)).

Six rules cover the review findings that come back most often. Each has a
helper or a pattern, and a test that shows it working. The rules card in
[AGENTS.md](../../AGENTS.md) (rules 12 to 16) points here.

## 1. A write names its target

A write takes the workspace, project or mount it acts on from its own request,
never from "the current one". Reading `currentWorkspaceId`, `diffMountPath` or
the active mount inside a store action after an `await` can name a different
target than the one the user clicked.

- The workspace of a session comes from the session (`session.workspaceId`).
- A navigation address that writes carries its mount. `canonicalLocation`
  fills nothing: `branchPlace({ sessionId, mountPath })` and
  `lensPlace({ state, sessionId, lens, mountPath })` take the mount from the
  caller. A caller that acts on mount B passes B. A page door that opens on
  "the mount you are looking at" lets `lensPlace` read it once, at the moment
  of the click, through `doorMountPath` (the mount on screen, else the active
  one, else the first).
- A request with no mount stays without one: the page resolves it when it
  renders. Back and a reload never move the write destination, whether the
  address names a mount or not: the page shows the mount of the address and
  writes go where the write destination says, and a confirm names its repo.
- Guard: the `ambient-target` ratchet counts those reads inside
  `store/slices/**` and `store/runtime/**` and only falls. `ambient-target-session`
  does the same for `currentSessionId`, `selectedAgentId` and `activeProjectId`
  (89 reads in 40 files today). `optional-mount-param` counts every `mountId?:`
  in a store file (45 in 43 files today): a write verb takes the mount it acts
  on as a required `mountId`, and a helper that reads may keep an optional one
  until its caller names the mount. All of them live in
  `store-writes-hold-the-line.test.ts` and only fall.
- Test: `__tests__/surfaces/navigation-flows/target-identity.rows.tsx`, rows
  "view mount A, act on mount B".

## 2. Commit after confirm

State changes only after the async step succeeded. A failure leaves the old
state and shows the error.

- Helper: `commitAfterConfirm({ get, failureTitle, target, step, commit })` in
  `store/runtime/state-writes/commitAfterConfirm.ts`. It runs `step`, calls
  `commit` with the result only on success, reports a failure through
  `reportError` (on the `target` session or workspace) and returns
  `{ isOk: true, value }` or `{ isOk: false, error }`. An error that was already
  shown (`ReportedError`) is not reported twice.
- `usePendingAction` is the UI half: it tracks the pending keys and disables
  the control.
- A bare `.catch(() => undefined)`, `null` or `{}` hides the failure. The
  `catch-swallow` ratchet counts them and only falls; `catch-return` counts
  a `catch` block that only returns (49 today), and `set-before-await` counts
  the store files whose first `set(` comes before their first `await` (111
  today, a file-level heuristic). Both only fall.
- In use: `pinPort`, `unpinPort`, `hidePort` and `unhidePort` in `store/slices/monitoring/`.
- Test: `commitAfterConfirm.sqlite.test.ts` (nothing committed while pending,
  nothing committed on failure, the error stored on the target).

## 3. Latest only

A response applies only while it is the answer to the newest request.

- Helper: `createLatestOnly()` in `store/runtime/state-writes/latestOnly.ts`.
  One instance per loader; `run({ key, request, apply })` takes a token per
  key and drops a late result as `'stale'`. A stale failure is dropped too;
  the latest failure is thrown. `cancel({ key })` invalidates a pending request.
- `claim({ key })` takes a token without running anything and returns
  `isCurrent()`, for a loader that applies several fields in one `set`.
- In use: `refreshMonitorSnapshot` in `store/slices/monitoring/`; the run of a
  registry button in `features/actions/useActionControls` (a finish after the
  `scopeKey` changed is dropped, outcome and failure alike); `sessionReads` in
  `store/runtime/state-writes/sessionReads.ts`, one sequence for the plans and
  one for the artifacts of each session, shared by every loader that writes
  `sessionPlans` or `sessionArtifacts`. A new loader of either claims right
  before its read and applies only while `isCurrent()`.
  `selectAgent` in `store/slices/agents/` claims one token per agent for its
  two transcript reads and drops either answer, or a failure, once a newer
  open of the same agent started.
- Worked example: `setCurrentWorkspace` in `store/slices/workspaces/`. It
  claims one token per switch, reads everything first, and checks `isCurrent()`
  after each await. Only then does one `set()` clear the old workspace and fill
  the new one, so a failed read rejects and leaves the old workspace on screen
  for the caller to report with a retry. A switch that lost to a newer one
  returns without writing.
- Test: `setCurrentWorkspace.test.ts` (a late answer for an older workspace is
  dropped, a failed read keeps the old workspace, the retry switches);
  `latestOnly.test.ts` (a newer request wins, tokens are per key, a stale
  error is dropped, a claim loses to a newer one);
  `store.sqlite-auto-plan-consumed.test.ts` (a late session load and a late
  Auto refresh are both dropped).

## 4. Two writers compare and swap

When two windows or two processes can write the same setting, read the old
value and write only if it is still the old value.

- Pattern: `replaceSettingIfUnchanged` and `insertSettingIfAbsent` from
  `@goodboy/db`, as in `store/slices/session-pins/changeSessionPins.ts`. A lost
  race reads again and tries once more; after the second loss it returns
  `null` and the caller reports, it never overwrites.
- Test: `packages/db/src/queries/settings.test.ts` (the swap only writes when
  the stored value still equals the expected one).

## 5. Undo and retry carry their own target

An undo entry is a store operation that holds the ids it acts on. It is never
a component setter, which is gone when the component unmounts. A retry resends
the text and target of the request that failed, not whatever the composer
holds now.

Every retry, undo and resume path gets three tests:

- the state changed since the entry was made;
- the outcome was uncertain (the write may or may not have landed);
- part of it succeeded.

A create is retry-safe by asking the host first: `createPrForSession` and `createMrForSession` adopt the request that already exists for the branch and return the opened number with a warning when only the bookkeeping failed (`createPrForSession.test.ts`, `createMrForSession.test.ts`: uncertain outcome, state changed since, part succeeded).

Example of an undo that holds its own rows:
`store/slices/notifications/notificationUndo.sqlite.test.ts`.

## 6. One owner per number

A count, a total or a label on screen comes from one function. A second
computation drifts. A write path and its read path get one round-trip test:
write through the action, read through the selector the screen uses, compare.
