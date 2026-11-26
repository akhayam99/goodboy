# Pushing from the Branch page

> **Read this when** you change how the Branch page pushes: `Push N fixes` and its preview, the push banner, the rebase job banner, a failed push and its fix agent, stale dependencies or the worktree setup line. **Not for** which step the header shows ([branch-page.md](branch-page.md#the-one-step)) or the rebase on Commits ([branch-commits.md](branch-commits.md)).

Push, Publish and Retry go through the publish machinery: a frozen preview pinned
under the session head, drift, and the result per thread. Only the header pushes
everything: a thread has no Push, Push again or Sync button.

## Push N fixes

`Push N fixes` counts every accepted thread (the opened one never narrows it), and
one click prepares the preview.

1. **A clean preview** (no blocker, no drift, a publication, no earlier commit that
   is not a fix) pushes at once: the button shows `Pushing N fixes`, and the outcome
   is one dismissible line under the header (`Pushed 6 commits to origin and posted
6 replies on GitHub.`).
2. **Any other preview** opens the panel (`PushBanner`), which holds the only
   `Push`. The header button becomes its toggle (`aria-expanded`): a second click
   closes the panel and cancels the prepared publication, and it never pushes while
   the panel is open.
3. **A `stale` answer** reopens the panel with one line saying what changed
   (`driftSentence`).

- An accepted thread offers `Push only this one` in its action bar
  (`preparePublication` with `isolated`, `isolatedPushOf` unchanged), hidden while
  the panel is open so one Push shows at a time. The panel lists every commit that
  goes out, oldest first, `Not a fix` on earlier ones, under a title counting them
  all (`pushCommitCount`).
- A preview that is left (unmount, navigation, Cancel, a `missing` answer) is closed
  as cancelled in the database; `missing` says `The push was already handled or
cancelled. Nothing changed.`
- `Publish N replies` and `Retry N` stay the primary of their state; a blocked
  primary stays visible, disabled, with its reason.
- The `Push` row of `Branch actions` takes the header's route (`pushFromMenu`): with
  an accepted fix waiting it is the review push, so the replies go with the commit.

## The banners

**The push banner** (`PushBanner`, the only push one) sits in the page's `lead`,
pinned under the session head above the title, so it never scrolls or steps away.
**The rebase job banner** sits under it (`JobBanner`, `features/history/JobBanner`):
one strip for a rebase on main, on every tab.

The job banner reads the branch's stop (`rebaseStopOf`, through `useRebaseStop` and
`selectRebaseStop`): the run in `historyRuns` while this window has it, else one
rebuilt from the latest open saved `history_stopped` event and a git read requested
after it (an older read is ignored). The run is never saved, so after a restart, a
reload or in a second window the banner, the rail prompt and the mount actions read
the same rebuilt stop; never local state.

A stopped rebase is one panel (`RebaseStopPanel`, a `Notice` banner): what stopped,
the files or the new online commits, and one row of verbs with one filled primary
and no Dismiss while the stop blocks the branch (`useJobBannerActions`).

- A failed verb keeps the panel with its error and Retry, per branch, named with the
  branch when the session has several; a verb running on one branch never locks
  another.
- A rebase in progress with no Goodboy stop (started in a terminal) draws one row,
  `GitRebaseRow`: Continue rebase, Open terminal, Abort rebase.
- Other states keep the strip: Stash and rebase, Restore stashed files, Undo rewrite,
  Retry with a note, Open providers, Open transcript.
- The conflict prompt is in [branch-commits.md](branch-commits.md#rebase-on-main).

## A failed push

After a rebase a failed push offers:

1. **`Fix with an agent`**, the primary: an Implementer on that worktree briefed with
   the command and git output (`fixPushWithAgent`), which commits the fix and never
   pushes; Goodboy then pushes again with the same lease (`settlePushFix`).
2. **`Open in Terminal`**: the session terminal drawer at the worktree with the exact
   push typed, not run (`openSessionTerminal` with `prefill`).
3. **`Retry push`**.

While the agent works the panel stays (`fixing-push` is a stop panel state) with the
push fix line, Stop and Open transcript, and no Retry push.

The same two actions sit beside Retry on the header Push and Force push failure line
(`PushFailureActions`, when the error is a push failure, `pushFailedError`):

- the agent is `fixBranchPushWithAgent`; its finish runs `settleBranchPushFix` (a
  plain push, or a force push with the lease read before the agent started and the
  commits the confirm named);
- the terminal is `prefillBranchPushTerminal` (`git push`, or `--force-with-lease`
  pinned to the remote sha the confirm showed, `PushFailedError.confirmedRemoteSha`;
  when origin moved since, nothing is typed and the header says `Origin changed.
Check again before force pushing.`), always in a new tab;
- a retry that pushed clears the failure line (`settledBranchPushes`).

**The cause is kept.** `git_push` returns stdout and stderr with credentials and home
paths masked (`redact_output`); `pushOutputOf` joins and bounds them (head plus the
git verdict); `pushFailureDigest` reads the failing hook or command and the first
findings `PushFailureBlock` shows on the failure card, the Comments banner and the
create form.

## The push fix agent

`Fix with an agent` (`PushFixAgentAction`) calls `fixBranchPushWithAgent` with
`pending`, the work waiting on the push (a failed publication's replies,
`pendingPublicationBrief`, or the pull request text being created), which the brief
tells the agent not to do itself, and never to skip a hook.

1. The action tracks the agent and hands the store its continuation (`onSettled`, in
   `pushContinuations` by mount).
2. When the fix pushed, `settleBranchPushFix` runs it from the store, once, wherever
   the user is: the banner re-arms the publication (`retryAfterFix`), the create form
   creates again with the latest text of the screen that registered it.
3. A continuation may return what it did (`PushFixFollowUp`: `Pull request #318 is
open.`, `The fix is pushed. Nothing else is waiting.`, or why it failed).

A retry that finds nothing new while the last publication failed on its push shows
that failure, never `Nothing is waiting for the push` (`failedPushPublication`).

### The card does not need to stay mounted

- A branch's fix is kept in the store (`branchPushFixes`) and its result in
  `pushFixOutcomes` by mount (`pushed`, `agent_failed`, `agent_stopped`, or
  `push_failed`, with the reason and follow up), both written through to browser
  storage (`pushFixMemory`, six hours, read at store start), so a reload keeps them.
- `pushFixStateOf` reads one answer from them and the saved agents, so a running
  `Fix the push` agent is found again even when the window forgot the fix:
  `working`, `pushed`, `stopped`, `failed` or `none`.
- A result nobody took (pushed while no continuation was registered) is claimed once
  by the first surface that mounts with a continuation (`claimPushFixOutcome`), the
  claim held in memory (`pushFixClaims`). `completePushFixOutcome` marks it taken and
  records the follow up only after the continuation returned, so a mid-flight reload
  resumes it; a continuation that throws releases the claim (`releasePushFixClaim`)
  and reports the error.
- A new fix clears the old result, and the line can be dismissed
  (`dismissPushFixOutcome`).

### One status line

Every push surface draws the state with `usePushFix` and one line,
`PushFixStatusLine` (`features/history/pushFix/`, on `ItemWorkLine`):

| State   | Line                                                                           |
| ------- | ------------------------------------------------------------------------------ |
| working | Fixing, the agent's step and active time, Stop and Open transcript             |
| pushed  | Pushed, the follow up, Open transcript                                         |
| stopped | Stopped ("Nothing was pushed; its edits stay on the branch."), Open transcript |
| failed  | Failed, the reason, Open transcript                                            |

- On the header's push failure card (`usePushFailureSlots`) the line sits under Push
  failed, above the hook output. While the agent works the card has no Retry, no hint
  box and no Fix with an agent; after Failed or Stopped the agent button reads Retry
  and is the only Retry.
- The Comments failure card and the create form show the same line with Retry.
- The Comments banner (`PushFixIdle`), the header (`PushFixStatus`) and the create
  form (`CreateNotices`) show it with no failure on screen, so coming back shows the
  agent, its progress and its result.

## Stale dependencies

Caught before the push. `worktree_deps_check` and `worktree_deps_unlink` take the
repository and worktree paths and refuse a folder the repository does not list as a
worktree.

- `worktree_deps_check` reads the lockfile for the package manager
  (`worktree_setup_proposal` tables) and reports an install folder that is missing
  (`missing`), or that, a nested one or a workspace package link resolves outside the
  worktree (`outside`; usually `node_modules` linked to another checkout, so the hook
  and checks read that checkout's code).
- `StaleDepsNotice` shows above the push surfaces (Comments through `LaneNotices`,
  the Branch header when Push is next, the create form), and `StaleDepsAction` sits
  beside Retry on the failure cards.
- **Reinstall dependencies** (`reinstallWorktreeDeps`, `ReinstallDepsAction`) runs
  the lockfile's install in that worktree as the script `deps-install:<mount>`
  (progress and result on `scriptRuns`, so a returning card still shows it), checks
  again, then retries the push (`retryAfterDeps`, the header Retry, the create
  again).
- When the whole install folder is a link, `worktree_deps_unlink` removes only that
  link before the install, never the folder it points to; nothing else is deleted.

## The worktree setup line

The header also holds the worktree setup line (`BranchSetupOffer` around
`WorktreeSetupOffer`): **Run** and **Not now** while offered, **Running** while it
works, and on a failure the error's last line with **Retry**; a setup that ran fine
shows nothing. On Changes it is a slim row under the toolbar
([branch-changes.md](branch-changes.md#the-toolbar)).
