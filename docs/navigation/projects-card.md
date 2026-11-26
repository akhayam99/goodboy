# The Projects and Linked cards

> **Read this when** you change the Projects, Folder or Linked card of the Context tab: a branch row, its chip, its menu, Rebase all, or mounting a project from there. **Not for** the Branch page those rows open ([branch-page.md](branch-page.md)) or the worktree states ([mounts.md](../mounts.md)).

The cards (`SessionLevel/LevelProjects`, `LevelLinked`, `LevelFolder`) sit at the top
of the Context tab (`ContextPageFrame`), with no identity row. Projects shows which
projects a session has materialized: sessions are created lazily
([concepts.md](../concepts.md) → Lazy sessions), and this card is where the footprint
grows. It always has the Add action, even before the first mount. What a worktree
asks you to decide shows in the Overview notices
([mounts.md](../mounts.md#worktree-rows-and-the-overview-notices)).

## Card grammar

Projects and Linked are cards (`SessionLevel/LevelCard`) with every Context card's
grammar:

- a `Band` (rounded `bg-fill`, 4px inset) whose head is `ContextCardHead` (32px, the
  title 12px in, the count from `countSlotText` beside it, the actions in one right
  slot on the title's centre line);
- the body pads 4px (`CONTEXT_CARD_BODY`) and a row adds 4px (`CARD_ROW_INSET`), so
  text, chevrons, dots and counts sit 12px in, and a hover fill keeps 8px of card
  around it;
- every `+`, header or project row, is `LevelAddTrigger` in its own 24px `xs` box
  with no override, so all share one right edge; the title and a fold chevron are
  one button; cards sit 12px apart (`PANE_RHYTHM.block`).

A card folds from its header and remembers it (`useLevelCardFold`,
`goodboy:session-rail-folded-cards:v1`). Folded, Projects keeps the worst worktree
state as one dot (`useProjectsSignal`), and Linked shows its count from 2, so a
state that needs you never hides in a fold.

## Projects is one tree

Every branch of the session lives in one tree, with no second list to go back from.
A merged or closed worktree stays a row with its pull request icon.

- **A folder row** (`SessionLevel/ProjectTree`) is its name and its `+`; the name
  toggles it, and a chevron shows only while folded. Its accessible name keeps the
  count and the host ("payments-api, 3 branches, on GitHub"), never as visible text.
- **A branch row** is one 28px line (`SessionLevel/WorktreeRow`, `BranchRowLine`):
  the pull request state glyph in its colour, the title (request numbers lead before
  it truncates) and at most one chip.
- **The glyph colour** (`pullRequestStateToneOf`, beside `pullRequestStateWordOf`,
  whose words are `PULL_REQUEST_PRESENTATION`'s labels, so Open reads Open
  everywhere): draft gray, open blue, approved green, in the merge queue a quiet gray
  (never open's blue), merged violet, closed gray, no pull request a neutral branch
  glyph. The state table is in packages/ui/design/rail-and-work.md.

### Row facts and the one chip

`features/branch/branchRowFactsOf` holds a row's title (the pull request title, else
the branch name in mono), state word, number, host key, finished flag, order rank
(queued, approved, open, draft, none, merged, closed), check counts and the one
signal.

- The chip is the signal, worst first: `n failing`, `Conflict`, `n behind`
  (`BranchRowChip`, `branchRowChipOf`). Approved, queued, open, draft and running
  checks draw no chip: the glyph colour carries them. Check counts come from the
  request's runs on any host, skipped kept apart from passed.
- The number, the state word and the branch are not on the line but in the fact card
  (`branchRowCardOf`: the branch as title, `#318` beside it, the state, the chip as
  **Status**, its cause as footnote) and the accessible name ("title, #318, Open,
  branch hl/fix, 1 failing"). The host is a logo, never text.
- **Counts load first, then show.** The card's git status reads land in the cache as
  one set, each held at most 1.5 s so a slow read never freezes the rest. Until every
  branch is read the rows, the `n branches behind` line and the Next rebase row show
  no count (the list is `aria-busy`); a refresh keeps the last complete set until the
  new one lands whole; a branch whose base changed shows no count until its new read.
- **Order.** Live rows by rank, ties by declaration (`branchRowsOf`); merged and
  closed fold into one "n finished" row at the folder's bottom (`FinishedFold`),
  closed by default, open while the current branch is inside. A row that changes
  state moves, and focus and the current branch follow the mount, never an index.
  Folds are remembered per session (`useRailTreeOpen`,
  `goodboy:session-rail-tree-open:v1`, the last 50 sessions).

## The current branch

There is no level 2 for a worktree: the card stays on the session level, and the
Branch lens only marks one row current (`isOpened`: the mount the Branch page shows).

- A click makes the branch current and opens its page in the centre through
  `switchBranchMount`, on that branch's landing tab (`branchLandingTabOf`), never on
  the tab, thread or diff focus of the branch it leaves. A click on the current row
  folds or opens its pages.
- Only the current branch shows pages, so the card stays small. Under it sits the one
  state pill, Rebase stopped before failing checks, behind and not pushed
  (`branchRowChipOf`, `branchRowFactsOf`); its failing count is the Checks tab's
  (`checksCountsOf`).
- A branch has no rows under it: its pages (Pull request, or Merge request on
  GitLab, Comments, Changes, Commits, Checks) are the Branch page's tabs, each counted
  by `branchTabFactsOf`. The Pull request entry names the request by number alone
  (`#9998`, `MR !42`), since the row names the branch.
- Changes opens the diff in the centre, its file list in that page's own rail, never
  in the card. Rebase actions live on the Branch page; Rebase all on the Projects
  header.
- A session restored with the Branch lens saved opens on the tree with that branch
  current and its page in the centre.
- Only one level shows, so a session never carries a nested card in the workspace
  list.

### The row menu

One menu per branch row, the mount registry for that worktree (`useMountRowMenu`,
the Overview tile's verbs): Switch branch…, Link work to this branch, Copy branch
name, Copy path, Open in editor, Close branch and the rest.

- The `⋯` (`MountRowMenuButton`, named `<project> · <branch> actions`), a right click
  and ⇧F10 open the same list.
- The `⋯` sits in a `row-actions` cell (`data-worktree-actions`): empty at rest on a
  row that is not current, shown on hover, focus and while open, always on the
  current row; the cell keeps its 24px so chips line up.
- The branch switch and Link work anchors open beside the row (`BranchRowAnchors`).
  The per-state rows are in [lens-surfaces.md](lens-surfaces.md#five-rows-in-a-menu).

## Rebase all

**Rebase all** (`features/history/RebaseAllCard`) is the card's first line: `n
branches behind` with a Rebase all button; while a batch runs, `Rebasing 2 of 9` with
Abort in the same 28px line; Dismiss once it ended, or `The Lead has the rest`. It
draws no branch list: each branch's state is on its row, from the batch in the store
(`rebaseAllRuns`, `rebaseAllBranchOf`), which the header line reads too
(`rebaseAllSummaryOf`). `branchRowChipOf` owns every chip text and tone.

| Row chip              | When                                                                                                                                             |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Rebasing`            | breathing (`soft-pulse`, still under reduced motion), the replay step in the tooltip                                                             |
| `Queued`              | quiet, waiting                                                                                                                                   |
| none                  | once rebased, even while its behind count is stale                                                                                               |
| `Conflict`            | danger, "Waiting for the Lead", on a branch Auto has not started                                                                                 |
| `Lead resolving`      | breathing with the Auto icon while the rebase is stopped in its worktree ("The Lead resolves 1 file: <path>", from its history run's stop files) |
| `Rebased by the Lead` | once an Auto branch is clean, until every Auto branch of the batch is (`rebaseAllBatchSettledOf`)                                                |
| `Failed`              | the cause in the row tooltip                                                                                                                     |

- A `Conflict` or `Failed` branch turns `rebased` once git shows the rebase finished
  outside the flow (`settleStaleRebases`, after a turn, on focus and on the
  `useRebaseStatuses` poll, mounted by `LevelProjects` and the central model). A pass
  that settles nothing writes nothing, and the settled stop ids keep only events the
  session still holds.
- A late answer for a gone batch is dropped by run id. Abort lets the branch in
  flight finish and skips the queued ones.

## Mounting from the card

The header `+` (`LevelAddTrigger`, a ghost `xs` icon button named Mount a project, no
border or fill at rest) opens the project picker at once (`MountProjectAction`): the
folders an agent asked for (`pendingMountProposals`), the workspace projects not yet
in the session, then `Choose a folder…`, which links a folder to the workspace
(`useConnectProject`, `addProject`) and mounts it in one step. The toast's Undo
unmounts it and removes it from the workspace (`mountWithUndo`). A folder of
repositories, a project of another workspace or a failure says why and offers Open
workspace projects.

Each repo project row ends in `+` named `New branch in <project>` (`ProjectRowAdd`),
opening the new branch form (`NewBranchMountAction`). It is the registry verb
`project.newBranch` (`features/actions/kinds/project.ts`, on a repo project with a
mount of a live session), so every surface running it opens the same form. It is
quiet (`faint-foreground`, `foreground` on hover or focus) but visible at rest and in
the tab order; a folder project keeps an empty slot of the same width. An archived
session draws neither `+`.

## Folder

Folder replaces Projects in a session that edits a plain folder in place
(`SessionLevel/LevelFolder.tsx`, the folders of `inPlaceFoldersOf`): one row per
folder, its name and what agents do there (`folderFaceLineOf`: "Documents · edits in
place", "No git yet · edits in place"), with the same `+`; Projects joins once a
repository is mounted. Mounting the card loads the session's saved turns, so the
Changes row has its count before the page opens. The Changes page
(`SessionWorkspace/parts/ChangesPane/`) is in
[features/overview.md](../features/overview.md#changes); an older session that works
in its own session folder keeps its list of file versions there.

## Linked

One row per linked item: provider mark, key in one 72px mono column cut at the end
(`LinkedKey`, full key in the tooltip) so titles start on one edge, title.

- A GitHub pull request a worktree row already owns is not listed again
  (`githubRefOf`, same owner/repo and number).
- The row opens the item; its right click holds Unlink and Move
  ([context-menus.md](context-menus.md#linked-tasks)).
- Its header `+` (`LevelAddTrigger`, named Link work) opens Link work (L). Every card
  header of the session level uses this one control, never a bordered chip.
