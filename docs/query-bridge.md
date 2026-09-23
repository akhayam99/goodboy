# Query bridge

> **Read this when** you want to know what an agent can read or do in your
> connected tools, or you are changing what it can ask and how it asks.
> **Not for** connecting an integration in the UI (`concepts.md`) or the
> subprocess environment in general (`architecture.md`).

The query bridge lets an agent working in a Goodboy session use the tools your workspace is connected to. The agent asks Goodboy, Goodboy makes the call with your connection, and the answer comes back to the agent.

Your tokens and keys stay inside Goodboy the whole time. The agent never sees them.

## What agents can do

While they work, agents can read from your tools:

- Issues, comments and transitions
- Pull requests, diffs, checks and review threads
- Errors with stack frames, tags and breadcrumbs
- Slack channels, threads and members

They can also act on them, the same way you can from Goodboy:

- Comment, reply in a review thread, resolve a thread
- Update an issue description or move it through a transition
- Approve, request changes, mark ready, merge or decline
- Push their branch and open a pull request or merge request
- Manage their own checkouts in the session: list, fork, switch, unmount
- Group a split into an ordered series of pull requests

## Tools it reaches

| Tool      | Reads                                      | Acts                                              |
| --------- | ------------------------------------------ | ------------------------------------------------- |
| GitHub    | PRs, diffs, checks, threads, issues        | comment, resolve, merge, push, open PR            |
| GitLab    | MRs, diffs, discussions, approvals, issues | note, resolve, approve, merge, open MR            |
| Bitbucket | PRs, diffs, comments, build statuses       | comment, approve, request changes, merge, decline |
| Jira      | issues, comments, transitions              | comment, update, transition                       |
| Linear    | issues, comments                           | comment, update description                       |
| Sentry    | issues and issue detail                    |                                                   |
| Slack     | channels, threads, users, permalinks       | reply, add reaction                               |

## What you control

- **Which tools.** An agent is told only about the integrations this workspace has connected through **Link integration**. With nothing connected, the agent hears nothing about the bridge.
- **Which account.** Each connection belongs to the workspace, and a project can override it with its own account. GitHub also works with your `gh` CLI login when the workspace has no GitHub token.
- **The connection itself.** Connecting, disconnecting and checking a connection are yours. No agent can do any of them.
- **Draft first.** Pull requests and merge requests an agent opens start as drafts unless it asks for ready.

## What you see

- Comments, replies, approvals and merges land in the tool itself, and in Goodboy wherever you read that tool
- A pull request an agent opens is linked to the checkout it came from in the session
- A fork or a switch of a checkout shows up in the session, and a fork continues in a new turn on the new checkout

## Where it runs

The bridge runs on macOS and Linux, and only while Goodboy is open. When you quit, agents started by that instance get a clear error instead of waiting.

Each running copy of Goodboy has its own bridge, so an installed build and a development build side by side never answer each other's agents.

## For contributors

### Design rules

**A secret never leaves the Goodboy process.** The agent never receives a token, a key, a header or a URL that carries one. It names a workspace, a provider and a verb. Goodboy resolves the credential, performs the call and returns the result. Anything that would hand an agent a usable credential, even indirectly, is out of bounds.

That is why the bridge is not an MCP server or an injected environment variable. The transport is a Unix socket owned by the user with no other reader, so the trust boundary is the OS account, not a token the agent could copy, log or forward.

**One catalog, three readers.** A verb is declared once, in `CATALOG`. The dispatcher routes it, the CLI parses and prints it, and the prompt advertises it. A test fails when the advertisement drifts from what the dispatcher can serve, and another when a catalogued verb is never dispatched.

**No second implementation.** Every verb lands on the function the app already uses for that integration. A fix to a query reaches the UI and the agent at once, and there is no second GraphQL document to keep honest.

**Read and write are separate paths.** Reading an issue is inert. Posting a comment, merging, approving or moving a ticket is visible to other people and cannot be undone by re-running the command. Each verb declares its `Access`, the two are dispatched through separate arms, and no write can arrive by way of the read path.

**The credential stays with the person.** Connect, disconnect and validate are deliberately absent from the catalog.

**The advertisement is a cost.** The `[integrations]` block ships in every prompt of every turn. It names only the providers this workspace connected, one line per provider, and detail lives in the CLI's `--help`, which costs nothing until an agent asks. A workspace with no connection produces no block.

