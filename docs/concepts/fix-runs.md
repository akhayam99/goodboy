# Fix runs and publishing

> **Read this when** you change how a fix run starts, which model it uses, how
> it retries, how accepted fixes and replies are pushed, or how a reply reads.
> **Not for** what a comment is and the words it shows
> ([review-comments.md](review-comments.md)) or the fix of a failing check
> ([next-steps.md](next-steps.md#failing-checks)).

A **fix attempt** is one agent working on one or more conversations (a
`resolve_attempts` row). It ends with a local commit and never pushes. After a
restart, Goodboy rebuilds everything from its database, not from a chat log.

## The commit

Goodboy reads what the commit is from git, not from the agent: a `fixup!` of a
commit on the branch shows as `Fixed in 9e8d7c6 · fixup of 3a1f9c2`, a revision
that rewrote an earlier fix as `· replaces 4f21c8b`.

- The default is a new commit for every fix. With the fixup style, Goodboy
  blames the commented line and asks the agent for `git commit --fixup=<sha>` of
  the commit that introduced it.
- Resolve never squashes or force-pushes. History changes only when you press
  Apply or Push in Edit commits.

Approving a fix fast-forwards the branch to it. When the branch moved on since
the fix started, the fix is cherry-picked onto the new head and that commit
becomes the sha on the branch. If it no longer applies, the pick is aborted and
the branch stays as it was.

- An approval interrupted after the pick landed finds the same change on the
  next try and records that commit instead of picking it twice.
- If recording the picked sha fails, preparing the publication (or **Recheck
  fix**) records it again before it checks the branch.

## Starting a fix run

Every start goes through `startBatch`: `Fix` on a comment nobody started, `F` on
the focused row, the `Fix N` line, the Overview card or the board card. Every
door shares one set, the fixable comments: open plus failed (`isFixableThread`,
`features/resolve/fixableComments.ts`). A comment that needs you is answered,
never relaunched, and a failed push is retried from the push. Opening Review
never starts an agent.

### The Fix comments drawer

`Fix` opens the **Fix comments** drawer (kind `fix-comments`, side tier, never a
dialog; `openFixComments`). The page does not move, and the open comment stays
selected.

- It lists every open comment, host threads and notes together, grouped by file,
  with the same filters as Comments. The comments that opened it start checked.
- The model chip opens the shared picker for the resolver role.
- `Analyze only` runs the resolver in `propose` mode: it edits nothing on the
  branch and keeps its changes as proposals (`recordResolveAttempt`). `Start fix
for N` is the `apply` mode. The choice is `ResolveLaunchChoice.mode`, `apply`
  when absent, so older batches and callers are unchanged.
- The commit style has no control here: it comes from the settings or the last
  batch.
- The choice is saved on the batch and on every attempt (`launch_choice_json`),
  and each start carries the thread ids and the marker contract.

Activity shows each launch as one row, `Fix comments · N comments`. A later
launch on a comment of an earlier batch is spawned with that resolver's
`parentAgentId`, so it nests under it.

A start from another page needs no window event. `requestReview` with a `fix`
request writes a pending launch into the `review-launch` slice
(`reviewLaunchRequests`), and the Comments tab consumes it when it mounts.

### One agent, one copy

A fix run is one agent in its own copy of the branch, so it never fights the
branch you are on. Up to four runs go at a time (the session limit), and the
rest wait with `Waiting for a free slot`. Answering a question, retrying a
comment and typing in the transcript all continue the same agent in the same
copy; Start over is the one way to a new agent.

## Model and retries

A fix run starts on the resolver role default (Sonnet 5.5 · Medium out of the
box), never on the model of the last launch.

- A model picked in the launch panel is kept for that session only, and the panel
  says so. Launching does not turn the default into a pick.
- A retry (Redraft, Answer, Retry) continues the same run on the model it started
  with and keeps its commit style and hint, so with fixup set the second round is
  a fixup too.
- Only a session pick that differs from the run's model starts the comment over
  as a new fix run on that model.
- The hint you type before a retry lands in the prompt's operator notes.

A failed comment offers **Retry in this run** (`retryCouldntFix` for that
comment, same run and copy; F) and **Start over with a new agent** (on the
session pick or the role default). `…` holds **Try another model** (the
`reviewComment.anotherModel` verb, which sets the model of a new agent), **Add a
hint**, Reply, Skip and Open transcript. Earlier attempts fold into one line
that opens to their reasons.

A failed delivery after the run has no button on the comment: the Branch header
reads `Retry N`, and its push result offers `Sync and retry`. The comment keeps
`Open` on the host when Goodboy could not confirm the reply landed.

## Bulk actions

Each bulk action on the Comments tab is a single store action.

- With no run (`fixRunOf` finds no launch with a live comment), the line under
  the tabs offers `Fix N` on the fixable set.
- With a run, `RunStatusBulkActions` sits at the end of the comments bar, and
  `bulkRunOf` hands it that run's entries.
- `Use the recommended answers (N)`, for two or more open questions with a
  recommended answer, opens the `Answer N questions` panel with each
  recommendation chosen. `Continue with N answers` calls `answerQuestions` once
  for the launch, on the same agent.
- `Retry N failed` calls `retryCouldntFix` with every could-not-fix comment of
  the launch.
- `Apply N fixes` calls `acceptReviewComments` (`review-bulk` slice). It walks
  the comments through the single accept (`acceptReviewItem`), skips one that is
  no longer ready, keeps going when one throws and names the ones it could not
  accept. It registers one undo operation, so `N accepted · Undo` and Cmd+Z
  (`app.undo`) revert the whole batch while the comments are approved and not
  pushed.

Push stays the only push.

## Publishing

Nothing reaches GitHub until you push, with one exception: a reply-only answer is
posted the moment you accept it when no accepted fix is waiting to push. With a
fix waiting it goes out with the push, and `Post reply now` posts it at once.

### Push

`Push N fixes` in the Review header, or ⌘↵ with the list focused, pushes every
accepted comment at once, whatever is selected. `Push only this one` sends one
fix with the earlier commits it carries.

- A clean preview pushes on that click. Otherwise it confirms inline with
  exactly what goes out and the commit style.
- A blocker (uncommitted changes, a commit nobody approved, a fix still running)
  replaces the confirm with its reason and the one move that clears it.
- A partial push says how many landed, marks the comment that did not with its
  reason, and offers `Retry push for N`.

When the push failed because origin moved, `Sync and try again` asks first, then
fetches origin, rebases the branch's unpushed commits on it in a copy without
pushing, and checks the push again. If they conflict with the new commits it
stops and says so, and the branch stays as it was.

### The publication

Behind the push runs a **publication**:

1. Lock the conversations it will publish.
2. Push the branch once, if there is code to send.
3. Post each reply, then resolve each thread on GitHub when you are allowed to
   there. Otherwise the thread stays open for the reviewer.

Goodboy saves a receipt for every step, and the outcome it reports is read from
those receipts: a thread shows as resolved only after GitHub confirmed it.

- A publication that stops halfway picks up at the first step without a receipt
  and never pushes or posts twice.
- Confirming the same publication twice runs it once.
- A publication is the only way a reply gets posted or a thread gets closed.

## How a reply reads

**Settings › Workspace › Replies and commits** sets the voice (Terse by default,
Friendly, Formal, or Like your replies, from a style note that **Learn from your
replies** writes from your last 20 review replies), the reply templates, **Sign
replies**, **Resolve the thread** (on by default), the commit style (new commit
or fixup of the commit that added the line) and **Update the reply after a
squash** (on by default). The page the reader sees is in
[../features/review.md](../features/review.md#replies-in-your-voice).

- The voice goes into the agent's prompt, and one value signs everything
  Goodboy posts.
- The two templates, When fixed and When not changing, are filled in code; the
  agent writes only `{reason}`. The other variables are `{commit}`,
  `{commit_story}`, `{fixup_of}`, `{reviewer}`, `{file}` and `{line}`, and the
  defaults are the reason, then `Fixed in {commit_story}.` or `Leaving this as
is.`
- `{commit_story}` is `{commit}` plus `c81e5aa, squashed into e31b9f4` when a
  history rewrite folded the fix. Reply and page always read the thread's last
  commit after rewrites.

### Update the reply after a squash

The setting is stored per workspace in the `settings` table under
`review.edit_posted_reply.<workspaceId>` (`0` = off). After a history rewrite is
pushed and a reply Goodboy posted names a sha that moved, Goodboy:

1. edits that reply in place with `updateReviewComment`
2. adds `Update: c81e5aa was squashed into e31b9f4.` (or `is now`) above the
   signature, once per sha change
3. rewrites the delivery receipt body so the Branch page shows the same text as
   GitHub

Replies from people are never edited. The per-thread history (first sha, folded
or not, posted sha and body, update lines) lives in the `settings` table under
`resolve.commit_story.<sessionId>.<threadId>`, so it needs no migration.
