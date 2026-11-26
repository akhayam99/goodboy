# Review comments

> **Read this when** you change how Goodboy reads a pull request's comments,
> keeps notes, words a comment's state, checks it against git, or which verbs a
> comment offers. **Not for** how a fix run starts, retries and pushes
> ([fix-runs.md](fix-runs.md)) or the review verbs' words
> ([vocabulary.md](vocabulary.md#words-we-use)).

## Notes and conversations

A **note** is a comment on a line of the diff that stays in Goodboy: yours, or
one an agent reviewer left. A note never publishes on its own.

A **review conversation** is Goodboy's saved record of one review, issue or note
(a `resolve_threads` row, `packages/db/src/queries/resolve-thread.ts`). It keeps
its state, its verdict, its draft reply and the commits that answer it. Every
open review thread gets one as soon as Goodboy reads the pull request.

Review exists with or without a pull request. Without one, Comments reads `No
pull request yet` with `Create pull request`. On GitLab the nouns come from the
host (`PULL_REQUEST_NOUNS`: `merge request`, `MR`, `!42`).

- Comments lists the pull request threads and your notes together, told apart
  by a chip (`Draft`, `On GitHub`) and filtered by `All`, `Notes` and `On
GitHub`. A branch with only notes has the section too.
- Every open note also gets a conversation under its line in Changes. Deleting
  or resolving the note closes it.
- An agent reviewer's comments on a branch without a pull request are kept as
  notes, and stay notes when one arrives. Only `Post to GitHub` turns a note into
  a draft review comment.
- A note has no reply to write: `Apply fix` keeps the fix and closes the note,
  `Close the note` closes it without a change. Reopening a closed note opens a
  new conversation generation, so the resolved history stays beside it.

## Reading the pull request

Goodboy reads every page of threads GitHub returns. If the read fails, Review
shows the error from `gh` instead of an empty list.

The detail reads reviews, review requests and checks in three separate `gh pr
view` calls, so a field the access cannot read never hides the others. Each read
comes back `ok`, `denied` or `failed` (`checksRead`, `reviewsRead`,
`reviewRequestsRead`) with the first line of the error.

- `classifyGhFailure` decides `denied`. It mirrors the marker lists in
  `apps/desktop/src-tauri/src/github.rs`, and a parity test fails when they
  drift.
- When GitHub denies the checks rollup, the list and view calls ask again
  without it and the pull request carries `checksUnknown`. The Checks tab and
  the merge gates then say Checks unknown, never no checks.

## The five words

Every comment in a fix run shows one of five words, the same on every surface.
One pure projection (`features/resolve/commentProjection.ts`) owns them, and
every count is a count of comments, never of agents.

| Word         | Means                                                                                                     |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| Working      | The resolver is on it (Waiting behind another launch, Pushing while a push runs)                          |
| Needs you    | The agent asked: a `needs-input` outcome, or its last message when a turn ended with none                 |
| Ready        | The fix and the reply wait under the comment, Edited once you changed the reply                           |
| Couldn't fix | One sentence says why; a failed push stays here as Push failed                                            |
| Done         | Accepted (waiting for the push), Answered (then Replied on GitHub), Skipped, Pushed or Resolved on GitHub |

- A comment not yet in a fix run reads Open, which is not a sixth word.
- A turn that ends without an outcome is never a failure.
- Skipped never blocks the push. Resolved on GitHub means someone else closed
  it.
- What git says (Already on origin, Looks fixed, Still needed, Fix went
  missing), Comment changed and Checks failed are chips next to the word, never
  in place of it.
- The list groups by the word: Needs you, Working, Ready, Couldn't fix, Open,
  then Done, closed until you open it.
- Needs you is the only warning tone, Ready is neutral (the Apply fix button is
  the signal), and Failed is the danger tone, except a stop by you.

While a fix run exists, one status line under the tabs shows `Fixing N
comments`, the tally of the words (each count filters the list), the model, Open
transcript and Stop. Its `actions` slot holds the bulk buttons.

### Why it couldn't fix

The sentence comes from `resolve_attempts.failure_cause` (m225): the fix didn't
start, the provider stopped the run, every provider is over its limit, you
stopped it (shown as Stopped), the app closed while it worked, it conflicts with
a fix you accepted, the worktree is gone, or the fix couldn't be saved from its
copy. A comment written before m225 reads "Goodboy didn't record why". A failed
run also shows the last command it ran with its result and a link to the
transcript.

## Runs from comments

A run can start from comments instead of a fix. `startRoutedRun` takes
`sourceThreadIds` and the `sourceMountId` of the comments' branch, and the Lead
(or the one agent of a role run) is born with `sourceKind` `comment_run` and
those ids, notes (`note:<id>`) and host threads alike. The link is the agent's
`source_kind` and `source_thread_ids`, with no new table. A plan start with
comments, or a branch that left the session, is refused before any write.

`commentRunOf` (`features/resolve/commentRunOf.ts`) is the one answer to which
run works on a thread: the newest live agent that lists it and can hold threads
(`holdsCommentThreads`: a `comment_run` agent or the root of a Lead with no
other source). It reads `sourceThreadIds`, which a light agent row leaves out
(the light rows trap in [../traps.md](../traps.md)), so call it on a session
whose agents are full.

**Send to Lead** on a review comment adds it to the Lead's threads
(`addAgentSourceThread`), so it reads In a run. Taking the queued message back
before the Lead reads it frees the comment. A stopped or deleted run frees only
its own threads, and a fix or a re-check is never read as a run.

## Git state of a comment

Review reads git after a fetch when it opens and again before every push, and
keeps one state per thread in `resolve_threads.git_state`: `local`, `on_origin`,
`fixed_elsewhere`, `folded` or `missing`. The facts live in `sessionThreadGit`,
the per-thread computation in `store/slices/resolve/threadGitState.ts`, the git
side in `src-tauri/src/thread_git.rs`.

- **Already on origin**: the fix sha is already on `origin/<branch>`. It offers
  `Reply and resolve`, the header Push does not count it, and
  `preparePublication` pushes only the local threads.
- **Looks fixed**: no fix of ours, and a commit on origin that Goodboy did not
  make changed the commented line, or `git cherry` finds the fix under another
  sha. It shows the commit, its author and a few lines of its change, read in
  the thread's own worktree (`useOriginCommitDiff`, never the mount that takes
  the writes), or **Couldn't read this commit**. `Reply and resolve` posts
  "Handled in <sha> by @<author>", and `Fix anyway` returns to the normal flow.
  It is always a suggestion, never an automatic resolve.
- **Folded in** (`folded`): `computeThreadGitFacts` first asks
  `worktree_locate_fix`, and the same patch on HEAD under another sha folds the
  thread. It stays in the push with the remapped sha, and the push flow posts
  "Fixed in <old>, squashed into <new>" after the push lands. Only `on_origin`
  skips the push.
- **Fix went missing**: a fix sha on neither the branch nor origin, or a pushed
  sha origin lost. It has its own detail, and the `missing_commit` push blocker
  points to it.
- **You replied**: a reply you wrote by hand after the draft, whatever its text.
  `Resolve only` posts nothing, and `reconcileReplyOperation` recognises it too.

### Re-check

If git cannot answer, **Re-check** (`recheckThread`) spawns a read-only scout
(`sourceKind` `comment_recheck`, FixMode `recheck`) on the provider's cheapest
model. It ends with `<<comment-verdict threadId verdict sha evidence>>`
(`fixed-here`, `not-relevant`, `still-needed`), parsed by `extractCommentVerdict`
into `resolve_threads.verdict_json`.

The verdict offers one action (Reply and resolve, Close with this reply, Fix
again) and never acts alone. Where `canResolve` is false, as on Bitbucket, they
read `Reply` and `Post this reply`, with no `Resolve only`. `settleItemAnswered`
takes `allowIntegrated`, so a missing fix can be answered without undoing its
accepted decision.

## Comment changed

A comment turns to Comment changed only when the reviewer edits the original.
Every refresh compares the root comment's fingerprint with the one in
`resolve_threads.source_snapshot_json`, and a mismatch stores the new text, its
author and when Goodboy saw it.

- A plain write to the thread (a resolved flag, a phase, a stage) never marks
  it. The store moves the open item and its ready candidate to the new thread
  revision in the same transaction, as long as the reply, the commits, the
  question and the outcome are unchanged. A write that changes any of those
  leaves the item behind on purpose.
- Accept and Won't fix that miss on the revision reload the item. If the answer
  on screen is unchanged they retry once with the fresh revision; otherwise the
  buttons say "This answer changed since you opened it. Review it again."
- Opening a session moves any open item whose revision lags its thread, when its
  candidate is still ready and the thread is not working, asking or failed.
- `Keep the draft` adopts the new text as the baseline. `Redraft with the new
comment` moves the baseline when the agent starts.

GitHub's outdated flag (The line moved) and a new reply after the draft (New
reply from the author) are facts on the comment, not states, and never block
Accept.

