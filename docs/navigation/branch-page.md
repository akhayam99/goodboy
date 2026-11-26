# The Branch page

> **Read this when** you change the Branch page: its frame, its address, its header and its one step, its tabs and landing, or the counts on its tabs. **Not for** one tab in detail (the pages listed below).

## The Branch page

One page per branch (`features/branch`) replaces the PR, Review and Diff pages.
Every diff in the app is still one `DiffView` (`features/diff`): the Changes tab,
Write review, the Bitbucket pull request changes and the `file-diff` drawer, each
listing its files through `orderLikeTree` (`features/diff/lib/changeTree.ts`), so
the order is the tree's everywhere. The Rust side runs git with
`core.quotepath=false` and `parseUnifiedDiff` reads quoted headers, so a name with
accents is its own file.

| Tab          | Page                                                                      |
| ------------ | ------------------------------------------------------------------------- |
| Conversation | [branch-conversation.md](branch-conversation.md)                          |
| Changes      | [branch-changes.md](branch-changes.md) and [diff-notes.md](diff-notes.md) |
| Commits      | [branch-commits.md](branch-commits.md)                                    |
| Checks, Work | [branch-work.md](branch-work.md)                                          |
| Comments     | [branch-comments.md](branch-comments.md)                                  |

Pushing, the push fix agent and stale dependencies are in
[branch-push.md](branch-push.md).

## Frame

