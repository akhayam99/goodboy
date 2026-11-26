# Pushing a Lead's work

> **Read this when** you change why a child of a Lead cannot push, how Goodboy
> pushes a writer's work after its checks, a force push with its backup, or
> **Undo force push**. **Not for** the rows that hold a push for your answer
> ([publish.md](publish.md)) or the bridge verbs themselves
> ([query-bridge.md](../query-bridge.md)).

## Children never push

Only Goodboy pushes, and only after its own steps. The boundary is the query
bridge.

1. `readTurnStream` marks a child's spawn `isAutoChild` (`isAutoChildTurn`: the
   agent has a stored delegation, whoever started the turn, or the turn is a
   delegation with a confined role other than `auto`).
2. `turn_spawn` refuses an `isAutoChild` spawn with no child role or on a CLI
   other than Claude or Codex (`ensure_auto_child`), and records the pid it
   starts until it ends (`spawn_turn` in `query_bridge/auto_child.rs`).
3. `dispatch` refuses, before any host call, every `Access::Publish` verb whose
   socket peer descends from that pid. The pid comes from the socket, never from
   a run id in the request.

| Host      | Refused verbs                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------- |
| GitHub    | `push`, `pr-create`, `pr-ready`, `pr-merge`                                                          |
| GitLab    | `mr-create`, `mr-approve`, `mr-unapprove`, `mr-merge`                                                |
| Bitbucket | `pr-approve`, `pr-unapprove`, `pr-request-changes`, `pr-unrequest-changes`, `pr-merge`, `pr-decline` |

The child reads `auto_child_act` and "Goodboy pushes after its checks. Say in
your report what should be pushed." Reads, comments, thread replies and resolves
stay open. A hand started turn keeps every verb; a process from no recorded turn
is refused `caller_unknown`. An Implementer's default done-when ends "Nothing is
pushed." Scope: Auto children on Claude and Codex.

No child env holds a git host token: `apply_git_host_access` in `turn.rs` removes
every name in `HOST_TOKEN_ENV` (`GH_TOKEN`, `GITHUB_TOKEN`, the GitHub
Enterprise pair, `GITLAB_TOKEN`, `GITLAB_ACCESS_TOKEN`) and never adds the
workspace token, so the publish step runs in Goodboy with Goodboy's
credentials. Bitbucket
credentials never leave Goodboy's store. Reads go through the bridge.

Two backstops sit behind the boundary and are not the boundary:

- a git config in the env (`GIT_CONFIG_*`) that makes any push fail: pushurl
  `goodboy-blocked://auto-child` on `origin`, and a `pushInsteadOf` rewrite of
  every `https://`, `http://`, `ssh://`, `git://` and `git@` URL (a test runs a
  real `git push`);
- Claude deny rules `Bash(git push:*)`, `Bash(git push *)`,
  `Bash(*--no-verify*)`.

