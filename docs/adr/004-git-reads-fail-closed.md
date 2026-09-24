# ADR 004: git reads fail closed, git mutations carry their own config

> **Read this when** you read or render a repository's or worktree's git
> status, gate a control on it, or add a Tauri command that rewrites history
> or moves a working tree. **Not for** which git actions the product allows
> at all ([concepts.md](../concepts.md)).

Status: accepted, shipped in 0.1.82 (#1419).

## Context

The project and worktree status commands (today `repo::project_git_status`
and `worktree::worktree_status`) returned plain counters, and every failure
inside them collapsed into the value a healthy, fully synced repository
produces. A failed rev-list read as zero distance, an unresolvable main ref
and a failed rev-list were indistinguishable, a failed `git status` read as a
clean tree, unmerged paths were counted as both staged and unstaged, and
nothing read `MERGE_HEAD`, `REBASE_HEAD`, `CHERRY_PICK_HEAD` or
`BISECT_LOG`. The surface rendered all of it as "In sync and clean", so any
control gated on "clean" was enabled exactly when the gate had no
information.

The same release turned the main chip into a real mutation, a fast-forward to
the upstream. `worktree::git`, which every git call goes through, neutralizes
prompts and sets no config. That is harmless for reads and not for a
mutation: with `pull.rebase=true`, `rebase.autoStash` or `merge.autoStash` set
by the user, "just a pull" rewrites history and stashes a dirty tree, only on
the machines configured that way.

## Decision

**A git read is a closed three-state value, never numbers with an implicit
zero.** Both status structs carry:

- `upstreamDistance` and, for worktrees, `mainDistance`: either
  `{ kind: 'known', ahead, behind }` or `{ kind: 'unknown', reason }`. In
  sync is `known` with both counts at zero.
- `workingTree`: either `{ kind: 'known', staged, unstaged, untracked,
unmerged, changed }` or `{ kind: 'unknown', reason }`. An unmerged path is
  counted once, as `unmerged`.
- `inProgress`: the operation the checkout is stopped inside (`merge`,
  `rebase`, `cherry-pick`, `bisect`) or nothing.

`reason` is an enumerated value (`no-upstream`, `detached-head`,
`rev-list-failed`, `main-ref-unresolved`, `status-read-failed`) that
consumers match exhaustively; the set grows by adding a variant and fixing the
compile errors that follow. A consumer may render an unknown as a caution,
offer a retry, or fall back to a neutral count on a decorative counter. It
never renders an unknown as a positive claim about the repository and never
enables a mutation on one.

**A git-mutating command carries its own safety config; `git()` stays
config-blind.** A command whose verb consults user merge or rebase config
passes `-c pull.rebase=false -c rebase.autoStash=false -c
merge.autoStash=false` at its own call site. The fast-forward command
fetches, then runs `merge --ff-only` against the resolved upstream (`@{u}`),
verified to be a remote-tracking ref and never a local fallback. It accepts no
ref, refspec or remote from the UI, and refuses on a detached HEAD, a missing
upstream, an operation in progress, an unknown working tree or a dirty one.
The control that calls it stays visible and disabled with the reason.

**Git stderr is redacted before it reaches the user.** `worktree::git`
rewrites any `scheme://credentials@host` in an error to `scheme://***@host`.

## Consequences

- Consumers match on a discriminated union instead of reading
  `ahead > 0`, so the compiler asks each one what it does when the answer is
  unknown.
- `git()` behaves the same for every read-only caller; the safety decision
  sits where the destructive verb is written, in view of the next person who
  writes one.
- A mutating command that needs a different verb or config supersedes this
  record with a new ADR rather than reaching for `git pull`.
