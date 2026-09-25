# Query bridge

> **Read this when** you want to know what an agent can read or do in your
> connected tools, or you are changing what it can ask and how it asks.
> **Not for** connecting an integration in the app (`concepts.md`), what a
> mount verb does on disk (`mounts.md`), or how Goodboy starts agent processes
> in general (`architecture.md`).

The query bridge lets an agent working in a Goodboy session use the tools your workspace is connected to. The agent asks Goodboy, Goodboy makes the call with your connection, and the answer comes back to the agent.

Your tokens and keys stay inside Goodboy the whole time. The agent never sees them.

## What agents can do

While they work, agents can read from your tools:

- Issues, their comments and their status transitions
- Pull requests, diffs, checks and review threads
- Errors with stack frames, tags and breadcrumbs
- Slack channels, threads and members

They can also act on them, the same way you can from Goodboy:

- Comment, reply in a review thread, resolve a thread
- Update an issue description or move it through a transition
- Approve, request changes, mark ready, merge or decline
- Push their branch and open a pull request or merge request
- Manage their own checkouts in the session: list, fork, switch, unmount
- Group their work into an ordered series of pull requests

## Tools it reaches

| Tool      | Reads                                      | Acts                                              |
| --------- | ------------------------------------------ | ------------------------------------------------- |
| GitHub    | PRs, diffs, checks, threads, issues        | comment, resolve, merge, push, open PR            |
| GitLab    | MRs, diffs, discussions, approvals, issues | note, resolve, approve, merge, open MR            |
| Bitbucket | PRs, diffs, comments, build statuses       | comment, approve, request changes, merge, decline |
| Jira      | issues, comments, transitions              | comment, update, transition                       |
| Linear    | issues, comment threads                    | comment, reply, update description                |
| Sentry    | issues and issue detail                    |                                                   |
| Slack     | channels, threads, users, permalinks       | reply, add reaction                               |

## What you control

- **Which tools.** An agent is told only about the integrations this workspace has connected through **Link integration**. With nothing connected, the agent hears nothing about the bridge.
- **Which account.** Each connection belongs to the workspace, and a project can override it with its own account. GitHub also works with your `gh` CLI login when the workspace has no GitHub token.
- **The connection itself.** Only you can connect, disconnect or check a connection. No agent can.
- **Draft first.** Pull requests and merge requests an agent opens start as drafts unless it asks for ready.

## What you see

- Comments, replies, approvals and merges show up in the tool itself, and in Goodboy wherever you read that tool
- A pull request an agent opens is linked to the checkout it came from in the session
- When an agent forks or switches a checkout, you see it in the session. After a fork, the work goes on in a new turn on the new checkout

## Where it runs

The bridge runs on macOS and Linux, and only while Goodboy is open. When you quit, agents started by that instance get a clear error instead of waiting.

Each running copy of Goodboy has its own bridge, so an installed build and a development build side by side never answer each other's agents.

## For contributors

### Design rules

**A secret never leaves the Goodboy process.** The agent never gets a token, a key, a header or a URL that carries one. It names a workspace, a provider and a verb. Goodboy finds the credential, makes the call and returns the result. Nothing may hand an agent a usable credential, not even indirectly.

That is why the bridge is not an MCP server or an injected environment variable. It talks over a Unix socket that only your OS user can read. So the line of trust is your OS account, not a token the agent could copy, log or forward.

**One catalog, three readers.** Each verb is declared once, in `CATALOG`. The dispatcher routes it, the CLI parses and prints it, and the prompt advertises it. One test fails when the prompt lists something the dispatcher cannot serve. Another fails when a verb in the catalog is never dispatched.

**No second implementation.** Every verb calls the same function the app already uses for that integration. A fix to a query reaches the UI and the agent at the same time. There is no second GraphQL document to keep in sync.

**Read and write are separate paths.** Reading an issue changes nothing. Posting a comment, merging, approving or moving a ticket is visible to other people. Running the command again does not undo it. Each verb declares its `Access`. Reads and writes go through separate arms of the dispatcher, so no write can come in through the read path.

**The credential stays with the person.** Connect, disconnect and validate are left out of the catalog on purpose.

**The advertisement is a cost.** The `[integrations]` block goes into every prompt of every turn. So it names only the providers this workspace connected, one line each. The details live in the CLI's `--help`, which costs nothing until an agent asks. A workspace with no connection gets no block.

**Same text for every provider.** The block reaches Claude, Codex, Cursor, Gemini and opencode through the guard-block channel. Nothing about the bridge depends on the provider.

**No verb writes an event.** There is no `session event` command. Typed actions record their own events inside the transaction that did the work. Polling records the requests it finds on the host. An agent that could write a lifecycle event could claim a merge that never happened.

### Calling the bridge

The CLI is the same executable the user launched, started with `query` as its first argument. It answers and exits before any window or plugin loads. So nothing ships next to the binary, and nothing is looked up on PATH.

Each turn Goodboy starts gets these environment variables:

