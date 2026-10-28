# The Branch page

> **Read this when** you change the Branch page: its header, its pages, its banner or its actions. **Not for** spacing, scroll and overlay mechanics ([styling.md](../styling.md)) or design intent and tone ([DESIGN.md](../../DESIGN.md)). The other pages are listed in [navigation.md](../navigation.md).

## The Branch page

One page per branch (`features/branch`) replaces the PR, Review and Diff
pages. Every diff in the app is still one `DiffView` (`features/diff`): the
Files tab, Write review, the Bitbucket pull request changes and the
`file-diff` drawer. Each one lists its files through `orderLikeTree`
(`features/diff/lib/changeTree.ts`), so the order is the tree's everywhere. The
Rust side runs git with `core.quotepath=false` and `parseUnifiedDiff` reads
quoted headers, so a name with accents is its own file.

**Frame.** The Branch page is the center of the Projects tree (Session
rail): one detail with no rail of its own. Its sections are the pages under
the current branch row of the tree (`SessionLevel/WorktreeEntries`); the page
publishes its counts once (`worktreeEntryFactsBus`, read by the folded rail)
and the tree computes the same facts for its rows (`worktreeEntryFactsOf`). A host
with no session rail (a scene, a test) shows the page alone. The
header, the banners and every section body sit on the 960px column of the
detail; nothing moves from one section to the next.

**Header.** One row: the title, the one h1 (the pull request's title, or the branch name
without a pull request; on a pull request you can edit, click it or press `E` on
the Pull request entry and it becomes an input in the same 32px row, `Enter` saves
to the host, `Esc` cancels, a failure is an inline notice with Retry), one primary and `⋯`. The
line under the title says the state once (the state chip), the number, who wants to merge how
many commits into which base and from which branch (`PullRequestHeaderLine`); without a pull
request it says `Not pushed`, `Pushed` or `Rebasing` and the distance to the base. **There is no branch switcher in the header or
the rail**: the branches of the session are the rows of the Projects tree
(`SessionLevel/ProjectTree`), and choosing one makes it the active mount and
replaces the address with the landing tab of that branch (`switchBranchMount`,
also what the trail menu and the sidebar rows run), so the crumb, the header
and the body follow together and nothing of the branch it leaves carries over.
A new branch is the `+` on its folder row (`project.newBranch`), which opens
the new branch form (`forkMount` lands on the new worktree on its landing tab);
a folder project cannot fork and shows none.