**Same text for every provider.** The block reaches Claude, Codex, Cursor, Gemini and opencode through the guard-block channel. Nothing about the bridge is provider-specific.

**No verb writes an event.** There is no `session event` command. Typed actions record their own events inside the transaction that performed them, and polling records the requests it discovers on the host. An agent that could write a lifecycle event could assert a merge that never happened.

### Calling the bridge

The CLI is the same executable the user launched, entered through the `query` first argument. It answers and exits before any window or plugin exists, so nothing is packaged beside the binary or resolved on PATH.

A spawned turn receives these environment variables:

- `GOODBOY_BIN`: absolute path of the executable
- `GOODBOY_QUERY_SOCKET`: the socket this instance bound
- `GOODBOY_WORKSPACE_ID`, `GOODBOY_SESSION_ID`: the turn's workspace and session
- `GOODBOY_MOUNT_ID`, `GOODBOY_RUN_ID`: the mount and run the turn is bound to

The prompt advertises the call as `"$GOODBOY_BIN" query <provider> <verb>`, quoted because the path may contain a space. Output is plain text, and `--json` returns the raw payload. `"$GOODBOY_BIN" query <provider> --help` prints the exact arguments of each verb.

Three scope flags work on every verb:

- `--workspace <id>` (or `GOODBOY_WORKSPACE_ID`) names the workspace container
- `--project <name>` resolves per-repository configuration against that project's override row first, then the workspace binding
- `--mount <id>` names the mount a command acts on

A connection is a binding on the workspace container: one credential and one shared configuration, with an optional per-project override row. On a verb that already owns a `project` argument, such as a GitLab project path or a Jira project key, `--project` keeps its verb-specific meaning and sets no scope.

The response envelope is `{ok, data, error}`. A refusal may add a machine-readable `code` and `candidates` beside its sentence:

- `ambiguous_mount`: more than one mount is eligible, candidates attached
- `mount_unavailable`: no eligible mount, or its folder, branch or project is missing
- `branch_mismatch`: the checked-out head differs from the recorded branch
- `branch_in_use`: that branch is already taken
- `unsafe_cleanup`: removal would lose work or hit a live process
- `operation_pending`: the request may have run, read it back
- `request_conflict`: same request id, different arguments
- `fork_unsatisfied`: the fork came back as the source mount, or on another branch, so no new turn starts

Codes are additive. The envelope does not change.

Besides the integration verbs, the catalog carries `project materialize`, which mounts a workspace project into the session as a worktree and branch.

### Mounts

A session holds several mounts of the same project, each with its own worktree, branch and pull request. `mount list` prints their ids. When a command that acts on a mount is given no `--mount`, the bridge serves it only if exactly one mount is eligible. Otherwise it refuses with `ambiguous_mount` and never falls back to the first row.

The GitHub verbs and `gitlab mr-create` act on one mount. They default to the mount the turn is bound to.

`git checkout -b` is ambiguous: the worktree looks the same whether the agent moved this line of work to another branch or opened a second one beside it. So the agent declares the intent:

- `mount switch` moves the mount and leaves earlier pull requests as history
- `mount fork` creates another mount with its own worktree and leaves the source untouched

Start by reading the mounts:

```
"$GOODBOY_BIN" query mount list --json
"$GOODBOY_BIN" query mount inspect --mount <mount-id> --size --json
```

`mount list` returns records with this shape:

```json
{
  "mountId": "<uuid>",
  "sessionId": "<uuid>",
  "projectId": "<uuid>",
  "mountName": "api",
  "branch": "ak/eng-3240-auth",
  "baseBranch": "origin/main",
  "mountPath": "/path/to/.goodboy/worktrees/<name>-<uuid>",
  "isAttached": true,
  "diskState": "present",
  "revision": 3
}
```

`mount inspect` adds `head`, `safety` and an optional `size` object. Check `head.matchesMount` before changing files. Check `safety.canRemove` and its `blockers` before asking to remove a directory.

Fork when both lines of work must remain. The new branch is cut from the named base, and the source mount, directory, branch and request links do not change.

```
"$GOODBOY_BIN" query mount fork \
  --mount <source-mount-id> \
  --branch ak/eng-3240-auth \
  --base origin/main \
  --reason "split authentication into its own request" \
  --request-id eng-3240-auth-fork \
  --json
```