- `GOODBOY_BIN`: the absolute path of the executable
- `GOODBOY_QUERY_SOCKET`: the socket this running copy listens on
- `GOODBOY_WORKSPACE_ID`, `GOODBOY_SESSION_ID`: the workspace and session of the turn
- `GOODBOY_MOUNT_ID`, `GOODBOY_RUN_ID`: the mount (one checkout of a project in the session) and the run the turn belongs to

The prompt shows the call as `"$GOODBOY_BIN" query <provider> <verb>`. The path is quoted because it may contain a space. Output is plain text, and `--json` returns the raw payload. `"$GOODBOY_BIN" query <provider> --help` prints the exact arguments of each verb.

Three scope flags work on every verb:

- `--workspace <id>` (or `GOODBOY_WORKSPACE_ID`) picks the workspace container
- `--project <name>` reads per-repository settings from that project's override row first, then from the workspace binding
- `--mount <id>` picks the mount a command acts on

A connection is stored on the workspace container. It holds one credential and one shared configuration, plus an optional override row per project. Some verbs already have their own `project` argument, such as a GitLab project path or a Jira project key. On those, `--project` keeps that meaning and does not set the scope.

Every response has the shape `{ok, data, error}`. When the bridge refuses, it can add a machine-readable `code` and a `candidates` list next to its message:

- `ambiguous_mount`: more than one mount fits, and the candidates are attached
- `mount_unavailable`: no mount fits, or its folder, branch or project is missing
- `branch_mismatch`: the branch checked out is not the one Goodboy recorded
- `branch_in_use`: that branch is already in use
- `unsafe_cleanup`: removing it would lose work or hit a running process
- `operation_pending`: the request may have run, so read it back
- `request_conflict`: same request id, different arguments
- `fork_unsatisfied`: the fork came back as the source mount, or on another branch, so no new turn starts

New codes can be added over time. The response shape stays the same.

The catalog also has one verb outside the integrations, `project materialize`. It adds a workspace project to the session as a mount with its own worktree and branch.

### Mounts

