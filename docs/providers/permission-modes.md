# Permission modes per CLI

> **Read this when** you change what a permission mode becomes on a provider
> CLI, the read-only policy of a side job, or the default mode of a workspace.
> **Not for** what a permission mode means in the app
> ([concepts.md](../concepts.md)) or the other flags a CLI gets
> ([cli-flags.md](cli-flags.md)).

Every turn sends the session's mode to its CLI, not only to Claude.
`modeSupportFor` in `packages/core/src/permissions/modeSupport.ts` owns the table,
`sendTurn` sends its `runsAs` value, and `providers/cli_args.rs` turns it into
flags. A mode a CLI can't honor runs as the next stricter one, never a looser one.

| Mode                              | Claude              | Codex                                                       | Antigravity                      | Copilot                                                        | Cursor                      | opencode family                            |
| --------------------------------- | ------------------- | ----------------------------------------------------------- | -------------------------------- | -------------------------------------------------------------- | --------------------------- | ------------------------------------------ |
| Read only (`plan`)                | `plan`              | `-s read-only`                                              | `--mode plan --sandbox`          | `--deny-tool=write`, `--deny-tool=shell`, `--deny-tool=memory` | `--mode plan`, no `--force` | `--agent plan`: no edits, shell still runs |
| Don't ask (`dontAsk`)             | `dontAsk`           | runs Read only                                              | runs Read only                   | runs Read only                                                 | runs Read only              | runs Read only                             |
| Ask first (`default`)             | `default`           | runs Read only                                              | runs Read only                   | runs Read only                                                 | runs Read only              | runs Read only                             |
| Edits allowed (`acceptEdits`)     | `acceptEdits`       | `-s workspace-write`: commands run too, inside the projects | `--mode accept-edits --sandbox`  | `--deny-tool=shell`: edits run, commands do not                | runs Read only              | runs Read only                             |
| Full access (`bypassPermissions`) | `bypassPermissions` | `-s workspace-write`                                        | `--dangerously-skip-permissions` | `--allow-all-urls`, files stay inside the projects             | `--force`                   | `--dangerously-skip-permissions`           |

## Per CLI

- **Copilot**: Read only is deny rules over `--allow-all-tools`. The CLI says a
  deny rule wins, but no real turn has exercised it, so `modeSupport.ts` marks the
  cells Partly. The Auto role runs on Copilot like on Cursor, on that basis
- **Claude**: 2.1.282 lists `manual` in place of `default` but still accepts
  `default` as a hidden alias. Goodboy keeps sending `default`, because `manual`
  would break older CLIs
- **Allow and deny rules** reach Claude only (`--allowedTools`,
  `--disallowedTools`). An Auto child's launch guard deny rules
  (`launchGuard.deniedTools`) join the end of `--disallowedTools`, before `mcp__*`.
  Its offline settings (`launchGuard.env`) reach every CLI through the environment

### opencode

opencode turns carry `--dangerously-skip-permissions` in every mode, except a
confined read-only role (scout, planner, investigator, reviewer, Auto, an unknown
role). The `plan` agent denies edits but asks before a shell command, and the
flag approves the ask, so a Read only session on opencode can still run a shell.

No probe proves that `opencode run` without the flag denies the ask instead of
waiting. So `ensure_confinement` refuses every reading role on an opencode binary,
and Auto stays off the whole family (`AUTO_UNCONFINED_PROVIDERS`). The app's own
planner and summarizer runs do not pass the flag.

### Cursor read-only jobs

- `--mode plan` is read-only planning with no edits, passed without `--force`.
  Whether read-only shell commands still run is unchecked on a real turn, so
  Cursor's Read only stays Partly
- The planner and the summarizer never pass `--force` and ask for `--mode plan`.
  Only a Full access turn passes `--force`
- `providers/cli_args.rs` holds one read-only policy per provider and job, and
  every planner and summarizer argument list is checked against it before the CLI
  starts. A new side job flag goes through that policy, not into `planner.rs` or
  `summarize.rs`. The fake CLI tests check what really spawns

Since `cursor-agent` 2026.10.22 a headless run stops with "Workspace Trust
Required" in an untrusted directory unless it gets `--force` or `--trust`. A
read-only Cursor run (Auto turn, planner, summarizer, chat) gets `--trust`, which
grants no write or shell right; `--force`, `-f` and `--yolo` stay forbidden there.

`workspace_trust_args` in `providers/cli_probe.rs` adds `--trust` only when
`cursor-agent --help` lists it and the list has no `--force`, `-f`, `--yolo` or
`--trust`, so an older CLI keeps working. The first version that lists `--trust`
has not been checked.

## Why Ask first asks after the fact

- Claude answers a permission prompt in `--print` only through a host. With
  `--input-format stream-json` and `--permission-prompts host` (the 2.1.282
  default) it writes a `control_request` with `subtype` `can_use_tool` (tool name,
  input, tool use id, suggested rules) and waits for a `control_response` with
  `behavior` `allow` or `deny`. That shape is read from the 2.1.282 binary and
  `claude --help`; no real turn has exercised it
- `turn.rs` starts Claude with `-p`, the prompt on stdin and no input stream, so no
  host exists. Every call the mode doesn't allow is denied, the turn stops, and the
  permission card takes over

## Where the user sees it

- **Settings › Workspace › Permissions** shows the table in words, one column per
  provider, with the workspace and global rules. Each rule names who follows and
  who ignores it, and a deny rule ignored by a provider running agents in the
  workspace raises a warning. Remove deletes the rule (`permission_rule_delete`)
- The composer's mode picker offers Read only, Ask first, Edits allowed and Full
  access, and disables with a reason the rows the active provider can't honor.
  `dontAsk` stays in the type for older sessions, reads as Ask first, and is never
  offered. Auto's Claude turn runs `bypassPermissions` in Full access and
  `default` in every other mode, with `Read` as its one tool and the same deny
  list, so it stays read only. It reads project folders through `--add-dir` read roots, and a
  Grep or Glob grant is kept as `Read(//dir/**)`

## Default mode

- Every workspace starts on Full access (`workspaces.default_permission_mode`),
  written when the workspace is created (`NEW_WORKSPACE_PERMISSION_MODE`)
- A read with no workspace, no default or an unknown mode falls back to Ask first
  (`FAIL_CLOSED_PERMISSION_MODE`), resolved per provider through `resolveModeFor`,
  never to Full access
- The SQL column default of `sessions` and `workspaces` is still
  `bypassPermissions` for a row inserted without the column
- A new session takes its workspace's default, which **Settings › Workspace ›
  Permissions** can lower. A running session keeps its mode
