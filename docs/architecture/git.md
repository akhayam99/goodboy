# Git

> **Read this when** you start a git process, read git status, change how a
> host outage is tracked, or change the diff's file sides or identifier peek.
> **Not for** the layout of the worktree and history modules
> ([rust-modules.md](rust-modules.md)) or where a session writes
> ([mounts.md](../mounts.md)). The other pages are listed in
> [architecture.md](../architecture.md).

## Launching git

Every git process the Rust shell starts goes through one builder,
`proc::git::Git` (`apps/desktop/src-tauri/src/proc/git.rs`). Nothing else in
production code builds a `git` command by hand, and a Rust test fails if it
finds one.

- **Every call** turns terminal prompts off (`GIT_TERMINAL_PROMPT=0`), sets the
  editors to `true`, and removes an inherited `GIT_DIR`, `GIT_WORK_TREE` and
  `GIT_INDEX_FILE`, so git always reads the repository the call names.
- **`batch_auth()`** also blanks the askpass helpers and puts ssh in batch
  mode. `worktree::git` uses it; the other callers keep their own auth.
- **`login_env()`** starts git with the login environment, for the one caller
  whose `pre-push` hook needs it (`remote_auth::run_git_authenticated`, which
  returns `GitError`).
- **`english()`** forces `LC_ALL=C`. A caller that matches git's error text
  (the worktree removal retry, the fetch that tells a missing branch from an
  outage) must use it, because git translates its messages.

Every call has a deadline set by its class (`GitClass`), and a caller can set
its own with `.timeout()`. When it fires, git and its children are killed and
the caller gets a `timeout` error that carries its class.

| Class   | Deadline   | Verbs                                                                                      |
| ------- | ---------- | ------------------------------------------------------------------------------------------ |
| read    | 3 minutes  | `status`, `diff`, `log`, `rev-parse`, `rev-list`, `ls-files` and the other verbs that look |
| write   | 10 minutes | every verb not named in the other rows                                                     |
| network | 30 minutes | `fetch`, `push`, `pull`, `ls-remote`, `clone`, `submodule`, `lfs` and `remote`             |

`spawn_streaming` is the exception: the history predictor keeps one
`git merge-tree --stdin` process open for a whole plan, so its caller owns the
lifetime.

A failure comes back as `GitError`, which serializes as `{kind, message}`. The
message carries the arguments and the stderr with URL credentials redacted.
`WorktreeError`, `GithubError` and plain `io::Error` callers map it without
changing their own wire shape.

## Git status reads

- **A git read fails closed.** Distances and the working tree are `known` or
  `unknown` with a named reason. A zero never stands in for a failed read, and
  an unknown never shows as a claim about the repository or enables a change. A
  command that changes git passes its own safety config where it is called, and
  `git()` stays unaware of config
  ([ADR 004](../adr/004-git-reads-fail-closed.md)).
- **The remote probe is a git read like the others.** `project_remote_probe`
  asks `ls-remote --symref origin HEAD` with a 15 second timeout, fetches the
  default branch only on a hit and sets `origin/HEAD`. Its four answers
  (`no-remote`, `unreachable`, `reachable-no-main`, `main-present`) fail
  closed: a timeout or a failed step is `unreachable`. It runs from
  `useBootstrapWatch` only while a project is in its first lap, on window focus
  and every 60 seconds (five minutes after three unreachable answers). That
  pace is `hostPollDelayMs`, the one backoff the host state below reuses.
- **Stage info is derived once per session.** `cachedStageInfoOf` keeps one
  derivation per session and the reads it made, and every caller (the board,
  the top bar, the sidebar, the rows) shares it. A write re-derives only the
  sessions whose reads changed
  ([typescript/state-writes.md](../typescript/state-writes.md#7-derived-facts-are-kept-per-session)).

### A host that does not answer

`hostReachability` holds one outage state per host (GitLab and Bitbucket), fed
by `refreshMountRequest`; [hosts.md](../hosts.md) → What an unreachable host
looks like owns what counts as an outage and the line under the top bar. The
rules this layer adds:

- A refresh the person asked for (`force`, or from a screen) always asks, even
  while silent refreshes are held back.
- Retry asks again for every session that already holds a request of that
  host.
- A second silent refresh of the same mount while one runs is dropped. A
  refresh from a screen or a first read still writes both the pending state and
  the result.
- `noteHostAnswer` writes only when the host state changes. Its late-answer
  guard sits in a record the slice owns, which an unchanged answer advances in
  place, so an older answer is still dropped.

## Diff file sides

`worktree_file_sides` reads local file contents for unchanged context
expansion (`apps/desktop/src-tauri/src/worktree/file_sides.rs`).

- An omitted old revision uses the same configured merge base as the branch
  diff; an omitted new revision reads the working file. Explicit revisions are
  resolved before reading their git objects.
- The missing first parent of a root commit, and a missing file, are an absent
  side.
- The `:0` revision names the index, so staged and unstaged comparisons read
  their own sides.
- A detected rename or copy reads the old path for the old side, following the
  repository's diff configuration.
- The read rejects absolute paths, traversal and symlinks outside the
  worktree, including a missing file below an escaping symlink.
- Either side over 2 MB or 20,000 lines, or holding invalid UTF-8 or NUL bytes,
  makes the whole result too large, with no text.

The frontend loader names the worktree and revision pair, fetches once per file
and diff refresh, and discards late results after its source changes.
`features/diff/hooks/useFileSides` owns the expansion cache and retry state.

## Identifier peek

`worktree_grep_word` (`apps/desktop/src-tauri/src/worktree/grep.rs`) backs the
double click on a name in a diff line.

1. It refuses a word that is not an identifier of 2 to 128 characters
   (`A-Za-z_$` first, then `A-Za-z0-9_$`) before any process starts.
2. It runs `git grep -n --column -z -w -I -F --untracked -e <word> --` in the
   worktree through the `Git` helper, with an argument array and a 3 second
   deadline.
3. It keeps the first 300 matches (`truncated` says more existed) and trims
   each line to 240 characters. Exit 1 is an empty list.

The definition guess is `features/diff/lib/definitionOf.ts`. It reads
declaration keywords for TS and JS, Rust, Python and Go, and also recognizes TS
and JS method signatures with a body on the same line and Go receivers. It does
not resolve imports or establish symbol identity across scopes. Definitions
under dependency and vendor directories or in lockfiles do not qualify, and
without a project definition the popover hides all uses.
`features/diff/hooks/useIdentifierUses` keeps only the latest answer.