## Verbs and keys

The drawer ends in the comment's verbs (`CommentDrawerActions` in
`FormActions`), the primary last on the right, each with its single key. A verb
that fails says why there, and its button reads Retry.

| Verb         | Key | Notes                                                                                                                   |
| ------------ | --- | ----------------------------------------------------------------------------------------------------------------------- |
| `Apply fix`  | A   | marks the comment for the push and lands a fix's commit on the local branch; never talks to GitHub                      |
| `Edit`       | E   | `Answer` when the agent asked, `Redraft with the new comment` when the reviewer changed it, `Add a hint` when it failed |
| `Reply only` | R   | drops the change and sends a reply; `Reply` where there is no change to drop                                            |
| `Skip`       | S   |                                                                                                                         |
| `Undo`       | U   | until the push; `Undo skip` on a skipped comment                                                                        |
| `Fix`        | F   | on a comment nobody started: opens the Fix comments drawer, with **Back to the comment** (`fromThreadId`)               |

- Apply fix and Skip move to the next open comment. J and K, or the arrows, move;
  Escape closes the drawer.
- Edit, Answer and Reply share one text box: ⌘Enter sends, Enter adds a line,
  Esc cancels, Preview shows the markdown.
- `…` in the drawer header holds the rest (Stop drafting, Resolve, Open in
  Changes, Agent transcript, Open on the host, Copy link) and shows only with two
  or more.
- A hover checkbox picks fixable comments (open or failed) and comments to
  review: X toggles, Cmd+A picks every fixable one, Esc clears. The bar `3
selected · Fix 3` opens the panel; `Apply 3 fixes` applies the pick. A batch
  is born only from a selection or one `Fix`.

The actions are the `review` and `reviewComment` kinds of the action registry
(`features/actions/kinds/`), so the buttons, `…`, the right click and Search or
run list the same set.
