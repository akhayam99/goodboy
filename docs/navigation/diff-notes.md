# Notes, threads and review in the diff

> **Read this when** you change how a comment reads in the diff, a note on a file or a line, unassigned notes, Write review, host threads under their line, unchanged context or the identifier popover. **Not for** the Comments tab list ([branch-comments.md](branch-comments.md)) or the Changes layout and loading ([branch-changes.md](branch-changes.md)).

## A comment reads the same everywhere

A comment reads the same in the diff, the review pane and the page.

- `CommentBody` (`shared/components/CommentBody`) draws every body at
  `text-comment`, 14/22.
- The diff sets `font-sans` once on the container that holds its threads
  (`DiffFile`), so a thread and a composer inside a mono row never undo it. The
  `diff-font-sans` guard counts `font-sans` written under `features/diff` and only
  falls.

## Notes on a file

`Comment` (the file header button, with the count of both kinds; the tree rows
carry no comment button) opens a composer under the header and scrolls to it.

- It always saves a local note on the file (the same note a line gets, without an
  anchor), with a pull request or without one. The composer reads `Note on this
file` and `Add note` in both cases.
- The note sits under the file header, counts in the header and the tree row, and
  lists in Comments with the file path and no line.
- **Reaching the pull request is explicit.** `Post to GitHub` under the note in
  Comments turns a file note into a `pr_review_drafts` row with `line` 0 (no
  migration), sent with the next review as a GitHub `FILE` thread (pending review,
  `addPullRequestReviewThread` with `subjectType: FILE`, then submit) or a GitLab
  discussion with `position_type: file`.
- A file draft written before 0.23 stays in the review draft, shows under its file
  header, and is stale, and skipped on submit, only when its file leaves the pull
  request.

## Notes on a line

Rows are a CSS grid with `role="grid"`, never a table.

1. Click a line number to comment; drag or shift-click to cover a range. The
   composer and the threads sit under the last line of the range.
2. ⌘Enter saves, Escape cancels.
3. `+ Add note` on a line saves the note with the project and branch of the active
   mount (`diff_comments.project_id` and `branch`, m223).

- A note shows `Edit`, `Close note` and `Delete` in the diff. `Edit` rewrites the
  text through `updateDiffCommentBody`; Delete acts at once and offers Undo, which
  posts the same note again. Close note goes through `closeResolvedNote`, the same
  path Comments uses.
- While a fixer works on a note, Edit, Close note and Delete are disabled with "A
  fixer is working on this note".
- The one fix action is `Fix comments` in the toolbar.

### Unassigned notes

The Changes tab shows only the notes of its own branch. A note written before m223
is assigned to a branch only when a resolver run on a known mount used it; the rest
wait in `Unassigned notes` on the Session overview, each with `Move to` and
`Discard`.

- `Move to` names the branch when the session has one, and opens an inline row of
  branches (the active one first, one per project and branch, no dialog) when it
  has several. The move goes through `assignDiffComment(sessionId, noteId,
mountId)`.
- `Discard` goes through `discardDiffComments`: it deletes the rows at once and
  registers one `undoable` ("Note discarded" or "N notes discarded"), whose Undo
  and ⌘Z re-insert the same rows with the same ids (`restoreDiffComment`). A status
  `discarded` would need a migration because `diff_comments.status` is a CHECK
  list.
- With two or more notes the section header has `Discard all`.

## Notes and host threads in Changes

The diff draws both kinds of thread under their line, in one card shell
(`CommentThread`), told apart by words and glyph, never by colour alone.

| Kind          | Reads                                                                                                                                                         | Verbs                                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A note        | the `You` tile, the chip `Note`, its state and its age                                                                                                        | `Edit`, `Close note`, `Delete`                                                                                                                               |
| A host thread | the host's glyph, the author's avatar and name, the chip `On GitHub` (`On GitLab`, `On Bitbucket`), `Open` or `Resolved`, `3 replies` with the replies listed | `Reply` (an inline composer posting through the reply verb, only where the host can take a reply), `Resolve` (only where it can resolve), `Open in Comments` |

- A thread carries an outcome slot after its kind chip, which `Fix comments` fills
  with the state of a fix.
- Outdated host threads stay out of the diff and read `Outdated` in Comments.
  Threads of every host with threads show, not only GitHub's
  (`useDiffReviewThreads`).
- There is no Notes drawer: a note's home is its line, and Comments lists every
  thread.
- **A door to a note lands on the note**: Changes at its card (the card scrolls
  into view and takes focus) when the branch has no pull request, its thread in
  Comments when it has one (`openReviewTarget` for a `notes` destination,
  `reviewRequest` for a compose request, `Open in Changes` from a thread).
- Opening the run transcript of a note keeps its drawer beside Changes.

## Write review

`Write review` is a child state of Changes, opened from the pull request's `Write
review` action: it swaps the tab body for the review form with line drafts. The
mode lives in the store per session and drops back when the page closes.

- The form sits under the last file: the line comments with Edit and Delete visible
  at rest (Delete offers Undo), the verdict, the summary, and one primary that says
  the verdict (`Approve`, `Request changes`, `Submit comments`), ⌘↵ from the
  summary.
- The form's `⋯` in the diff toolbar holds Discard review, which confirms.
- The actions are the `writeReview` kind of the action registry.

## Unchanged context

Files can reveal unchanged context.

- Each hidden range offers the next 20 lines beside either hunk, or all of its
  lines. Small ranges use one action.
- The file's final range stays uncounted until its sides load.
- Expansion stays with the file while scrolling and resets on a diff refresh.
- A failed read keeps the existing lines and offers Retry; oversized files offer
  the editor.
- The per-file expand-all registration in `features/diff/components/DiffView` lets
  file actions reveal the whole file.

## Where a name is defined

A double click on a name in a diff line shows where it is defined and used; Alt
click does the same. This contract lives in
`features/diff/components/IdentifierPeek`.

### The popover

- It shows project constants, functions, methods and types. A word without a
  project definition reads "Not defined in this project" and lists no uses.
- It shows the symbol kind and the definition, use and change counts.
- Groups: Defined in first, then Changed on this branch with changed lines first
  and tagged, then Unchanged files with five references and Show more. A file
  appears under one group only: the file that holds the definition lists all its
  uses under Defined in, so Changed on this branch holds the other changed files.
- A long directory drops its leading segments behind a `…/` and keeps the segments
  next to the file whole, dimmed and joined to the filename with no gap. The file
  name is never truncated, the directory shrinks first, and the full path is the
  row's title.
- It says when it shows only the first 300.

### The drawer

Every result opens the right drawer (`identifier-peek`, in
`features/diff/components/IdentifierPeekDrawer`) and never moves the page: its
scroll and selection stay.

- The drawer lists the same files in the same three groups, one row per file with
  one row selected; a definition file the branch changed carries a Changed tag. The
  list scrolls and shows five to six rows.
- A file changed on this branch shows its whole-file diff scrolled to the match. An
  unchanged file shows its source around the match under its full path and a
  one-line note, with an info icon, that it has no changes here.
- Choosing another file swaps the view and keeps the drawer open. A failed search
  or diff load has a Retry in the drawer.
- The drawer is keyed by worktree and word, so a late answer for an old word is
  dropped.
- The commit view has no peek, because its lines are not the working tree's.