The header holds at most one secondary and one primary (`branchActionsOf`), and the primary is never
disabled. The secondary is the first push that applies: `Push N fixes` (every accepted thread), `Push
N commits` while the branch is level with origin, `Publish N replies` (the fix is already on origin),
`Retry N`; a merged or closed request has none, and `Force push` never sits there: while the online
copy moved it waits in `⋯` behind its confirm. The primary is the page's next step
(`pullRequestNextStepOf`): `Mark ready for review` on a draft, `Request review` while nobody was
asked, `Fix comments` while changes are requested or comments need you, `Fix checks` while a check
fails (both open their tab), the merge method (`Squash and merge`) once the pull request is ready,
`Rebase on main` when only the base moved, `Reopen` on a closed one, and none while a reviewer or a
check is still on it, on a queued or merged one, or while a banner holds the next action (a stopped
rebase, someone pushed). One predicate says when a stop is open for the shown branch
(`hasOpenRebaseStopOf`: the stop the rebase panel shows, read through `rebaseStopOf`, live or
rebuilt from the session events after a restart, or the worktree is mid rebase, read from the live status or, for the action registry and the
palette, from the status cache of the mount: a palette target that names no mount reads the write
destination's); while it holds
the header draws no primary and no push, with or without a pull request, so nothing sits next
to the stop panel. Without a pull request the branch's next step decides (`branchNextStepOf`):
`Push N commits` while commits are not on origin, `Rebase on main` while the branch is behind, and
none once it is pushed and up to date, where the create form's `Create pull request` is the one
primary. A step whose action is blocked draws no primary: a blocked `Merge`, `Mark ready` or
`Reopen` waits in `⋯`, disabled with its reason, and runs through the header's own confirm and
failure line from there; the header never repeats its primary in `⋯`. A stopped rebase shows no
primary, with `Abort rebase` in the rebase banner and on the worktree status line. The Merge
cell of the status strip says the blocker once (`Blocked by checks`).
One rule decides all three (`evaluatePrMergeReadiness`, `features/review`): its
blockers are a merged, closed, queued or draft pull request, conflicts, checks
unknown, failing or running, changes requested, a review required and a write
already running; its caveats are comments that need you and a live fix run. The
companion's `mergePr` asks the same function and refuses on a caveat too. Its
confirm is an inline panel with a method picker (`ActionConfirm.choice`,
`ChoiceCards`): `Squash and merge` (`One commit on main`), `Merge commit` and
`Rebase and merge`, the default squash when the repository allows it, and a
method the repository forbids shown disabled with its reason
(`Turned off in payments-api`). Merging raises one plain `info` toast with no
Follow. Push, Publish and Retry go through the existing publish
machinery: a frozen preview in line under the header (`PushBanner`, the only
push one), drift and the result per thread. Under it sits the rebase job banner
(`JobBanner`, `features/history/JobBanner`): one strip for a rebase
on main, on every tab of the page, which replaces the red line that used to
tell a stop. It reads the stop of the branch (`rebaseStopOf`, through `useRebaseStop` and
`selectRebaseStop`): the run in `historyRuns` while this window has it, else one rebuilt from the
latest open saved `history_stopped` event and a git read requested after that stop (an older read
is ignored). The run is never saved, so after a restart, a reload or in a second window the banner,
the rail prompt and the mount actions read the same rebuilt stop. Never local state,
and a stopped rebase is one panel (`RebaseStopPanel`, a `Notice` banner): what stopped, the files
or the new online commits, and one row of verbs with one filled primary and no Dismiss while the
stop blocks the branch (`useJobBannerActions`, a failed verb keeps the panel with its error and
Retry, kept per branch and named with the branch when the session has more than one, and a verb
running on one branch never locks another). A rebase that is in progress in the worktree with no
Goodboy stop (started in a terminal) draws one minimal row, `GitRebaseRow`: Continue rebase, Open
terminal, Abort rebase. The other states keep the strip (Stash and rebase, Bring them back, Undo rewrite, Retry
with a note, Open providers, See what it did). A failed push after
a rebase offers `Fix with agent` (the primary: an Implementer on that worktree briefed with the
command and git output, `fixPushWithAgent`; it commits the fix and never pushes, Goodboy then
pushes again with the same lease, `settlePushFix`, and the banner follows it with a link to its
transcript), `Open terminal here` (the session terminal drawer at the worktree with the exact
push typed at the prompt and not run, `openSessionTerminal` with `prefill`) and `Retry push`.
The same two actions sit beside Retry on the inline failure line of the header Push and Force
push (`PushFailureActions`, shown when the failed action's error is a push failure (`pushFailedError`)): the
agent is `fixBranchPushWithAgent`, its finish runs `settleBranchPushFix` (plain push, or force push
with the lease read before the agent started and the commits the confirm named), and the terminal
is `prefillBranchPushTerminal` (`git push`, or `--force-with-lease` pinned to the remote sha the
confirm showed, `PushFailedError.confirmedRemoteSha`; when the online copy moved since, nothing is
typed and the header says `The online copy changed. Check again before force pushing.`, and a
prefill always opens a new terminal tab). A retry that pushed clears the failure line
(`settledBranchPushes`).
A push failure keeps its cause. `git_push` returns stdout and stderr with credentials and home
paths masked (`redact_output`), `pushOutputOf` joins both and bounds them (head plus the git
verdict), and `pushFailureDigest` reads the failing hook or command and the first findings that
`PushFailureBlock` shows on the failure card, the Comments banner (`PushBanner`) and the create
form. The label is `Let an agent fix the push` (`PushFixAgentAction`): it calls
`fixBranchPushWithAgent` with `pending`, the work that waits on the push (the replies of a failed
publication, `pendingPublicationBrief`, or the text of the pull request being created), which the
brief tells the agent not to do itself and never to skip a hook. The action tracks the agent
and hands the store its continuation (`onSettled`, kept in `pushContinuations` by mount). When
the fix pushed, `settleBranchPushFix` runs it from the store, once, wherever the user is: the
banner re-arms the publication (`retryAfterFix`) and the create form runs its create again, with
the latest text of the screen that registered it. A continuation may return what it did
(`PushFixFollowUp`: `Pull request #318 is open.`, `The fix is pushed. Nothing else is waiting.`,
or the reason it failed). A retry that finds nothing new while the last publication failed on its
push shows that failure, never `Nothing is waiting for the push` (`failedPushPublication`).
The card does not depend on staying mounted. The fix of a branch is kept in the store
(`branchPushFixes`) and its result in `pushFixOutcomes` by mount (`pushed`, `agent_failed` or
`push_failed`, with the reason and the follow up), both written through to browser storage
(`pushFixMemory`, six hours, read when the store starts) so a window reload keeps them.
`pushFixStateOf` reads one answer from them and from the saved agents, so a running `Fix the
push` agent of the branch is found again even when the window forgot the fix: `working`, `pushed`,
`failed` or `none`. Every push surface draws it with `usePushFix` and `PushFixStatusLine`: the
failure card and the header line replace their button while the agent works and show why it
stopped or what stopped the push after it; the Comments banner (`PushFixIdle`), the header
(`PushFixStatus`) and the create form (`CreateNotices`) show the same line when no failure is on
screen, so leaving the page and coming back shows the agent, its progress and its result. A
result nobody took (the fix pushed while no continuation was registered) is claimed once by the
first surface that mounts with a continuation (`claimPushFixOutcome`) and run there. A new fix on
the branch clears the old result, and the line can be dismissed (`dismissPushFixOutcome`).
Stale dependencies are caught before the push. `worktree_deps_check` reads the lockfile to pick
the package manager (`worktree_setup_proposal` tables), and reports a worktree whose install
folder is missing (`missing`) or whose install folder, a nested one or a workspace package link
resolves outside the worktree (`outside`; the usual case is `node_modules` linked to another
checkout, so the push hook and the checks read that checkout's code). `StaleDepsNotice` shows it
above the push surfaces (the Comments page through `LaneNotices`, the Branch header when Push is
next, the create form) and `StaleDepsAction` sits beside Retry on the push failure cards.
**Reinstall dependencies** (`reinstallWorktreeDeps`, `ReinstallDepsAction`) runs the install of
the lockfile in that worktree as the script `deps-install:<mount>` (progress and result stay on
`scriptRuns`, so a card that comes back still shows the install running), checks again, and then
retries the push (`retryAfterDeps`, the header Retry, the create again). When the whole install
folder is a link to another folder, `worktree_deps_unlink` removes only that link before the
install and never the folder it points to; nothing else is deleted.
Only the header pushes everything: a thread has no
Push, Push again or Sync button. The header reads `Push N fixes` (N counts every
accepted thread, the opened one never narrows it) and one click prepares the
preview. A clean preview (no blocker, no drift, a publication, no earlier commit
that is not a fix) pushes at once: the button shows `Pushing N fixes` and the
outcome is one dismissible line under the header (`Pushed 6 commits to origin and
posted 6 replies on GitHub.`). Any other preview opens the panel (`PushBanner`),
which holds the only `Push`; the header button stays as its toggle
(`aria-expanded`, a second click closes the panel and cancels the prepared
publication) and never pushes while the panel is open. A `stale` answer reopens
the panel with one line above it saying what changed (`driftSentence`). An accepted
thread opened in Comments offers `Push only this one` in its action bar
(`preparePublication` with `isolated`, `isolatedPushOf` unchanged); the panel
lists every commit that goes out, oldest first, with `Not a fix` on the earlier
ones, under a title that counts them all (`pushCommitCount`). `Push only this
one` is not shown while the panel is open, so one Push is visible at a time. A preview that is
left (page unmounted, navigation, Cancel, a `missing` answer) is closed as
cancelled in the database; `missing` says `The push was already handled or
cancelled. Nothing changed.` in the outcome line. `Publish N replies` and `Retry N` stay the header primary of their state. A blocked primary stays visible, disabled, with its
reason. `⋯` holds the rare lifecycle (Edit title and description, Request
review, Convert to draft, Close or Reopen, Open with the host logo, named Open on GitHub, Copy link) and the
branch actions (Change base branch…, Open terminal, Open in editor, Copy
branch name, Copy patch); a queued request with auto-merge adds `Cancel auto-merge`.

**Sections and landing.** The worktree level lists the entries the state has, in this order
(`branchTabsOf({ state, hasComments })`, `features/branch/branchTabs.ts`): with no
pull request and no comment `Pull request`, `Files`, `Commits`; with a local note or a thread
and still no pull request `Comments` joins them; Draft, Open, Approved, Queued, Merged and
Closed show all five, `Pull request`, `Comments`, `Files`, `Commits`, `Checks`. The first is
labelled with the host's noun (`Pull request`, `Merge request` on GitLab; its key is ⌥⌘1,
Comments ⌥⌘R, Files ⌥⌘F, shown in the row's tooltip) and Checks never appears without a pull
request. A row is 28px with an icon, the label and one fixed right-aligned slot
(`worktreeEntryFactsOf`; empty until a count is known, the fact in the tooltip), then a chevron
column that only Files fills. The current row carries `aria-current="page"`,
Up and Down move between rows while the list has focus, and a pick replaces the address. Merged and
Closed make the page read only (`isBranchReadOnly`): Commits shows its list without editing or Rebase. Every door that means "go to the
branch" lands through one pure rule (`branchLandingTabOf`,
`features/branch/branchLandingTab.ts`): an explicit section in the place wins, else
`Pull request` when the active mount has a pull request, else `Files`; then the door resolver
above drops a section the state lacks. The
sidebar's Branch row, the Branch crumb, `⌥⌘1`, a mount's `Open PR`, the Board's
pull request chip, an approved or changes-requested mark and a mount's
`Create PR` land on `Overview`; a comment, a thread, a fix run, a note, ⌥⌘R
(`Open Comments`) and a draft comments chip name `Comments` themselves (with no pull
request and no comment they land on `Files`), `Files`
and `Commits` doors name theirs, and a CI failure names `Checks` (with no pull request,
`Overview`). The chosen section
is stored per session and is read through `branchTabOf` (`useBranchTab` in a
component), never from `branchTab[sessionId]` directly, so a section is only
remembered once the person has chosen one; the page shows the section the state has
when the stored one is gone, without writing history.

**One mount, one answer.** The page resolves one shown mount (`useBranchIdentity`: the address'
mount, else the active one) and every widget reads it: the host word and the new-request link
(`useBitbucketRemote({ mountId })`), the readiness and merge word (`usePullRequestReadiness`, the
view of that mount through `pullRequestViewOf`), the checks, the Comments tab and its count
(`branchScopeOf` keeps the notes and review threads of that branch), the review entries and the
`Push N fixes` primary (`useReviewEntries`, `useReviewPush` with the mount). A workspace with a
GitHub repository and a GitLab one therefore shows the nouns, links and checks of the repository on
screen, whichever one chat writes to. The write destination is a separate fact: opening a branch,
Back and a reload leave it where it was, and the push confirm names the repository when the session
has more than one.

**Pull request.** The pull request itself, on the 960px column
(`features/branch/components/PullRequestTab`): the status strip first, then two columns, the
reading column (the description and the Activity, at most a prose measure, `max-w-prose`) and the 224px side column;
below an 880px page container the side column moves above the reading column as one wrapping
row. The strip (`PullRequestStatusStrip`, cells from
`pullRequestCellsOf`) has four fixed cells, each a label, a word with a `StatusDot` and one faint
detail: Checks (`2 passed`, `1 failing` with the failing names, `Running, 2 of 3`, counted by
`checksCountsOf` as the rail is, and a click opens the Checks entry), Review (`No approval yet`,
`Waiting on dana-r`, `Changes requested`, `Approved by dana-r`), Merge (`Blocked by checks`,
`Conflicts` in amber as in the branch state map, `Ready` with the merge method, `Queued` with the
queue line, `Merged`) and Branch (`Up to date`, `7 behind main`, `Rebasing`, `Diverged` when
someone pushed online). The side column (`PullRequestProperties`) holds `Reviewers` (people only,
the asked ones first, each verdict right after the name: `Asked`, `Changes`, `Approved`; `+`
requests another), `Bots that commented` (bots whose only review is a comment, with no verdict,
`pullRequestReviewerGroupsOf` in core), `Author` and `Linked issues`, all read from the branch on
screen. There is no Rebase in it. The description renders as markdown with `Edit` beside its heading;
the body's own headings read as bold lead-ins and a first heading that repeats `Description` is
dropped (`demoteBodyHeadings`; a code fence closes only on the same character, at least as
long and with nothing after it, as CommonMark says, and an unclosed fence runs to the end, so
a heading inside code stays literal), while the edit preview keeps them as written
(a click on the text also opens it; the editor is a textarea with Write and
Preview, `Save` and `Cancel` at its end, a failure keeps the draft and offers
Retry; an empty description reads `No description yet` with `Add description`)
and the Activity, oldest first: who opened it, the pushes grouped by day, the
reviews, one line `4 comments on files, 2 need you` that opens Comments, one line
for the checks that opens Checks, your edits of this session and the merge. Bot comments
in a row fold into one event, `4 bots commented`, each comment clamped to two lines; a person
in between splits the group (`groupBotActivity`). The glyphs sit on a spine, a 1px line from
one event to the next. Rows that open something carry `ROW_INTERACTIVE`. Reviewers draw a glyph and a word each (`+`
opens the picker that searches the host's collaborators), Checks reads `4 passed · 1 failing`
(`Checks unknown` when the read failed), Linked issues carry their relation (`Closes #412`;
`Link issue` opens the popover). Without a pull request the section is the branch
page (`BranchStartPage`): the header names the branch with `Not pushed`, `Pushed`,
`Diverged` (warning, when origin also has commits the branch lacks) or `Rebasing` and `3 ahead, 0 behind main` under it, a four cell strip (Local checks:
`Passed` or `Declined` with the age of the last push from this machine, read from the push
result since the repo's pre-push hook is the one local gate, kept in memory per mount
(`local-checks` slice, `mountLocalChecks`), so after a restart it reads `Not run` until the
next push; a push that went through counts as `Passed` whether or not the repo has a hook,
and a failure that does not name `pre-push` leaves the last result, a remote
`pre-receive hook declined` included (`localCheckOf`);
Pull request `None yet`, Remote, Branch, the conflict cell amber), then the create
form, prefilled from the branch (`pullRequestPrefillOf`: one commit gives its
headline, several give the linked issue and the first headline, the description
lists the commits and `Closes HL-1372` for a Linear issue), and `In this branch`
with the commits and files under it. The form works on the branch on screen: it
reads that mount's status and base branches and opens the pull request from it,
never from the session's write destination; on GitLab `CreateMrForm` takes the same mount
and prefill and hands the mount to `createMrForSession`. Its submit is the one primary once the
branch is pushed and up to date, and secondary, `Push and create pull request`,
while commits are not on origin. On a diverged branch the Remote cell reads `Diverged` with
`2 yours and 1 online`, and the submit reads `Force push and create pull request`: it opens
the same confirm as the Push action (`forcePushConfirm`, which also lists the commits that
exist only online) and only then force pushes with lease and opens the request
(`createPrForSession` with `forcePush`); a plain push is never tried on a diverged branch. While a rebase is stopped the form waits and the
conflicting files are listed; a branch with no commit of its own shows `No commits on
this branch yet`. The form fills the same grid: one input card (the title as a large
borderless field, the description growing from 6 to 16 lines, and in the card's
bottom row `Write with Scribe` with its routing and a faint `Markdown`), then
the settings as labelled properties in the side column (`Into`; `Opens as` with
`Ready for review | Draft` only where the host can set a draft; `Reviewers` only
where it can request them, requested right after creation; `Closes` with the
linked issues as chips; the changelog entry under `More options` when Scribe
wrote one) and the actions inline at the end, right aligned, with no bar:
`Discard text` (with Undo) and `Create pull request`, which reads `Create draft
pull request` with Draft. Scribe's job shows inside the card (skeleton lines
while it writes, a running dot with the seconds and `Stop`, a danger notice with
`Retry` when it failed); creating shows `Pushed <branch>` and `Opening the pull
request` in the same row, and a failure keeps the text under a danger notice
with `Details`. Creating it raises a `Follow` toast ("Pull request #318 opened")
only when the page is not already on screen. Every write goes through the
host-neutral `PullRequestPort` (`packages/core/src/review-source`), a facet of
the review source built per host in
`store/slices/review-source/pullRequestPortFor.ts`; the page reads the
capability table (`REVIEW_SOURCE_CAPABILITIES`) and never the host. A control
the host forbids on an object that exists is shown disabled with its reason
(`Bitbucket has no draft pull requests`, `Turned off in payments-api`, `Set by the
project`), and a concept the host does not have is left out. GitLab uses the same
page with its own calls and words (the chip and the form read `merge request`, the header
`MR !42`, `Open on GitLab`): `gitlabPullRequestPort` reads and writes through
Tauri commands that hold the stored token, `Mark ready` and `Convert to draft`
change the `Draft:` prefix of the title, Merge lists the ways the project
allows, and a token without the `api` scope reads `Goodboy can't read this merge
request` with `Open GitLab settings`. A branch with no merge request shows the
same create form with `Create merge request`, the same Scribe job and no
reviewers. Bitbucket uses the same page through its own adapter
(`bitbucketPullRequestPort`, built by `bitbucketPortOf` from the mount's
request): merge offers its three strategies, `Close` declines, and the draft and
reopen controls are left out. `E` edits the title in scope
`pullRequest`, live only on this section.

**Comments.** The section header holds a segmented control `All 9 · Notes 3 · On GitHub 6`
(only while both notes and host threads exist) and `Open · Resolved` (only while there are
comments), with `Fix N comments` at its right, the one fix action. The list (`Needs you`,
`Working`, `Ready to push`, `Open`, `Left open on GitHub`; `Done` shows under
`Resolved`) lists your notes and the pull request threads together, each row with
the author and its age, its `path:line`, the first line of the body and a `Note` chip only
while the list mixes sources. A note keeps `Post to GitHub` (it moves the note into
the pull request's review draft and closes it) and `Delete` under its thread, and a
note shows even while the host is still loading or failed to load. The open thread has the code
around the commented line above it (`hunkAround`, linking to Files), all inside the comment drawer. Comments exists when a pull
request exists or at least one comment exists, a local note or a thread open or resolved; its count is
the notes alone while there is no pull request. The
properties (Origin, Attempts, Fix commit) sit inline under the thread at every width, never in a margin rail. The
actions of the comment sit at the end of the drawer content through `FormActions` (`CommentDrawerActions`), never in a bar pinned to the page bottom; the `⋯` in the drawer header holds the transcript, Resolve without a reply, Open on the host and Copy link, and shows only with two or more of them (one rare verb shows as a quiet button instead).
Every Branch section sits on the 960px column (`PaneShell width="column"`, bodies in
`PageColumn width="column"`), the header and Ask included, so nothing
moves from one section to the next, except that Files gives up the width of its file rail
on the right and the column re-centres in what is left. The Comments section is one full-width
list at every pane width, with no back link; the open comment is the drawer, and the last row
opened stays marked after the drawer closes. The entry slots read nothing until the data arrives and nothing at zero:
Pull request `Draft`, `Merged` or `Closed`; Comments the count that needs you; Files the
count; Commits `↑2` (tooltip `2 not pushed`, `branchPushFactsOf(...).toPush`: the history draft's unpushed
commits once the branch has an upstream, else the status: the upstream's ahead count, a
diverged branch included, so `2 ahead, 3 behind` reads `↑2`, and for a branch never pushed
its commits over main, so it reads `↑3` too. `branchPushFactsOf` in `shared/lib/branchPushState.ts`
is the one owner of `{ state, toPush, canForce }`: the strip, the form, the header step, the action
registry facts and the rail all read it, so a diverged branch never reads `Pushed`); Checks the failing or
running count (`worktreeEntryFactsOf`; the comment
source tabs drop a zero badge the same way). All three arrive without a visit: `BranchPage` loads
the mount's history draft (`loadHistoryDraft`) once when the page opens and the
draft is not there yet, so the Commits count is a number on the Comments section too. `Fix N comments`, in the Branch header on the Comments section, is the one fix launch.

**Files.** The branch against its base, with the changed file list in a rail on the
right of the Branch page, dedicated to the diff (`FileRail` in `features/diff/components`).
`BranchPage` draws an empty slot (`data-slot="diff-file-rail"`) after the page column only
while Files is the entry and hands it, with the page element, to `SessionDiffPane` through
`DiffRailContext` (`features/diff/diffRailHost.ts`); `SessionDiffPane` portals the rail with
`ChangeTree` into it, so the tree and the diff still share one `useReviewState` and the keys
stay in `useDiffKeys`. Without a slot (a test, a scene of the pane alone) the rail sits beside
the diff inside the pane. The rail runs the full height of the page, beside the header and the
diff, so the column re-centres in the space left of it the way it slides for a right drawer.
It opens at 320px, its left edge resizes it from 260 to 560 (`Resize the file list`, a double
click resets it) and the width is kept in `goodboy:diff-file-rail-width:v1`. `Fold the file
list` in its head folds it and `goodboy:diff-file-rail-folded:v1` remembers that; folded, the
diff toolbar ends in `Files N`, which opens it again, and `F` or `/` open it too (`useFileRail`).
The rail belongs to the page, not to the drawer slot: a side or reader drawer pushes or lies
over the whole page (rail included) by the push rule of Drawers below. The rail docks while
the page is 880px or wider (560 for the diff plus the rail); a narrower page (a pushing drawer,
a small window) folds it without writing the saved choice, and `Files N`, `F` or `/` then open it
over the right edge of the diff (`data-file-rail="overlay"`) until a pick, `Esc` or Fold
closes it. Folding and opening move like the session rail (`FileRail` over `useFoldPhase`,
the page as its frame): the width eases on the 220ms fold token while the list, held at its
final width, fades out (`fold-label-out`) or in (`fold-label-in`); a switch between docked and
overlay (the page crossing 880px) remounts the rail in place, with no move. The rail head reads `Next unviewed N`, the keyboard button and Fold, then the
filter field (`/`) with the filter menu beside it (scope and grouping), then the tree;
each file row keeps its viewed mark.
The toolbar on the column (36 high, the diff scrolls under it) reads `Compared with main · All 5 commits ⌄`,
then `Display ⌄`. Folders first, then files, alphabetical,
and the diff follows the same order. A chain of folders with one child is one
row (`src/ledger/export`). A folder row holds a progress ring (empty, partial,
or filled with a check once every file in it is viewed, tooltip `3 of 5
viewed`), the path and, only while it is collapsed, its file count and its
`+N −N` in one muted tone (no green or red; an open folder shows none, its files
carry them); a file row (28 high, 8 per level with a 1px guide) leads with the viewed
toggle (a checkbox button, `Viewed: <name>`; an amber dot when the file changed after
it was viewed; none on a merged or closed pull request), then the name (a rename shows
`from <old path>` under it, a deleted file is struck through), a comment count chip whose
tooltip names the kinds (`2 notes, 1 on GitHub`), `+N −N` only at a rail of 300 or more, and
the status letter. `+N` and `−N` sit in two fixed right-aligned columns (`Delta`), and a closed
folder keeps the status letter's slot empty, so every count lines up down the list. A name too long for the rail keeps its first six characters and its last
six with the extension chain (`Statem…ceCard.test.tsx`, `cutFileName`); the full name stays
for a screen reader. A file or folder row has no tooltip: the full path is in the file header of the diff. The tree is a `tree`: Up and Down move
its cursor, Home and End go to the ends, Right and Left open, close and climb, `Enter` jumps
the diff and keeps focus in the tree, `Space` toggles viewed (or folds a folder) and `Esc`
returns to the diff (and closes a rail that lies over it). A keyboard button beside
`Next unviewed` at the head of the rail carries the key hint in its tooltip and opens the full list.
Under the head a filter field (`/` and `T` focus it, `Esc` clears it) matches a
subsequence of the path, and one filter menu beside the field (`Filter and group files`,
tinted while a scope is on) holds `Show: All | Unviewed N | Commented N`, which narrows it
further, and `Group: Folders | Kind`, which regroups the tree under Source, Tests, Config and
Docs (each file then shows its folder beside the name). The filter narrows the
diff as well as the tree, `Showing n of N` with `Clear` says so, and a filter
that hides everything leaves `No files match` with `Clear` in both panes
(`filterFiles` in `changeTree.ts`). Generated files (lockfiles, `dist`, `build`,
`vendor`, minified and map files) sit in a closed `Generated` row at the bottom
in both groupings and at the end of the diff. Viewed marks are stored per session, mount and view, so two repos in one session
keep their own; marks saved before that are read until the mount saves its own.
Click a file and the
diff scrolls to it; scroll the diff and the tree highlights the file in view but
never opens a folder: when that file sits in a closed folder, the outermost
closed folder shows a small primary dot (`contains the file in view`). The tree scrolls
only when the file in view changes, and only far enough to show its row; a refresh of the
diff data never moves it again. Folds are
remembered per session and project in `localStorage`
(`goodboy:diff-folds:v1:<session>:<mount>`, only your changes from the default,
at most 500 entries, in `useFoldState`), so closing and reopening the page, a
new file or another view never undoes them. A click in the tree, next unviewed,
`Viewed` and a link from another page open the folders above their file; `J`/`K`
walk every file in diff order, also those in closed folders, and leave the folds
as they are. A click, `J`/`K`, next unviewed and `Viewed` call the diff's
scroller directly (`registerScroller` on `DiffView`); `focusPath` is only for a
link from another page such as `Open in Files`. A refresh keeps the tree and
the diff on screen (`isRefreshing` on `useSessionDiff`); skeletons show only
on the first load and when the scope changes. The diff resets its mounted
batch, its observer and its place only when the list of paths changes, never on
a new array with the same paths, so marking a file viewed or a note changing
neither shortens the page nor drops an open composer. Folder row ids start with
`dir:`, so a folder and a file with the same path never share a key. The tree and the diff share one `useReviewState` (active
file, open folders, notes, `Viewed`), and a model in `features/diff/lib/changeTree.ts`
builds the rows. The file cards sit 8 apart on the 960 column (never the pane's width); a
card header is 44 high on the panel surface and holds the fold chevron, the status square,
the path (folders faint, the name whole, cut from the left, with a real tooltip) and
`+N −N`, then `Viewed` (a checkbox with the word; checked folds the file, tooltip
`Changed since you viewed it` when it went stale), the `Comment` word (tooltip with the count
of both kinds) and one `⋯` from the `diffFile` kind of the action registry with `Open in editor`,
`Show whole file` and `Copy path`. When only one of them applies (a peek with no editor and no
whole file) the header draws that one as a quiet word instead of a `⋯` of one item
(`ObjectMenuOrVerb`). A right click on the header lists the same actions.
`Show whole file` opens a right drawer (`FileWholeDrawer`) with the full file and the change
marked, loaded for the same view as the page (branch, working tree or commit). The drawer starts
in the page's Display layout and has its own Unified and Split toggle in its header: it is local
state and never changes the page's Display setting. A merged or closed pull request hides Viewed, Comment, Reply and
the other writes. Split needs a column content of 880 or more, otherwise `Display` says
`Split needs a wider window`. The write review form is not on this toolbar: it opens from the
pull request's `Write review` action and swaps the tab body for the review form with line
drafts. The section carries no Fix, Push, Rewrite or `PR #N` control of its own.

**Commits.** The branch graph updates immediately when a commit is moved,
folded, renamed or removed. Undo and Redo icon buttons sit in the Commits
header. The same actions use ⌘Z and ⌘⇧Z while the page is open;
text fields keep their own undo. Leaving the page clears the edit stack but
keeps its backup refs. The graph fills the page column at every width.
There is no preview column, saved edit plan or Apply step for manual edits.
The existing Force push action updates the online branch separately. While the branch is behind its base, `Rebase on main` takes the secondary slot and Force push moves to `Branch actions`.

Each live edit takes the shown mount, branch, worktree and expected head
(`changeLiveHistory`). The Git command (`history_live_edit`) holds a writer
lease across replay and branch movement, saves a backup before replay and
checks the result on a temporary copy. An agent reservation blocks inline,
and a busy row disables further edits without a queue. A conflict leaves the
branch, index and files unchanged, names the error inline and offers Rewrite
with an agent or Undo to dismiss the failed edit. Dirty files use the stash
consent and recovery flow. Undo and Redo restore a backup with an expected
head check; failures retain the stack and the captured retry target. None
of these operations pushes to GitHub, GitLab or Bitbucket.

Previous versions (`Previous versions n` under the graph, the `Previous versions` drawer, `Reset branch to this version`) live here. There is no
Rewrite history page: the old history address, the palette verb and Activity
history rows land on `branch/commits`. **Checks.** The checks of the pull request. A GitLab or Bitbucket
session reads them through the same five states once its host's
`canReadChecks` is on (GitLab: the jobs of the head pipeline, a job allowed to
fail counts as skipped; Bitbucket: its commit statuses; a token that cannot read pipelines gets the denied
notice with `Open GitLab settings`); while it is off the tab says Goodboy does
not show that host's checks yet (`checksViewOf`).

The Branch page shows one branch. The trail carries the choice (see Segment
menus); there are no worktree tabs. Every rewrite takes the shown
mount's `mountId`, never the active mount. `Rebase on main` replays the
branch on origin with the history engine and runs no agent. The engine first
predicts the replay in memory; when it conflicts, the button reads
`Rebase on main · N conflicts`. A conflict stops the rebase with the branch as
it was and asks in the panel (`RebaseConflictPrompt` inside `RebaseStopPanel`): **Resolve with
Auto**, **Resolve myself** (`resolveRebaseMyself`: `worktree_start_rebase` in the worktree, then the
terminal; `worktree_rebase_conflicts` reads each file's markers and `worktree_continue_rebase` finishes
it) or **Keep branch as it was** (`keepRebaseStop`: it records `history_restored`
with `reason: 'kept'`, which settles the stop in every window, and only then drops the run; a
failed save changes nothing and offers Retry); no agent starts by itself. A clean rebase
moves the branch only after the engine checks the result, with a backup ref and
a push with lease.

The Commits tab draws the branch as a graph (`history_graph`): a grey main
trunk, your branch leaving it at the real fork point, one
row per commit newest first, and the base row at the fork. There
is no row of fact chips over it: the graph already says how many commits are
yours, how far main moved and what is online. At rest the section is one
column (`grid-cols-1`) on a 72px lane (trunk at x 20, lane at x 52): one row
per commit (title, then sha, author and age in
`text-meta`, a faint `Not pushed` chip only on a commit that is not on the
online copy, the grip a faint mark of a row that drags), then the base row.

**The base row** (`HistoryBaseRow`) is the action point for the base. Behind the
base it reads `Based on main 9d4b1f7`; how far behind and `Rebase` live on the worktree
status line. The base chip (`branch → main`, a
searchable listbox of the repository's branches) picks another base; the button
then reads `Rebase onto <branch>`. The button asks in a `ConfirmPopover` anchored
to it and runs the rebase command (`rebaseBranch`, with `ontoBranch` for another
base) with a version of the current history kept. The Activity rebase suggestion
(`Open rebase`) opens this page on the mount it names, scrolled to the row with
the button focused (`HISTORY_FOCUS_BASE_EVENT`).
The page header has one `...` button (`HistoryKeysHint`, an anchored popover)
with `How to edit commits` (the Guide chapter Commits) and the keys of the
focused row (`useHistoryKeys/historyKeys.ts`); no teaching line sits under the
list. Each row's `...` menu lives in a fixed cell that shows on hover and
focus (`row-actions`, `HistoryRowActions`), and `Previous versions` is a fold
row with its count at the end (`HistoryVersionsLink`). The registry verb for
`mount.rewriteHistory` and `diff.rewriteHistory` reads `Edit commits`. There is no
preview or Apply step. The graph shows the live branch. Drag a row between
two others to move it, or onto another to fold it in. Focused-row keys are
Alt with arrows to move, C to fold, S to combine both messages, R or Enter to
rename, and Delete or Backspace to remove. Row titles and accessible names
read the refreshed commits after each successful edit.

The move refuses to overwrite local or untracked work. Files move with a
two-way read-tree, then the branch ref moves with compare-and-swap. Undo
and Redo use the same guarded move, writing a reciprocal backup first.
A changed branch or head stops the operation. Resolve-thread commit
references follow successful edits and return with Undo and Redo. A failed
metadata update leaves the recovery refs available and shows an error.
Empty commits stay; only removed or folded commits disappear. Commits before
the first edit keep their shas.

Every move leaves a backup under `refs/goodboy/backup/`, in a namespace made
from the full branch name. Live edits, Undo and Redo keep their backups for 30 days; they do not count
toward the retained-backup cap. Restoring an older version
uses the retained policy: the newest 20 per branch are kept, and an older one
is dropped only while another retained ref contains its commit. The newest backup is
never pruned. Older backups from the former naming remain read-only.

`Previous versions n` under the graph (and `Previous versions…` in the page menu) opens the `Previous versions` drawer (kind `history-versions`, side tier). Each version shows when, why (`Before a rebase`, `Before a fold or drop`, `Before a reword or edit`, worked out by `history_backup_facts`), the commit count, the difference with now and an expandable commit list. `Reset branch to this version` (danger, anchored confirm) moves the branch back and the drawer offers `Undo` right after.

History rewriter's writable directories
are its copy, that copy's own git admin folder, the object store and the
packed-refs lock file git takes when it clears a rebase marker. They confine
it only under an OS sandbox or permission check (Codex in `workspace-write`,
Claude outside `bypassPermissions`); in `bypassPermissions`, the default, the
kickoff's rules are what keep it inside the copy. Temporary copies left by a crash are removed when the
app starts. Each copy lives in a folder Goodboy reserves atomically under
`~/.goodboy/history-copies`, never in a temp folder a sandboxed agent can write, with an
owner file and a lock it holds while the copy is in use, and nothing deletes a
copy without both, so a second window never removes a copy in use. The owner
file records the copy's git admin folder when the copy is made; the rewriter's
roots and the cleanup use it only while it is `<common>/worktrees/<name>` and
its `gitdir` names exactly that reserved copy, never the copy's own `.git`.
Codex rewriter turns also lose write access to the temp folders. One line sits
above the code and replaces the old toolbar and its counts: `Compared with <base> ·
All N commits ⌄` on the left (the base is the mount's own base branch,
never a fixed `main`; a commit view reads `Commit abc1234`, the working tree
`Working tree`, `Staged only` or `Unstaged only`), and `Display ⌄`
on the right, because the view decides which files you see,
not what you do to the branch. `Display` holds `Unified | Split` and `Wrap long
lines` (on by default, saved as `goodboy:diff-wrap`; split always wraps). The
file count and the `+N -M` sums live in the change tree only. The diff scope has its own
keys, wired by `useDiffKeys` in `SessionDiffPane`, all in tree order (folders
first) and never while typing in a field: `J` and `K` go to the next and
previous file and skip the files of a closed folder, `[` and `]` are aliases;
`H` closes and `L` opens the folder of the file in view; `V` marks that file
viewed and goes to the next unviewed one; `N` goes to the next unviewed file,
wrapping to the first; `F` puts focus on the tree; `/` and `T` are one action
(`diff.focusFilter`, `T` is its alias) and focus the filter field, the one input
in the tree rail that carries `data-diff-filter` (it opens the rail first when
it is hidden behind `Sections`). The rail has no fold key. A line under the tree lists them once, from the registry (`keyHelp.ts`).

Big and folded cases (`shared/utils/windowRows.ts`).
Past 120 visible rows the tree draws only the rows in view plus a margin (fixed
28px rows, 44px for a rename), so 512 files scroll as light as 20. A change
over 300 files starts with its deepest folders over 50 files closed (a parent of
a big folder stays open), and starts that way again when a different set of
files arrives, not on a reload of the same files. The diff keeps its own
progressive mounting; the patch parse stays on the main thread because a
512-file patch parses and becomes a tree in about 2ms (`largeChange.test.ts`
fails over 100ms, the point where a worker earns its cost). While the diff loads the rail shows skeleton rows and
`Loading files…`. An empty scope drops the tree and the toolbar and shows one centred empty state on the page column
(`DiffEmptyState`): what is empty in plain words, the scope picker inline and,
when the other scope has files, one button that switches to it (`Show branch vs
main (6 files)`, `Show working tree (2 files)`; `alternate` on `useSessionDiff`
counts them). Files opens on the branch against its base when the working tree
is clean and the branch has commits ahead, unless the scope was picked in the
picker. The `brand-diff-large` scene is the 512-file case, `brand-diff-many`
the 40-file one, `brand-diff-empty` the clean branch and `brand-diff-edits-only`
the one that matches its base but has edits.

A jump is instant, not smooth: file bodies keep
`content-visibility` with a height estimated from their rows
(`bodyEstimatePx`, see docs/traps.md "Diff file body height"), so for a few frames the view
measures the picked header and snaps it back to the top until the heights
settle. While you read, `useScrollAnchor` keeps the file under you still when
a body above it renders and changes height; it stands down during that snap.
The picked file stays the active one until you scroll, so `J` and `K`
start from it. Each file has a sticky header (status letter, path, `from <old path>` on a rename,
changes, comment count, a visible `Comment on file` button, `Viewed`, `⋯` with
Open in editor, Copy path, Comment on file); a viewed file collapses and opens again when you unmark it, from the
header or from anywhere else, and generated or binary files start collapsed.
`Comment` (the header button, with the count of both kinds; the tree rows carry no comment
button) opens a composer under the header and scrolls to it. It always saves a local note on the file (the same note a line
gets, without an anchor), with a pull request or without one; the composer reads
`Note on this file` and `Add note` in both cases. The note sits under the file
header, counts in the header and the tree row, and lists in Comments
with the file path and no line. Reaching the pull request is explicit: `Post to GitHub` under the note
in Comments turns a file note into a `pr_review_drafts` row
with `line` 0 (no migration), sent with the next review as a GitHub `FILE`
thread (pending review, `addPullRequestReviewThread` with `subjectType: FILE`,
then submit) or a GitLab discussion with `position_type: file`. A file draft
written before 0.23 stays in the review draft, shows under its file header, and
is stale, and skipped on submit, only when its file leaves the pull request.
Rows are a CSS grid with `role="grid"`, never a table. Click a line
number to comment, drag or shift-click to cover a range; the composer and the
threads sit under the last line of the range. ⌘Enter saves, Escape cancels.
`+ Add note` on a line saves the note with the project and branch of the active
mount (`diff_comments.project_id` and `branch`, m223). A note shows `Edit`,
`Close note` and `Delete` in the diff (`Edit` rewrites the text through
`updateDiffCommentBody`; Delete acts at once and offers Undo, which posts the same note again); the one fix action is `Fix comments` in the toolbar. While a fixer
works on a note, Edit, Close note and Delete are disabled with "A fixer is working on
this note". Close note goes through `closeResolvedNote`, the same path
Comments uses. The Files tab shows only the notes of its own branch; a note
written before m223 is assigned to a branch only when a resolver run on a known
mount used it, and the rest wait in `Unassigned notes` on the Session overview,
each with `Move to` and `Discard`. `Move to` names the branch when the session
has one, and opens an inline row of branches (the active one first, one per
project and branch, no dialog) when it has several; the move goes through
`assignDiffComment(sessionId, noteId, mountId)`. `Discard` goes through
`discardDiffComments`: it deletes the rows at once and registers one
`undoable` ("Note discarded" or "N notes discarded"), whose Undo and ⌘Z
re-insert the same rows with the same ids (`restoreDiffComment`); a status
`discarded` would need a migration because `diff_comments.status` is a CHECK
list. With two or more notes the section header has `Discard all`. Write review puts
its form under the last file: the line comments with Edit and Delete visible at rest (Delete offers Undo), the verdict,
the summary, and one primary that says the verdict (`Approve`,
`Request changes`, `Submit comments`), ⌘↵ from the summary. The form's `⋯`
in the diff toolbar holds Discard review, which confirms. The actions are
the `writeReview` kind of the action registry. Files mount in batches of 20 as the
browser idles, so a large diff stays responsive.

**Notes and host threads in Files.** The diff draws both kinds of thread under their line, in one
card shell (`CommentThread`), told apart by words and glyph, never by colour alone. A
note is the `You` tile, the chip `Note`, its state and its age, with `Edit`, `Close note` and
`Delete`; a host thread is the host's glyph, the author's avatar and name, the chip `On GitHub`
(`On GitLab`, `On Bitbucket`), `Open` or `Resolved`, `3 replies` with the replies listed, and
`Reply` (an inline composer posting through the reply verb, only where the host can
take a reply), `Resolve` (only where it can resolve) and `Open in Comments`. A thread
carries an outcome slot after its kind chip, which `Fix comments` fills with the state of a fix.
Outdated host threads stay out of the diff and read `Outdated` in Comments. Threads of every host
with threads show, not only GitHub's (`useDiffReviewThreads`). There is no
Notes drawer: a note's home is its line, and Comments lists every thread. The doors that used to land
a note in a drawer land on the note: Files at its card (the card scrolls into view and takes focus) when
the branch has no pull request, its thread in Comments when it has one (`openReviewTarget` for a
`notes` destination, `reviewRequest` for a compose request, `Open in Files` from a thread).
Opening the run transcript of a note keeps its drawer beside Files.
