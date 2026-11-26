# How each CLI starts

> **Read this when** you change the arguments, the environment or the prompt
> channel Goodboy gives a provider CLI, or how its output is read.
> **Not for** what each permission mode becomes per CLI
> ([permission-modes.md](permission-modes.md)) or the effort flags
> ([models-and-effort.md](models-and-effort.md#effort)).

Turns, the planner and the summarizer get their arguments from
`providers/cli_args.rs` under `apps/desktop/src-tauri/src/`, and `turn.rs` adds a
turn's environment. CLI docs: [Claude Code](https://docs.anthropic.com/en/docs/claude-code/getting-started),
[Cursor CLI](https://docs.cursor.com/en/cli/installation),
[Codex CLI](https://developers.openai.com/codex/cli),
[Antigravity CLI](https://antigravity.google/cli),
[Copilot CLI](https://docs.github.com/copilot/how-tos/copilot-cli).

## Claude CLI

- Sign-in is `claude auth login|logout|status` from 2.1.41; there is no top-level
  `login` ([sign-in-checks.md](sign-in-checks.md#claude-version-floor))
- `--claudeai` signs in with the subscription and is the default. `--console`
  switches to Console billing, `--sso` forces SSO
- The status check returns JSON (`--text` gives the readable form). Goodboy reads
  `loggedIn` plus `email`/`username`

Every claude start passes `--setting-sources project,local`. So
`~/.claude/CLAUDE.md` and the user `settings.json` (global MCP servers, hooks,
permission allowlists) do not load, while the repo's `CLAUDE.md` and `.claude/`
do. `--bare` is no replacement: it forces `ANTHROPIC_API_KEY` auth and breaks
subscription and keychain sign-in, and the arg builders check it is never added.

## Cursor CLI

Goodboy runs `cursor-agent` from `~/.local/bin/`, never `cursor` (the IDE).
`NO_OPEN_BROWSER` comes from `loginEnv` in the capability table.

## Codex CLI

```
codex exec --json --skip-git-repo-check --model <ID> --cd <DIR> -s <SANDBOX> -
```

- The trailing `-` reads the prompt from stdin ([Prompt on stdin](#prompt-on-stdin))
- Full access keeps `workspace-write`; Goodboy never passes
  `--dangerously-bypass-approvals-and-sandbox`
- With `workspace-write` Goodboy adds `-c sandbox_workspace_write.network_access=true`,
  except for an Auto child whose launch guard asks before dependencies
  (`launchGuard.isNetworkOff`, [the launch guard](../auto.md#launch-guard))
- `--skip-git-repo-check` is required, or codex refuses folders it does not trust
- codex v0.130 writes `codex login status` to stderr without a TTY, and Tauri
  processes never have one. The check reads both streams through
  `ProbeOutput::primary_text()` in `apps/desktop/src-tauri/src/proc/probe.rs`

The Rust tests run a scripted fake codex
([Fake CLI binaries](../testing.md#fake-cli-binaries-for-the-rust-spawn-tests)).

## Antigravity CLI

```
agy -p <PROMPT> --model <MODEL> --mode <plan|accept-edits> --sandbox
```

- `agy` (v1.1.9) has no sign-in commands; `agy login` does not exist. The app
  writes the session to `~/.gemini/antigravity-cli/`, which Goodboy trusts: any
  session file means connected, and an email in one names the account
- An API key goes through the credential layer as `GEMINI_API_KEY`
- Full access replaces `--mode` and `--sandbox` with `--dangerously-skip-permissions`
- No stable JSON output: each stdout line is one `assistant_text` delta
- No token usage in headless mode: the cost is estimated from the price per token

## Copilot CLI

Read from `copilot` 1.0.105 help and the recorded streams the fake CLI replays.

```
copilot -p <PROMPT> --model <MODEL> -C <DIR> --output-format=json --disable-client-telemetry
  --no-auto-update --disable-builtin-mcps --no-ask-user --allow-all-tools <MODE FLAGS>
  [--add-dir <ROOT>]... [--reasoning-effort <LEVEL>] [--resume=<SESSION>]
```

- `--allow-all-tools` is required headless, so every mode narrows it with
  `--deny-tool=` rules (the CLI documents that deny wins). Files stay inside `-C`
  and `--add-dir`: no turn passes `--allow-all-paths` or `--allow-all`
- `--disable-client-telemetry` and `--no-auto-update` are always set: telemetry is
  forbidden, and a turn must not replace the CLI under a run
- `--disable-builtin-mcps` turns off the default GitHub MCP server; user MCP
  servers stay on
- The prompt travels in argv: no run has confirmed `-p` reads stdin
- A side job runs the read-only flags, plus `--deny-tool=read` and
  `--deny-tool=url` when it has no tools
- The update is `npm install -g @github/copilot@latest`, because the CLI's npm
  install only reports a newer version
- No chat shape: the read-only chat refuses Copilot, like Cursor and Gemini

### Stream

`copilot/parser.ts` maps the JSON lines: `assistant.message_delta` to partial
text, `tool.execution_start` and `tool.execution_complete` to a tool call (with
`fileEdits` as file edits), `session.usage_checkpoint` to the token counts and
the last request's size, and `result` to the session id and the premium
requests. It drops the `assistant.message` that repeats the deltas. A denied
tool has `success: false`, and its `error.message` becomes its output. An unmapped event is dropped when `ephemeral`, else kept as
`unknown_payload`, so a new event type shows up.

Copilot resumes natively with `--resume=<session id>` from `result.sessionId`
(`shouldReplayHistoryAsText: false`, `planRestartResume`).

### Premium requests

After a resume `result.usage.premiumRequests` is the CLI session's total, kept as
`ProviderUsage.sessionPremiumRequests` and `sessionNanoAiu`. `copilotTurnUsage`
(`store/slices/turn/copilotTurnUsage/`) subtracts the previous total of the same
provider session, matched by the run's `provider_session_init`, so
`premiumRequests` and `nanoAiu` hold the turn's share. A new session after a reset
starts from zero.

- The turn footer shows premium requests in place of a cost. The dollar cost is
  always 0, `costCoverage` is `unpriced`, `getProviderModelPrice` is `null`
- `totalNanoAiu` is summed per run as `ProviderUsage.nanoAiu` and not shown,
  because its unit is undocumented

### Tokens in the environment

The CLI reads `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, then `GITHUB_TOKEN` before its
saved sign-in, and refuses classic `ghp_` tokens. `strip_tokens_copilot_refuses`
in `aux_spawn.rs` runs after the Git host tokens are set, for turns and side jobs.
It removes `GH_TOKEN` and `GITHUB_TOKEN` unless they start with `github_pat_`, and
`COPILOT_GITHUB_TOKEN` when it starts with `ghp_`. So a Copilot agent has no Git
host token unless the user's token is fine-grained.

Not yet confirmed by a real run: the error event shape (a failed turn shows the
exit code and stderr), whether the deny rules always hold, any context window but
Sonnet 5.5 (200k, the `context_token_limit` of the recorded run), and the
reasoning levels beyond low, medium and high.

## opencode runtime

opencode, OpenRouter and Moonshot share the `opencode` binary, each with its own
account.

- `opencode auth login` shows menus; `-p <provider>` and `-m <method>` skip them
- `opencode auth list` prints a boxed report ending in an `N credentials` row.
  Each row is `<name>` then the method in dim ANSI color, so the name ends at the
  first escape sequence. No rows means disconnected
- The `Environment` block is ignored on purpose: env credentials belong to
  Goodboy's credential layer
- Model ids name the provider, because opencode looks providers up on models.dev:
  `openrouter/anthropic/claude-sonnet-4.5`, `moonshotai/kimi-k3`. Both contain a
  `/`, so `opencodeModelArg` adds no `OPENCODE_ROUTING` prefix

## Prompt on stdin

Any local user can read a command line with `ps`, so a prompt that holds a pasted
key must not travel in argv. `prompt_on_stdin` in `providers/cli_args.rs` names
the CLIs that read stdin, and `turn_stdin`, `side_job_stdin` and `feed_stdin` hand
it over for turns, the planner and the summarizer.

| CLI             | Prompt                              | Status                    |
| --------------- | ----------------------------------- | ------------------------- |
| Claude          | `-p` with no value, prompt on stdin | on stdin                  |
| Codex           | trailing `-`, prompt on stdin       | on stdin                  |
| Cursor          | `-p <prompt>`                       | argv, stdin not confirmed |
| Copilot         | `-p <prompt>`                       | argv, stdin not confirmed |
| Antigravity     | `-p <prompt>`                       | argv, stdin not confirmed |
| opencode family | `-- <prompt>`                       | argv, stdin not confirmed |

- A CLI moves to stdin only after its help or a real run confirms it
- Chat and ask turns in `chat.rs` keep the prompt in argv (`turn_args_with_prompt`),
  because their hardening reads it at the end of the list. A `--system-prompt` or
  `--append-system-prompt` stays in argv too
- `monitor/mask.rs` masks what stays in argv: the text after `-p`, `--prompt`, the
  system prompt flags and a bare `--`, plus `--token`, `--password`, `--secret`,
  `--api-key`, bearer values and web address credentials (`util/redact.rs`)
- The fake claude and codex record stdin in `fake-cli-stdin.txt`, and the fake
  CLI tests check that argv holds no prompt

## API keys

- `PROVIDER_API_KEY_ENV` (`packages/core/src/providers/provider-api-key-env.ts`)
  maps each provider to `ANTHROPIC_API_KEY`, `CURSOR_API_KEY`, `OPENAI_API_KEY`,
  `GEMINI_API_KEY`, `OPENROUTER_API_KEY` or `MOONSHOT_API_KEY`
- `probe_for` in `apps/desktop/src-tauri/src/provider_credentials.rs` tests a key
  before it is saved: Moonshot against `https://api.moonshot.ai/v1/models`,
  OpenRouter against `https://openrouter.ai/api/v1/auth/key`
- Secrets live in the OS keyring under `provider_credential.<id>` (`secrets.rs`)
- When a turn starts, `turn.rs` sets the workspace's chosen key as that env var
