# Publish gates

> **Read this when** you change how the Push a branch and Open or update a pull
> request rows hold a Lead's publish: a held push, a held pull request, or a
> pull request that waits for its push. **Not for** how Goodboy pushes once it
> may ([pushing.md](pushing.md)) or the rows and asks themselves
> ([permissions.md](permissions.md)).

Both rows are enforced in Goodboy's own publish step, never in the agent, which
cannot push at all. `readPublishPermissions` (`store/runtime/auto/level/`) reads
both values for the tree; a failed read is Ask for both, so it holds and never
publishes. No host carries its own gate.

## Push

`isPublishAskedOf` (`packages/core/src/auto/publish.ts`), read by `planPublish`,
is true for a force push at every value (it keeps its backup) and for a plain
push at Ask. At When checks pass a plain push is never held.

A plain push at Ask is written `awaiting_confirm`, not `pushing`, bound to its
branch and checked commit, so the commits stay local. It lists as
`push:<delegation>:<commit>` ("Waiting for you to confirm the push of <branch> at
<sha>").

- **Push** runs the publish act `confirm` (keyed queue per worktree,
  `expectedState` guard), so two answers push once.
- **Don't push** writes `declined`; `confirm` on it is Push now.
- A retry of an allowed push pushes the recorded commit once; a never confirmed
  push plans and asks again. A new attempt asks for its own commit, and an answer
  for an older commit is dropped.

## Pull request

The gate sits at publication, not at the Scribe's start. When a Scribe ends
completed with text and the row asks, `finishAttempt` calls
`holdScribePullRequest`: it inserts the grant before the settle
(`grant-pr-<attempt>`, kind `pull_request`, subject the mount id, version
`pullRequestTextVersionOf`: the attempt plus a hash of the exact title and body),
and the settle writes the held text to `result_json.verified.pullRequest`
(`ResultPullRequest`, `packages/core/src/auto/pullRequestAsk.ts`). Nothing
reaches the host; the delegation completes with "The pull request waits for you
to open it: <title>". `leadAsksOf` lists the grant only while a current settled
delegation holds its text.

**Open** goes through `answerPullRequest`:

1. it moves the grant through `answerGrant`;
2. it claims the record (`awaiting_confirm`, `failed` or `declined` to `opening`,
   a stale `opening` only after `PUSH_LIVE_WINDOW_MS`), checking in the same
   transaction that the delegation is current and the grant a current allowance
   (`allowedAutoGrantGuard`);
3. it calls the `publishScribePullRequest` port with the held title and body
   unchanged and the commit the push gate checked;
4. it writes `opened` with number and link and the grant `used` in one
   transaction, or `failed` with the reason, text kept.

If that save fails three times, `publishHeldPullRequest` throws with the number
and link so the answer reports it; the record stays `opening` until a stale claim
takes it.

- Open again on a failed or declined record retries once per claim (a declined
  grant goes back to allowed first); a second Open while one runs is settled.
- **Not yet** writes `declined` and keeps the text.
- A newer text on the same mount asks again, and the older answer is dropped.
- At Allow the text goes straight to the port.

The port carries the extracted `output`, so the host gets the title and body the
ask showed; the host path still adds its closing references and the hidden
Scribe signature, as on the Branch page.

## A pull request honours the push row

Opening a pull request pushes the branch (`createPrForSession`), so
`openOrHoldPullRequest` first runs `pullRequestPushGateOf`: at the settle at
Allow, on Open at Ask. It reads the local and online heads, and every go pushes
exactly that head (`pushSha`, a pinned plain push). An unreadable branch or head
fails the publication with a reason.

- It goes at once when the head is online, or when a publish record of the tree
  pushed that commit to the same target (same mount and worktree, branch and
  commit, never another mount that shares them).
- Otherwise it first runs the writer's host change check (`hostChangeRefusalOf`,
  [launch-guard.md](launch-guard.md#at-publish)); a refused or unread change fails
  the publication and raises no push ask.
- At When checks pass, a held writer push of that commit keeps the pull request
  held; otherwise it goes.
- At push Ask the record moves to `awaiting_push` ("The pull request opens after
  you push <branch> at <sha>"), reusing a writer's push ask for that branch and
  commit or raising a plain push record on the Scribe's delegation
  (`heldForPushStatements`; `publishAct` accepts it on a Scribe).

After every publish act, `releaseHeldPullRequests` reruns the gate for the held
pull requests of each pushed or declined mount: Push opens them once, Don't push
keeps them held ("Not opened: you declined the push of <branch>, and the pull
request needs it online first"), Push now opens them. One held at Allow with no
grant is checked against the row of now, and asks (`grant-pr-held-<delegation>`)
if it now says Ask.

## Tests

`publishGates.sqlite.test.ts` runs both gates on one mount per host (GitHub,
GitLab, Bitbucket): held pushes and their answers, retries, a newer commit,
force, the held text and its answers, the pull request behind the push row, the
pinned commit, a refused host change, a stale generation and a failed save after
the host opened it. The `work-lead-push` scene data is
`features/auto/testing/workLeadPushView.ts`.