What each mount verb does to the worktree, the rows and the operation log is
described in [mounts.md](mounts.md#driving-mounts-from-an-agent). This section
shows how an agent calls them.

A session can hold several mounts of the same project. Each one has its own worktree, branch and pull request. `mount list` prints their ids. When a command that acts on a mount gets no `--mount`, the bridge runs it only if exactly one mount fits. Otherwise it refuses with `ambiguous_mount`. It never falls back to the first row.

The GitHub verbs and `gitlab mr-create` act on one mount. Most of them use the mount the turn belongs to by default. Opening a request is the exception: `github pr-create` and `gitlab mr-create` always need an explicit `--mount`.

`git checkout -b` does not say what the agent meant. The worktree looks the same whether the agent moved this line of work to another branch or started a second one next to it. So the agent says which one it means:

- `mount switch` moves the mount and keeps earlier pull requests as history
- `mount fork` creates another mount with its own worktree and leaves the source as it is

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

Fork when both lines of work need to stay. The new branch starts from the base you name. The source mount, its directory, its branch and its request links stay as they are.

```
"$GOODBOY_BIN" query mount fork \
  --mount <source-mount-id> \
  --branch ak/eng-3240-auth \
  --base origin/main \
  --reason "split authentication into its own request" \
  --request-id eng-3240-auth-fork \
  --json
```

The response gives `sourceMountId`, the new `mount`, its `operationId` and `requiresNewTurn: true`. After a successful fork, stop working in the current turn. Goodboy queues one more turn on the new mount and directory. That turn is told that uncommitted files from the source are not there. It can then cherry-pick the commits it wants and fix conflicts in the new place.

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

The response keeps the same `mountId` and `mountPath` and adds `previousBranch`. Request links on the previous branch stay as history.

`mount activate --mount <mount-id> --request-id <id>` only changes which mount the next turn uses. It does not move a git or provider action that is running or queued. Those keep the mount id and revision they had when they were queued.

### Mismatch recovery

A plain `git checkout`, `git switch` or detached HEAD never changes the branch Goodboy has on record for a mount. Inspection notes the mismatch. Writes on that mount then refuse with `branch_mismatch` until `mount resolve` says which branch is right.

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

- `switch` keeps the mount and takes on the branch that is checked out now
- `fork` keeps the checked-out branch in the existing directory, and creates a second mount for the branch Goodboy had on record

Both return the updated `mounts` array. Finish any merge, rebase or cherry-pick in progress before you resolve a mismatch.

### Pull requests and series

Opening a pull request or merge request always happens on one mount. `github pr-create` and `gitlab mr-create` need an explicit `--mount`. They open a draft unless you pass `--ready`, and they refresh from the provider first. Sometimes the remote accepts the request but the answer never comes back. A retry then finds the existing request and attaches it, instead of opening a duplicate. These two are the only verbs that create a request. Bitbucket reads know about mounts, but Bitbucket has no `pr-create`.

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

Tell Goodboy about a split and its order. Do not expect it to work out a stack from git.

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

A member with a mount is active. A member set without `--mount` is a planned spot in the order. The request text Goodboy writes for a series member includes `Part of ENG-3240` and its position. It never adds a reference that would close the work item of that series.

### Retry and cleanup

Every command that changes something takes a `--reason` and a `--request-id`. Goodboy records the request id before the app does anything. So a socket timeout returns `operation_pending`, not a failure, because the filesystem or the provider may already have changed.

- After a timeout, reuse the exact `--request-id`. Never pick a new one for the same attempt
- A request id that already finished returns the original result
- The same id with different input is refused with `request_conflict`
- At startup, Goodboy brings recorded operations back in line with the worktree and the database

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

The response sets `disposition` to `removed`, `missing` or `kept`, with a reason when it is kept. `--keep` detaches the mount and leaves its directory on disk.

Cleanup includes dependency directories in its size estimate. It refuses when any of these is using the directory:

- A running agent or a bound terminal
- A writer lease or a lock
- A git operation in progress
- Uncommitted changes, tracked or untracked

Archive, delete, **Settings** cleanup, merge cleanup, unmount and orphan cleanup all follow these same rules. Sometimes a directory with uncommitted work has to be detached. Then Goodboy keeps a record of who owns that path, so it stays visible for a later cleanup.

Removing a worktree never deletes its local branch. So `mount attach` can give an unmounted mount a new worktree from that branch.

### Restart and restore

Mount rows, request links, operations and series all survive a restart. When the app loads its state back, a missing folder is marked unavailable. It is never offered as a mount an agent can run in. If the branch still exists, `mount attach` recreates its worktree.

Goodboy attaches a pull request to a mount only when two things are true. First, a lookup at the provider confirmed the provider, host, repository, request number and head branch. Second, someone chose the mount and branch explicitly. A matching branch name alone does not prove what the user meant earlier.

### Socket lifecycle

Goodboy creates the socket when the app starts and removes it when the app stops. The socket belongs to the current OS user and stays on one machine. It answers only while the process that owns it is running. The bridge uses Unix domain sockets, so it works on macOS and Linux. Unix socket paths have a length limit set by the platform. A very long state directory path can stop the listener from binding.

**One socket per running instance.** The file is `query-<pid>.sock` in `~/.goodboy`, named after the process that opens it. With a fixed name, the file would belong to whichever instance started last, and nobody would notice. Agents of the first instance would talk to a bridge that answers from another database with other credentials. Naming the file after its owner makes that clash impossible, so there is nothing to detect.

**No manual cleanup.** A crash can leave old socket files behind. Before it binds, a starting instance removes every socket in that directory whose owner pid no longer exists. It never touches a socket whose owner is still alive, and that includes another running instance. Earlier versions used the fixed name `query.sock`. Goodboy removes that file only when nothing answers on it, so an older build that is still running keeps working.

**The prompt and the env follow the same check.** A connected integration does not mean the bridge is reachable. If the prompt names a command the agent cannot run, the agent reads a shell error instead of an answer. So credentials alone do not decide whether the block appears. The env injection and the prompt both use one check. It passes when this process owns a bound listener and its socket file still exists. The frontend asks through `query_bridge_serving` and treats a failed call as false. The agent gets the path this process bound, so it never inherits another instance's address.

Because of this check, the block does not appear on Windows, where nothing binds. It also does not appear before the listener is up or after it is gone.

### Code map

- `apps/desktop/src-tauri/src/query_bridge/protocol.rs`: request and response types, env var names, error codes, `CATALOG`, argv parsing and help text
- `apps/desktop/src-tauri/src/query_bridge/dispatch.rs`: checks the connection, picks the mount scope, and runs the read and write arms
- `apps/desktop/src-tauri/src/query_bridge/github.rs`: GitHub verbs over `gh`, using the workspace token or the CLI login
- `apps/desktop/src-tauri/src/query_bridge/mount.rs`: mount verbs and request creation, passed to the frontend on `query-bridge://mount-command`
- `apps/desktop/src-tauri/src/query_bridge/series.rs`: series verbs
- `apps/desktop/src-tauri/src/query_bridge/project.rs`: `project materialize`, passed to the frontend on `query-bridge://project-materialize`
- `apps/desktop/src-tauri/src/query_bridge/cli.rs`: the `query` entry point that `run_cli` runs
- `apps/desktop/src-tauri/src/query_bridge/mod.rs`: socket path, sweep of stale sockets, listener, `query_bridge_serving`, `apply_turn_env`
- `apps/desktop/src-tauri/src/lib.rs`: runs the CLI before any window opens, and starts and stops the listener
- `apps/desktop/src-tauri/src/turn.rs`: adds the bridge env to each turn Goodboy starts
- `apps/desktop/src/store/integrationsGuard.ts`: `QUERY_BRIDGE_VERBS` and the `[integrations]` guard block, tested against `protocol.rs`
- `apps/desktop/src/features/integrations/queryBridge.ts`: `isQueryBridgeServing`
- `apps/desktop/src/features/session/mountQueryBridge/`: frontend executor for mount and series commands
- `apps/desktop/src/features/session/projectMaterializeBridge.ts`: frontend executor for `project materialize`