A child with a shell runs as your OS user. One that undoes the config on purpose
or calls `gh` or `glab` with your login is not stopped; the remote watch shows
the branch moved ([results.md](results.md#remote-watch)).

## Publish

A delegate child of role implementer or CI fixer may carry `publish`: `"push"`,
`"force"` or `{"mode","reviewer","changesContent"}` (`parseDelegatePublish`,
`packages/core/src/auto/publish.ts`). A scribe or read-only role is
`spec_invalid`; a retry cannot set it. It is stored in `request_json.publish`.
At the settle `planPublish` writes `result_json.verified.publish`
(`ResultPublish`), outcome still `completed`.

### The gate

`publishGateOf` holds when the agent did not close with `done`, ended in error,
or has `red` checks; `not_checked` and no verdict pass. "Not pushed: the checks
are red" is retryable only for red checks. The rows add their own hold
([publish.md](publish.md)).

### A plain push

The pushed sha is `checksRun.commit`, else the end head, and nothing is sent
before the attempt settles.

1. `planPublish` records `pushing` ("Pushing <branch> at <sha>").
2. `pushSettledPublish` claims it in one guarded statement
   (`claimAutoAttemptPublishStatement`: attempt and tree at that generation, not
   stopping, this window's lease) inside the per worktree queue
   (`publishQueue.ts`, shared with `publishAct`).
3. Only a claimed record goes through the `pushBranch` port
   (`sha:refs/heads/<branch>`).

A failed claim writes "Auto moved on or stopped before the push, so nothing was
pushed", retryable. The result lands on the attempt and, once the batch joined,
on the delegation (`followAutoDelegationPublishStatement`).

Recovery lives in `settledPush/`. `recoverTree` resumes an unclaimed `pushing`
record under the new owner and turns a claimed one into a retryable failure (the
retry reads the branch online first). `sweepStalePushing`, run by
`createPushSweep` from the runtime's first tick without holding it, does the same
for trees that never recover (done, finished, stopped); a row that fails to
settle is reported and the sweep goes on.

A confirmed record carries `startedAt` (written by the claim and by `pushRow`),
and `pushSettledPublish` leaves it alone
for `PUSH_LIVE_WINDOW_MS` (100 minutes: three git network timeouts plus a
margin), since another window may still push it. The sweep scans
`auto_attempts` once per boot, and once more after that window only when it met
such a record. No `startedAt` counts as old.

### A force push

1. It needs the online sha read at the attempt's start (`baseline_json.remote`;
   unknown holds).
2. It keeps a backup ref of that online sha (`history_backup_create`, kept stamp,
   so the History prune never drops it), and one of the start head when it
   differs. A backup that cannot be kept holds with "Fetch the branch and try
   again". A branch not online at the start gets no backup and no **Undo force
   push**.
3. It refuses a tree that differs from the start (`readCommittedFiles` start to
   sha) unless `changesContent` is set.
4. It waits as `awaiting_confirm`: one **Force push** / **Don't push** row per
   batch (`PublishRunRow`, rows from `publishRowsOf`), one `publish` bridge call
   for every id.

The row stays for the life of the push.

- `pushRow` saves `pushing`, `isConfirmed` true, before the push, so a reload or
  a second window shows **Pushing**. The save lands only while the record is in
  the state the act read (`expectedState` of
  `patchAutoDelegationPublishStatement` and its attempt twin), so two windows
  cannot both push; a late answer is quietly refused "This push is already under
  way."
- If saving the result fails, `settleRow` retries once, then writes a retryable
  failure "The push ran but its result was not saved. Retry the push to check
  the branch online", so the card never stays on **Pushing**.
- Then one line per branch (`publishLineOf`, the words of the `DelegationResult`
  chip): pushed with **Undo force push**, "Not pushed", or a danger notice with
  **Retry push**.
- A failed row raises no toast, nor does a refused answer whose record no longer
  waits for that act (`isPublishOpenOf`). That check reads the store after
  `loadAutoTrees`, so a reload in flight can swallow or add one toast.
- A failed force row stays once you acted (`isConfirmed` or `tries > 0`). A first
  plan held before anyone was asked shows only the chip.

### executePublish

`executePublish` reads the online sha first: already the checked sha means
pushed, nothing sent. Otherwise `pushWithLease` sends `<sha>:refs/heads/<branch>`
(`sourceSha`, `lease_push_args` in `github.rs`) with the lease on the recorded
online sha, never the branch name or HEAD, so a commit made after the checks is
not pushed.

- An unclassified failure reads the online sha back before writing anything. A
  lost lease reads "Origin changed. Check again before force pushing."
- Any failure is retryable once (`PUBLISH_MAX_TRIES`). **Retry push** plans from
  the record's sha and stored exit, never the head of now. A force retry reads
  origin again, keeps a new backup and waits for a new **Force push**; a plain
  retry pushes the recorded sha again.

### publishAct and Undo force push

`publishAct` (`confirm`, `decline`, `retry`, `put_back`) runs in the main window
in one keyed queue per worktree, writes guarded by generation and answers one
row per branch, so two of four branches can succeed.

**Undo force push** pushes the backed up sha (`leaseSha`) with the lease on the
pushed sha. A lost lease, or a read back that does not show the backup online,
changes nothing and keeps the button. Only after origin is back does it move the
local branch with the History restore, and only when the head is still the
pushed sha; otherwise the card says the local branch was left as it is, and why.

Auto reads the line in the digest ("Pushed ...", "Not pushed: ...", "Waiting
for you to confirm ..."); a later click does not send it again.
