# The Changes tab

> **Read this when** you change the Changes tab of the Branch page: its file rail and tree, All files, the toolbar, how the diff loads and scrolls, the file cards or the keys. **Not for** notes, threads and review in the diff ([diff-notes.md](diff-notes.md)) or the Explore file drawer ([lens-surfaces.md](lens-surfaces.md#files-of-a-project)).

Changes is the branch against its base as one two-column page under the Branch
header (`ChangesPage` in `features/diff/components`, mounted by `BranchFiles`, the
one entry for the pull request page and the Projects block's pull request row).
The header and the diff stay on the 960 column (`PAGE_MEASURE.branchChanges` is
`column`), and the file list is its own full-height column on the left, the mirror
of a run page's Agents column. A merged or closed pull request hides Viewed,
Comment, Reply and the other writes. The section carries no Fix, Push, Rewrite or
`PR #N` control; Write review opens from the pull request's action
([diff-notes.md](diff-notes.md#write-review)).

## The file rail

`BranchPaneRoot` reads the frame's left slot through `useBranchRailSlot`
(`data-session-lead` of `SessionHeadFrame`, or the page's own `data-branch-lead`
outside a session frame) and hands it to `ChangesPage` (`BranchRailSlotContext`).

- The rail, a page `StudioRailLayout` (`surface` `changes-files`), is portaled there
  only while the page is on screen (`HeadSlotsGate` gives a hidden layer no slot),
  with a border on its right.
- Its first row (Hide files, then `Changed N | All files` with the totals,
  `ModeControl`) sits on the session title line; under it the filter field (`/`)
  with the filter menu, then the tree. Rail and diff scroll on their own.
- It opens at 340px, resizes from 220 to 560 and remembers width and fold per
  surface ([studios.md](studios.md#page-rails)). Hide files folds it to the Show
  files strip; `F` or `/` reopen it. Under a 1060px frame (rail included) it folds
  without saving; `F`, `/` or Show files open it beside the diff, and a pick folds it
  again.
- The tree and the diff share one `useReviewState` (active file, open folders,
  notes, `Viewed`), the keys live in `useDiffKeys`, and
  `features/diff/lib/changeTree.ts` builds the rows. The rail lists rows in a window
  (`useRowWindow`).

## The tree

- Folders first, then files, alphabetical; the diff follows the same order. A chain
  of single-child folders is one row (`src/ledger/export`). Folder ids start with
  `dir:`, so a folder and a file of the same path never share a key.
- **A folder row**: a progress ring (empty, partial, or a check once every file is
  viewed; tooltip `3 of 5 viewed`), the path and, only while collapsed, its file
  count and `+N −N` in one muted tone.
- **A file row** (28 high, 8 per level with a 1px guide): the viewed toggle (a
  checkbox button, `Viewed: <name>`; an amber dot when the file changed after it was
  viewed; none on a merged or closed pull request), the name (a rename shows `from
<old path>`, a deletion is struck through), a comment count chip whose tooltip
  names the kinds (`2 notes, 1 on GitHub`), `+N −N` only at a rail of 280 or more,
  and the status letter.
- `+N` and `−N` sit in two fixed right-aligned columns (`Delta`), and a closed folder
  keeps the status slot empty, so counts line up.
- **The status letter** is one mark (`FileStatusMark`) in the tree, All files (which
  leaves M out) and the file header: one letter in a 12px slot, A in success, D in
  danger, M and R muted, so amber stays for what needs you and blue for what runs.
- **A long name** keeps its first six characters and its last six with the
  extension chain (`Statem…ceCard.test.tsx`, `cutFileName`); a shorter one keeps its
  first three (`ind…dule.css`). A name is cut in the middle, never at its start; a
  screen reader gets it whole. Rows have no tooltip: the full path is in the file
  header.
- **Keys.** Up and Down move the cursor, Home and End go to the ends, Right and Left
  open, close and climb; `Enter` jumps the diff and keeps focus in the tree; `Space`
  toggles viewed (or folds a folder); `Esc` returns to the diff (folding a rail
  opened on a narrow pane).

### Filter and grouping

- The filter field (`/` and `T` focus it, `Esc` clears) matches a subsequence of the
  path.
- One menu beside it (`Filter and group files`, a count of 1 while a scope is on)
  holds `Show: All | Unviewed N | Commented N` and `Group by: Folders | Kind`, which
  regroups under Source, Tests, Config and Docs with each file's folder beside its
  name.
- The filter narrows the diff too, with `Showing n of N` and `Clear`. A filter that
  hides everything leaves `No files match.` in both panes, `Clear` on the tree and
  `Clear filter` on the page (`filterFiles` in `changeTree.ts`).
- Generated files (lockfiles, `dist`, `build`, `vendor`, minified and map files) sit
  in a closed `Generated` row at the bottom in both groupings and at the end of the
  diff.

### Viewed marks, folds and scroll

- Viewed marks are stored per session, mount and view, so two repos keep their own;
  older marks are read until the mount saves its own. A mark is read from status and
  counts alone (`fileSignature`), with or without hunks loaded.
- Folds are remembered per session and project in `localStorage`
  (`goodboy:diff-folds:v1:<session>:<mount>`, only your changes, at most 500
  entries, `useFoldState`).
- A tree click, next unviewed, `Viewed` and a link from another page open the
  folders above their file; `J`/`K` walk every file in diff order, closed folders
  included, and leave the folds.
- Click a file and the diff scrolls to it. Scrolling the diff highlights the file in
  view but never opens a folder: the outermost closed folder holding it shows a
  small primary dot (`contains the file in view`). The tree scrolls only when the
  file in view changes, just enough to show it; a data refresh never moves it.
- A click, `J`/`K`, next unviewed and `Viewed` call the diff's scroller directly
  (`registerScroller` on `DiffView`); `focusPath` is only for a link from another
  page such as `Open in Changes`.

## All files

`All files` swaps the list for `AllFilesTree` (`features/diff/components/ChangeTree`):
the worktree in the same tree, 28 high rows.

- A changed file shows counts and status, an unchanged one is muted with no counts,
  a deleted one is struck through, and a closed folder with changes shows its muted
  sum (`folderSumsOf`).
- Folders load when opened (`useExploreListing`), the switch lists only the root,
  and a deleted file or a diff-only folder comes from `allFilesListingOf`.
- A changed or deleted file scrolls to its diff. An unchanged file opens
  `FileReader` in place of the diff (`Unchanged against main`, the line count, `Open
in editor`, `Back to the changes`); a failed read says `Couldn't read this file`
  with Retry.
- The filter searches the loaded and changed files; viewed, next and the keys count
  changed files only.
- The mode is kept per session and folder in `exploreChangedView`;
  `PLACE_ROWS.changesMode` opens it on `All files`. With no change, `No changes
against main` offers `All files`.

## The toolbar

One line above the code (`ToolbarRow`, 40 high, its own inset, so the scope pill,
the file headers and the Branch title start on one x):

- **The scope pill** (`ChangesScopePill`, project and branch) picks the branch on the
  session's Changes page and is a label on a pull request page.
- **`Compared with <base> · All N commits ⌄`**: the mount's own base, never a fixed
  `main`. A commit view reads `Commit abc1234`; the working tree `Working tree`,
  `Staged only` or `Unstaged only`.
- **`Display ⌄`** on the right, since the view decides which files you see:
  `Unified | Split` and `Wrap long lines` (on by default, `goodboy:diff-wrap`; split
  always wraps). Split needs 880 of column content, otherwise its segment is
  disabled with `Needs 880px`.
- `Viewed N of M`, `Next` and the keyboard button (`ReviewProgress`; the viewed
  count from `viewedCountOf`, as the filter's Unviewed count). The keyboard button
  lists the keys once from the registry (`keyHelp.ts`).

The file count and `+N -M` sums live in the tree only. File headers stick under the
toolbar. The branch's worktree setup offer is a slim row under it (`WorktreeSetupOffer
layout="row"`), never a card; every other branch notice stays above the diff.

### Diff keys

`useDiffKeys` in `ChangesPage`, in tree order, never while typing in a field:

| Key      | Does                                                                                                  |
| -------- | ----------------------------------------------------------------------------------------------------- |
| `J`, `K` | next and previous file, skipping closed folders; `[` and `]` are aliases                              |
| `H`, `L` | close and open the folder of the file in view                                                         |
| `V`      | mark the file viewed and go to the next unviewed                                                      |
| `N`      | next unviewed file, wrapping                                                                          |
| `F`      | focus the tree                                                                                        |
| `/`, `T` | one action (`diff.focusFilter`): focus the rail's one `data-diff-filter` input, opening a folded rail |
| ⌥⌘B      | fold and open the rail                                                                                |

## Loading

On the branch scope the tree and counts come first from one cheap call,
`worktree_diff_files`: `{ path, oldPath, status, additions, deletions, isBinary,
isUntracked }` from `git diff --numstat` and `--name-status` plus `ls-files
--others`, so an untracked file shows as new with its line count.

1. With that list the page is ready: the tree, the file headers and every count come
   from it and never change when a body arrives.
2. A body loads when its card scrolls into view (`worktree_diff_file` with a
   rename's old path, parsed in a worker through `parseDiffAsync`, or on the main
   thread without one). Until then a 96px `Loading diff` skeleton; a failed body says
   so with `Retry`; a binary file asks for nothing.
3. `useDiffBodies` owns the bodies: one that answers after the view or the branch
   changed is dropped, and a refresh keeps them while the list and visible bodies
   reload.
4. A list arriving after the full diff is dropped; an empty or failed list falls back
   to the full diff. The full diff still loads in the background for `patch` (Copy
   patch) but is never parsed when the list answered.

- The diff mounts files in batches of 20 as the browser idles and draws a body only
  near the viewport (`content-visibility`, `useRequestSeenBodies`). While it loads
  both columns show skeletons; the rail's rows are named Loading files for screen
  readers, with no word on screen.
- A refresh keeps the tree and diff on screen (`isRefreshing` on `useSessionDiff`);
  skeletons show only on the first load and a scope change.
- The diff resets its batch, observer and place only when the list of paths changes,
  never on a new array of the same paths, so marking viewed or editing a note never
  shortens the page or drops an open composer.
- The Comments tab asks for a thread's file body before drawing the code around it.

### Big and folded cases

`shared/utils/windowRows.ts`: past 120 visible rows the tree draws only the rows in
view plus a margin (fixed 28px rows, 44px for a rename), so 512 files scroll like 20. A change over 300 files starts with its deepest folders over 50 files closed (a
parent of a big folder stays open), and again when a different set of files
arrives, not on a reload. The patch parse stays on the main thread because a
512-file patch parses and becomes a tree in about 2ms (`largeChange.test.ts` fails
over 100ms).

### An empty scope

An empty scope drops the tree and the toolbar for one centred empty state on the
page column (`DiffEmptyState`): what is empty in plain words, the scope picker
inline and, when the other scope has files, one button to it (`Show branch vs main
(6 files)`, `Show working tree (2 files)`; `alternate` on `useSessionDiff` counts
them). Changes opens on the branch against its base when the working tree is clean
and the branch has commits ahead, unless a scope was picked.

### A jump is instant

File bodies keep `content-visibility` with a height estimated from their rows
(`bodyEstimatePx`, see docs/traps.md "Diff file body height"), so for a few frames
the view measures the picked header and snaps it back to the top until heights
settle. While you read, `useScrollAnchor` keeps the file under you still when a body
above changes height, standing down during that snap. The picked file stays active
until you scroll, so `J` and `K` start from it.

## File cards

Cards sit 8 apart on the 960 column (never the pane's width), each with a sticky
44px header on the panel surface:

- the fold chevron, the status square, the path (folders faint, the name whole, cut
  from the left, with a real tooltip), `from <old path>` on a rename, `+N −N`;
- `Viewed`, a checkbox with the word: checked folds the file, tooltip `Changed since
you viewed it` when stale. Unmarking reopens it from anywhere; generated and binary
  files start collapsed;
- `Comment` with the count of both kinds ([diff-notes.md](diff-notes.md#notes-on-a-file));
- one `⋯` from the `diffFile` kind: `Open in editor`, `Show whole file`, `Copy path`.
  When only one applies, the header draws it as a quiet word (`ObjectMenuOrVerb`). A
  right click on the header lists the same.

`Show whole file` opens a right drawer (`FileWholeDrawer`) with the full file and
the change marked, for the page's view (branch, working tree or commit). It starts
in the page's Display layout with its own Unified and Split toggle, local state that
never changes the page's setting.