- The page is the centre of the Projects tree (Context tab): one detail with no
  rail of its own. The branch's tree row has no rows under it, only one pill
  ([projects-card.md](projects-card.md#the-current-branch)).
- **One tab row per page**: its sections are the page tabs under its title
  (`BranchTabStrip`, on `PageTabs`). In a session the head sits above with
  `Overview › {branch name}` in place of the session tabs
  ([session-rail.md](session-rail.md#crumbs)). A host with no session (a scene, a
  test) shows the page alone.
- The header and every section body sit on the 960px column (`PaneShell
width="column"`, bodies in `PageColumn width="column"`), so nothing moves between
  sections: the session title, its crumbs, the Branch header, the tabs and the diff
  share one left edge.
- **The header holds three things**, 100px at rest with a pull request: the title
  row (48), one meta line (16) and the tab row (36). The running line, the work
  lines, the notices and the base branch row are the top of the body
  (`BranchBodyTop`, `BranchNotices`), out of the pinned header.
- **The header steps aside while you read** (`PaneShell`, `revealKey` the tab):
  24px of scroll down keeps only the session head pinned; 8px up, the top of the
  section, focus in the header or another tab brings it back. On Changes, whose
  toolbar sits above the diff, the toolbar rides up and stays under the session
  head.

### Every door to the changes lands here

Every door to the session's changes (a branch row of the Overview's project blocks,
the board row's Changes door, the palette, the chord) opens this page on Changes,
addressed by mount id so a moved worktree still resolves (`branchTabPlaceOf`).
Changes opened without naming a branch lands on the active mount's page. Every door
to a pull request lands here too: the worktree row chip, the board card badge, the
context strip and the Checks chip.

A move on a branch opens the tab the fact names (`tabForFactOf`):

| Fact                                      | Tab          |
| ----------------------------------------- | ------------ |
| a failing or running check                | Checks       |
| requested changes, open threads           | Comments     |
| a diff to check                           | Changes      |
| a conflict, a rebase, commits not pushed  | Commits      |
| anything else; Search, Activity and Tasks | Conversation |

## The Branch address

`s/{session}/branch/{tab}[:{mount}][/t/{thread}]`.

- A section switch and a thread selection replace the entry, so Back never walks
  them. Esc on a thread or a file goes to its section, then to the Overview.
- The crumbs read `Overview › {branch name}` from every door.
- `pr`, `review` and `files` (a mount present) are rewritten to this address by
  `canonicalLocation`, on a move and on a restore
  ([addresses.md](addresses.md#aliases-live-in-canonicallocation)).
- A GitLab or Bitbucket merge request keeps the `pr` page (the old studio stays
  reachable from its strip until the host cleanup); a session without a branch
  keeps its file versions (page id `files`).
- The page shows one branch, chosen in the Projects tree; there are no worktree
  tabs. Every rewrite takes the shown mount's `mountId`, never the active mount.

## One mount, one answer

The page resolves one shown mount (`useBranchIdentity`: the address' mount, else
the active one), and every widget reads it: the host word and new-request link
(`useBitbucketRemote({ mountId })`), the readiness (`usePullRequestReadiness`,
through `pullRequestViewOf`), the checks, the Comments tab and its count
(`branchScopeOf`), the review entries and `Push N fixes` (`useReviewEntries`,
`useReviewPush`). So a workspace with a GitHub and a GitLab repository shows the
nouns, links and checks of the repository on screen. The write destination is a
separate fact: opening a branch, Back and a reload leave it, and the push confirm
names the repository when the session has several.

## Header

1. **The title**, the one h1: the pull request's title, or the branch name. On a
   pull request you can edit, a click or `E` on Conversation (scope `pullRequest`)
   makes it an input in the same 32px row; `Enter` saves to the host, `Esc`
   cancels, a failure is an inline notice with Retry.
2. **The state chip** (20 high, word and icon, `BranchStateChip`).
3. **Three icon buttons** (`BranchTools`): **Start a run on this branch** (hidden
   once merged or closed), **Open a terminal here** and **Open the browser here**.
4. **One primary and `⋯`**, both 28px, `⋯` last. A blocked primary's reason (`1
check still running.` on Merge) reads in the meta line and the tooltip.

The line under the title is the same on every tab: the number and the branch in
mono, `into` the base, the author's picture and name with `opened it` and the age
(`PullRequestHeaderLine`); without a pull request, `Not pushed`, `Pushed` or
`Rebasing` and the distance to the base.

**There is no branch switcher in the header.** Choosing a branch in the Projects
tree (`SessionLevel/WorktreeRow`) makes it the active mount and replaces the address
with its landing tab (`switchBranchMount`), so the crumb, header and body follow and
nothing of the old branch carries over. A new branch is the `+` on its folder row
(`project.newBranch`), opening the new branch form (`forkMount` lands on the new
worktree); a folder project cannot fork.

### A branch reads one state word

The first that applies of `Rebase stopped` (`Rebasing on main` while the rewriter
works), `Merged`, `Gone on origin`, `Local only`, `Diverged from origin`, `Behind
main by N` and `On origin` (`branchPriorityOf`).

- `Local only` and `Diverged from origin` read the branch's own remote copy
  (`branchPushStateOf`), never its base.
- The header reads the same word, so a stopped rebase never reads `On origin` next
  to Abort rebase.
- A branch whose pull request merged reads `Merged` even with no git ancestry (a
  squash merge), everywhere (`isMountRequestMerged`).

## The one step

At most one secondary and one primary (`branchActionsOf`), and the primary is never
disabled. One function picks the step, the same on every tab (`branchStepOf`), first
match wins:

1. a push already going up;
2. `Answer` when a fix asks something, opening that comment;
3. no fill while an agent works on the branch;
4. `Apply N fixes`;
5. `Retry push`;
6. `Fix N comments`, opening the Fix comments drawer;
7. `Push fix` for a check fix not yet on origin;
8. `Push N commits`;
9. `Publish N replies`;
10. `Rebase on main` when the host says the request conflicts and the base moved;
11. `Apply fix` once the Debugger proposed one;
12. `Fix checks` while a check fails, but not while a pushed fix waits for its run
    (`isAwaitingRun`);
13. the pull request's own step.

Comments come before the push so the branch is pushed once; a conflict is rebased
before the checks, since a host may not re-run a conflicting request.

### Every verb does the work where you stand

- A verb never just opens a tab. `Fix checks`, `Apply fix` and `Push fix` run the
  Overview row's chain (`checkChainActionOf`); `Fix checks` starts one Debugger, its
  tooltip naming the model and effort.
- No line under the tabs says what runs. A comment fix works on its comment row
  (`CommentWorkLine`) and a check agent on its check row
  ([branch-work.md](branch-work.md#checks)); the Comments and Checks tabs carry a
  live dot on every tab (`commentTabLiveOf`, `checkTabLiveOf`).
- **One agent works per branch.** A check agent live on any check of the mount
  (`liveCheckWorkOf`, from the agent rows, so a second window sees it; a fixer that
  ended never counts) draws the dot and no fill, and the other doors that start an
  agent (row Analyze, the Overview card, the Fix comments launch, the Debugger and
  Implementer runners) stay disabled with the name of what runs.

### When the step steps down

- A running push, an open stop or a queued request keeps the push (and `Retry
push`) in the secondary alone, no primary beside it; `Publish N replies` stays in
  the queue.
- While the new pull request form leads, the header draws no push (it waits in
  `⋯`), so the unpushed count is said once, under the title.
- A comment selection takes the fill, and the step steps down until it clears.
- A closed request has no push, and `Force push` never sits there: while origin
  moved it waits in `⋯` behind its confirm.
- **An open stop** (`hasOpenRebaseStopOf`: the stop the rebase panel shows, through
  `rebaseStopOf`, live or rebuilt from session events after a restart, or a
  worktree mid rebase, from the live status or, for the registry and the palette,
  the mount's status cache, the write destination's when no mount is named) leaves
  the header with no primary and no push; `Abort rebase` sits in the rebase banner
  only.
- A blocked `Merge`, `Mark ready` or `Reopen` draws no primary: it waits in `⋯`,
  disabled with its reason, and runs through the header's own confirm and failure
  line. The header never repeats its primary in `⋯`.
- While the branch is behind and another step leads, `Rebase on main` waits in
  `⋯`, its one home.

### The pull request's own step

`pullRequestNextStepOf`: `Mark ready for review` on a draft; `Request review` while
nobody was asked, or once changes were requested and nothing is left to fix; the
merge method (`Squash and merge`) once ready; `Rebase on main` when only the base
moved; `Reopen` when closed. None while a reviewer, a check or a comment that needs
you is on it (counted for the shown request only, `pullRequestThreadsOf`), on a
queued or merged one, or while a banner holds the next action. On someone else's
open request the step is `Review` (`pullRequest.writeReview`).

Without a pull request the comment steps come first, then `branchNextStepOf`: `Push
N commits` while commits are not on origin, `Rebase on main` while behind, and none
once pushed and up to date, where the create form's `Create pull request` is the
one primary.

### After the merge

1. `Remove worktree` while the folder is there (`diff.removeWorktree`); its confirm
   shares `mountCleanUpWordsOf` with Clean up: the folder and local branch go, the
   pull request stays, and the branch on origin stays unless the after-merge setting
   removes it.
2. Undo on its toast brings the branch back from the keep ref (on origin too if it
   was there), and `attachMount` rebuilds the worktree in a fresh folder, so ignored
   files do not return.
3. A blocker such as an open terminal draws it disabled in the secondary with the
   reason, and a refusal keeps the step; `Archive session` then waits in `⋯`.
4. Once the last folder is gone the step is `Archive session` on the session
   (`session.archive`, `hasRemovedMergedMountOf`, every host), unless another open
   branch keeps it away. `diff.archiveSession` confirms only while agents run, else
   it offers Undo.

### Merge readiness

One rule decides the step, the merge box and the merge action
(`evaluatePrMergeReadiness`, `features/review`).

- Blockers: a merged, closed, queued or draft pull request, conflicts, checks
  unknown, failing or running, changes requested, a required review, a write
  already running, and commits not on origin (`unpushed` in `MergeReadinessFacts`,
  from the push's status: the merge box reads `3 commits not pushed` and `⋯` shows
  the reason). `useSessionDiff` follows the status cache (`subscribe`), so a push
  reopens the merge without a reload.
- Caveats: comments that need you and a live fix run. The companion's `mergePr`
  asks the same function and refuses on a caveat too, with the same unpushed count.
- The merge confirm is an inline panel with a method picker (`ActionConfirm.choice`,
  `ChoiceCards`): `Squash and merge` (`One commit on main`), `Merge commit`,
  `Rebase and merge`; squash by default when allowed, and a forbidden method
  disabled with its reason (`Turned off in payments-api`). Merging raises one plain
  `info` toast with no Follow. The box is in
  [branch-conversation.md](branch-conversation.md#the-merge-box).

### The `⋯` menu

Never more than five rows (`branchMenuRowsOf`):

- the lifecycle: Edit title and description, Request review, Convert to draft,
  Close or Reopen, Open with the host logo (named Open on GitHub), Copy link;
- branch actions: Change base branch… (before a pull request exists), Copy patch,
  `Archive session` on a merged request;
- `Cancel auto-merge` on a queued request with auto-merge; `Merge when green` on an
  open GitHub request with checks running, which asks for the method and hands the
  merge of the reviewed head to the host (`pullRequest.mergeWhenGreen`);
- the push whenever the header does not draw one (`branchShownIdsOf`).

Rows with another home drop first: Edit title and description, Copy link, Copy
patch, and Rebase and Request review, which live on Commits and Conversation.

## Sections and landing

`branchTabsOf({ state, hasComments })` (`features/branch/branchTabs.ts`):

| State                                         | Tabs                                                   |
| --------------------------------------------- | ------------------------------------------------------ |
| no pull request, no comment                   | Conversation, Changes, Commits, Work                   |
| no pull request, a local note or a thread     | Conversation, Changes, Commits, Work, Comments         |
| Draft, Open, Approved, Queued, Merged, Closed | Conversation, Changes, Commits, Checks, Work, Comments |

- Comments stays its own tab: it holds the review flow (pick threads, fix them,
  resolve, push) and the notes of a branch with no pull request. Conversation shows
  the threads in its activity and links there.
- The first tab is `Conversation` on every host, so `Overview` names only the
  session overview. Keys: ⌥⌘1, Comments ⌥⌘R, Changes ⌥⌘F, in the row's tooltip.
  Checks never appears without a pull request. A pick replaces the address.
- Merged and Closed make the page read only (`isBranchReadOnly`).

Every "go to the branch" door lands through `branchLandingTabOf`
(`features/branch/branchLandingTab.ts`): an explicit section wins, else
`Conversation` when the active mount has a pull request, else `Changes`; then the
door resolver drops a section the state lacks.

- A Projects tree row, the Branch crumb, `⌥⌘1`, a mount's `Open PR`, the Board's
  pull request chip, an approved or changes-requested mark and `Create PR` land on
  `Conversation`.
- A comment, a thread, a fix run, a note, ⌥⌘R and a draft comments chip name
  `Comments` (with no pull request and no comment, `Changes`); `Changes` and
  `Commits` doors name theirs; a CI failure names `Checks` (with no pull request,
  `Conversation`).
- The chosen section is stored per session and read through `branchTabOf`
  (`useBranchTab`), never `branchTab[sessionId]` directly, so a section is only
  remembered once chosen. When the stored one is gone the page shows one the state
  has, without writing history.

## The counts on the tabs

Each tab carries its count in faint ink, colour only for what wants you, computed
once (`branchTabFactsOf`, on `worktreeEntryFactsOf`, for the tab and its page head).

- A slot reads nothing until the current branch's data arrives, and nothing at
  zero. After a switch a count read for the previous target never shows:
  `useSessionDiff` keys commits and status by worktree path and base, and a failed
  read shows the error with no count.
- `BranchPage` loads the mount's history draft (`loadHistoryDraft`) once on open,
  so Commits has a number on every section.

| Tab          | Count                                                                                                                                        |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Pull request | `Draft`, `Merged` or `Closed`                                                                                                                |
| Comments     | the open entries of the branch scope (`useBranchReview().branchEntries`), warning when some need you; the notes alone without a pull request |
| Changes      | the file count and `+added -removed` of the branch                                                                                           |
| Commits      | the commit total (the ahead count); `↑N` (`N not pushed`) only when no total is known                                                        |
| Checks       | failing (danger) or running (info), else passed                                                                                              |
| Work         | [branch-work.md](branch-work.md#the-count)                                                                                                   |

- Inside Changes the rail head and `Viewed N of M` count the loaded diff
  (`filesHeadFactOf`), while the tab keeps the polled summary.
- The diff selector says `All N commits` with the Commits total and cuts its list
  at the same base (`listBranchCommits` passes `baseBranch` to `worktree_commits`);
  `All commits` when a capped list has no total, and `Showing latest 100` whenever
  capped (`branchCommitsLabel`).
- **The unpushed count** is `branchPushFactsOf(...).toPush`: the history draft's
  unpushed commits once the branch has an upstream, else the upstream's ahead count
  (a diverged `2 ahead, 3 behind` reads `↑2`), and for a branch never pushed its
  commits over main. `branchPushFactsOf` in `shared/lib/branchPushState.ts` is the
  one owner of `{ state, toPush, canForce }`, read by the strip, the form, the step,
  the registry and the rail, so a diverged branch never reads `Pushed`.
- The Comments counts are in
  [branch-comments.md](branch-comments.md#one-function-per-number).