The response names `sourceMountId`, the new `mount`, its `operationId`, and `requiresNewTurn: true`. Stop work in the current turn after a successful fork. Goodboy queues one continuation turn bound to the new mount and directory. That turn is told that uncommitted files from the source are absent, so it can cherry-pick the selected commits and resolve conflicts there.

Switch only when the current mount is the same line of work on a different branch.

```
"$GOODBOY_BIN" query mount switch \
  --mount <mount-id> \
  --branch ak/eng-3240-follow-up \
  --create \
  --reason "continue this mount on the follow-up branch" \
  --request-id eng-3240-follow-up-switch \
  --json
```

The response keeps the same `mountId` and `mountPath`, and includes `previousBranch`. Request links on the previous branch remain historical.

`mount activate --mount <mount-id> --request-id <id>` changes only the mount for the next turn. It does not redirect a running or queued git or provider action, because those keep the mount id and revision captured when they were queued.

### Mismatch recovery

A raw `git checkout`, `git switch` or detached HEAD never rewrites stored ownership. Inspection records the mismatch, and mount-scoped writes refuse with `branch_mismatch` until `mount resolve` says which reading is right:

```
"$GOODBOY_BIN" query mount resolve \
  --mount <mount-id> \
  --intent switch \
  --reason "the checkout replaced this line of work" \
  --request-id resolve-eng-3240-switch \
  --json

"$GOODBOY_BIN" query mount resolve \
  --mount <mount-id> \
  --intent fork \
  --reason "both the recorded and checked out branches must survive" \
  --request-id resolve-eng-3240-fork \
  --json
```

- `switch` adopts the observed branch on the existing mount
- `fork` adopts it on the existing directory and creates a second mount for the previously recorded branch

Both return the resulting `mounts` array. Finish an in-progress merge, rebase or cherry-pick before resolving a mismatch.

### Pull requests and series

Request creation is always mount-scoped. `github pr-create` and `gitlab mr-create` need an explicit `--mount`, open a draft unless `--ready`, and refresh the provider before creating. A retry after the remote accepted a request, but before the answer arrived, finds and attaches the existing request instead of opening a duplicate.

```
"$GOODBOY_BIN" query github pr-create \
  --mount <mount-id> \
  --title "Extract authentication" \
  --body "Moves the authentication boundary." \
  --base main \
  --reference-mode part-of \
  --request-id eng-3240-auth-pr \
  --json

"$GOODBOY_BIN" query gitlab mr-create \
  --mount <mount-id> \
  --title "Extract authentication" \
  --body "Moves the authentication boundary." \
  --base main \
  --reference-mode part-of \
  --request-id eng-3240-auth-mr \
  --json
```

The result contains `mountId`, `provider`, `host`, `repo`, `number`, `url`, `state` and `created`.

Declare a split and its order instead of asking Goodboy to infer a stack from git:

```
"$GOODBOY_BIN" query series create \
  --project api \
  --name "ENG-3240 split" \
  --total 6 \
  --work-item ENG-3240 \
  --parent-provider github \
  --parent-host github.com \
  --parent-repo acme/api \
  --parent-number 90 \
  --request-id eng-3240-series \
  --json

"$GOODBOY_BIN" query series set-member \
  --series <series-id> \
  --position 1 \
  --mount <mount-id> \
  --request-id eng-3240-series-1 \
  --json

"$GOODBOY_BIN" query series set-member \
  --series <series-id> \
  --position 5 \
  --request-id eng-3240-series-5 \
  --json

"$GOODBOY_BIN" query series list --project api --json
```

A member with a mount is active. One without `--mount` is a planned position. Generated request text for a series member includes `Part of ENG-3240` and its declared position, and never adds a closing reference for that series.

### Retry and cleanup

Every mutation takes a `--reason` and a `--request-id`. The request id is recorded before the app is asked to do anything, so a socket timeout answers `operation_pending` rather than a failure: the filesystem or provider may already have changed.

- Reuse the exact `--request-id` after a timeout, never a new one for the same attempt
- The same completed request id returns the original result
- The same id with different input is refused with `request_conflict`
- Startup recovery reconciles recorded operations with the worktree and database

Read the record back before deciding what to do next:

```
"$GOODBOY_BIN" query mount operation --request-id eng-3240-auth-fork --json
```

Unmount through the bridge instead of deleting a folder:

