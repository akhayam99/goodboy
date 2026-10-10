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
  renders, and Back never moves the write destination.
- Guard: the `ambient-target` ratchet counts those reads inside
  `store/slices/**` and only falls.
- Test: `__tests__/surfaces/navigation-flows/target-identity.rows.tsx`, rows
  "view mount A, act on mount B".

## 2. Commit after confirm

State changes only after the async step succeeded. A failure leaves the old
state and shows the error.

- Helper: `commitAfterConfirm({ get, failureTitle, target, step, commit })` in
  `store/slices/state-writes/commitAfterConfirm.ts`. It runs `step`, calls
  `commit` with the result only on success, reports a failure through
  `reportError` (on the `target` session or workspace) and returns
  `{ ok: true, value }` or `{ ok: false, error }`. An error that was already
  shown (`ReportedError`) is not reported twice.
- `usePendingAction` is the UI half: it tracks the pending keys and disables
  the control.
- A bare `.catch(() => undefined)`, `null` or `{}` hides the failure. The
  `catch-swallow` ratchet counts them and only falls.
- Test: `commitAfterConfirm.sqlite.test.ts` (nothing committed while pending,
  nothing committed on failure, the error stored on the target).

## 3. Latest only

A response applies only while it is the answer to the newest request.

- Helper: `createLatestOnly()` in `store/slices/state-writes/latestOnly.ts`.
  One instance per loader; `run({ key, request, apply })` takes a token per
  key and drops a late result as `'stale'`. A stale failure is dropped too;
  the latest failure is thrown. `cancel({ key })` invalidates a pending request.
- Test: `latestOnly.test.ts` (a newer request wins, tokens are per key, a stale
  error is dropped).

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

Example of an undo that holds its own rows:
`store/slices/notifications/notificationUndo.sqlite.test.ts`.

## 6. One owner per number

A count, a total or a label on screen comes from one function. A second
computation drifts. A write path and its read path get one round-trip test:
write through the action, read through the selector the screen uses, compare.