```
"$GOODBOY_BIN" query mount unmount \
  --mount <mount-id> \
  --reason "merged and approved for cleanup" \
  --request-id eng-3240-auth-unmount \
  --json
```

The response reports `disposition` as `removed`, `missing` or `kept`, plus a reason when kept. `--keep` detaches the mount and leaves its directory.

Cleanup counts dependency directories in its size estimate. It refuses when any of these hold the directory:

- A running agent or a bound terminal
- A writer lease or a lock
- A git operation in progress
- Dirty tracked or untracked work

Archive, delete, **Settings** cleanup, merge cleanup, unmount and orphan cleanup all use this same policy. If a dirty directory must be detached, Goodboy keeps a path ownership record so it stays visible for later cleanup.

Removing a worktree never deletes its local branch, so `mount attach` can give an unmounted mount a worktree again from that branch.

### Restart and restore

Mount rows, request links, operations and series survive restart. A missing folder is marked unavailable during hydration and restoration and is never offered as a runnable mount. If the branch still exists, `mount attach` recreates its worktree.

A pull request is attached to a mount only from a verified provider lookup that identifies the provider, host, repository, request number and head branch, and only onto a mount and branch chosen explicitly. Branch names alone do not prove the user's earlier intent.

### Socket lifecycle

The socket is created when the app starts and removed when it stops. It belongs to the current OS user, is local to one machine, and serves only while its owning process runs. The bridge uses Unix domain sockets, so it serves macOS and Linux. Unix socket paths have a platform length limit, so a very long state-directory path can keep the listener from binding.

**One socket per running instance.** The file is `query-<pid>.sock` in `~/.goodboy`, named after the process that binds it. A fixed name would belong to whichever process started last, and the loss would be silent: agents of the first instance would talk to a bridge answering from another database with other credentials. Naming the file after its owner removes the collision instead of detecting it.

**No manual cleanup.** Before binding, a starting instance removes the sockets in that directory whose owning pid no longer exists, which is what a crash leaves behind. It never touches one whose owner is alive, including another live instance. The fixed-name `query.sock` of earlier versions is removed only when no listener answers on it, so an older build still running is left alone.

**Advertised and injected are the same condition.** A connected integration does not imply a reachable bridge, and a prompt naming a command the child cannot run makes the agent read a shell error instead of an answer. So the advertisement is not gated on credentials. The env injection and the prompt both read one predicate: this process owns a bound listener and its socket file still exists. The frontend reaches it through `query_bridge_serving` and reads a failed call as false. The path handed to the child is the one this process bound, so a child never inherits another instance's address.

That predicate suppresses the block on Windows, where nothing binds, and before the listener is up or after it is gone.

### Code map

- `apps/desktop/src-tauri/src/query_bridge/protocol.rs`: request and response types, env var names, error codes, `CATALOG`, argv parsing and help text
- `apps/desktop/src-tauri/src/query_bridge/dispatch.rs`: connection check, mount scope, read and write arms
- `apps/desktop/src-tauri/src/query_bridge/github.rs`: GitHub verbs over `gh`, with the workspace token or the CLI login
- `apps/desktop/src-tauri/src/query_bridge/mount.rs`: mount verbs and request creation, relayed to the frontend on `query-bridge://mount-command`
- `apps/desktop/src-tauri/src/query_bridge/series.rs`: series verbs
- `apps/desktop/src-tauri/src/query_bridge/project.rs`: `project materialize`, relayed on `query-bridge://project-materialize`
- `apps/desktop/src-tauri/src/query_bridge/cli.rs`: the `query` entry point run by `run_cli`
- `apps/desktop/src-tauri/src/query_bridge/mod.rs`: socket path, stale-socket sweep, listener, `query_bridge_serving`, `apply_turn_env`
- `apps/desktop/src-tauri/src/lib.rs`: runs the CLI before any window, starts and shuts down the listener
- `apps/desktop/src-tauri/src/turn.rs`: injects the bridge env into a spawned turn
- `apps/desktop/src/store/integrationsGuard.ts`: `QUERY_BRIDGE_VERBS` and the `[integrations]` guard block, tested against `protocol.rs`
- `apps/desktop/src/features/integrations/queryBridge.ts`: `isQueryBridgeServing`
- `apps/desktop/src/features/session/mountQueryBridge/`: frontend executor for mount and series commands
- `apps/desktop/src/features/session/projectMaterializeBridge.ts`: frontend executor for `project materialize`
