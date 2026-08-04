# Provider Integration Guide

Goodboy orchestrates AI sessions through your locally installed CLI tools. This guide covers how to install, connect, and manage each supported provider.

---

## How Connect works

One button. Clicking **Connect** chains install-if-missing then login in a PTY you never see. Exactly one thing opens your browser: Goodboy does, from the first auth URL it reads out of the CLI output. Cursor is spawned with `NO_OPEN_BROWSER=1` so it does not race us with its own tab. Success comes from the auth probe, never from the process exit code, because OAuth CLIs stay alive waiting for their callback.

The attempt lives in the store keyed by provider and survives the dialog closing, so you can leave the app to finish in the browser. If the CLI goes silent for 15s after login started, it is sitting on an interactive prompt: Goodboy surfaces the hidden terminal instead of hanging. After 30s in browser handoff it says so; after 120s it offers the external-terminal escape hatch.

What a provider supports is data, not UI branching: `PROVIDER_CONNECT_CAPABILITIES` in `packages/types/src/provider-connect.ts`.

| Provider                 | Tier        | Why                                                                                                               |
| ------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| anthropic, codex, cursor | `one-click` | drivable non-interactively and probe-confirmable                                                                  |
| opencode, openrouter     | `assisted`  | `opencode auth login` is menu-driven, so the terminal appears when it stalls; the probe still confirms the ending |
| gemini                   | `manual`    | `agy` ships no auth subcommand, so there is nothing to drive                                                      |

---

## Anthropic (Claude)

### Install

```bash
npm install -g @anthropic-ai/claude-code
```

Docs: <https://docs.anthropic.com/en/docs/claude-code/getting-started>

Verify: `claude --version`

### Connect

```bash
claude auth login --claudeai
```

`claude` has no top-level `login`: the real surface is `claude auth login|logout|status`. `--claudeai` is the subscription flow (the default); `--console` switches to Anthropic Console billing and `--sso` forces the SSO flow. Goodboy runs the subscription flow in a hidden PTY and opens the printed URL itself.

### Disconnect

```bash
claude auth logout
```

### Auth probe

`claude auth status` (JSON by default, `--text` for the human form). Goodboy parses `loggedIn` plus `email`/`username` for the identity.

### Subscription tier

Requires **Claude Max** (or Claude Pro). Goodboy uses your subscription cap, not an API token. API-key-only accounts are not supported for orchestration turns.

### Default models

Per the compiled registry in `packages/core/src/providers/capabilities.ts`:

- **Turn**: `claude-opus-5` (default), `claude-opus-4-8`, `claude-fable-5`, `claude-opus-4-7`, `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-sonnet-4-5`.
- **Cheap**: `claude-haiku-4-5`.

Fable 5, Opus 5, Opus 4.8, Opus 4.7, and Sonnet 4.6 carry a 1M-token context window. Sonnet 4.5, Haiku 4.5, Opus 4.6, and older Opus models carry a 200k-token context window. Auxiliary operations (summaries, branch names, planning, agent titles) default to the cheap tier of the workspace default provider. See Defaults and task models below to pin a different model.

### Setting sources

Every claude spawn passes `--setting-sources project,local`: turns (`apps/desktop/src-tauri/src/turn.rs`), the planner (`planner.rs`), and the summarizer (`summarize.rs`). Your user-level claude config does not load inside a Goodboy session. That means `~/.claude/CLAUDE.md` and the user `settings.json`, which is where globally configured MCP servers, hooks and permission allowlists live. The repo's own `CLAUDE.md` and `.claude/` still load, so project skills, agents and settings behave as they do in a terminal.

`--bare` is not an alternative here. It forces `ANTHROPIC_API_KEY` auth, which breaks subscription and keychain users, so the arg builders assert it is never emitted.

---

## Cursor

### Install

```bash
curl https://cursor.com/install -fsS | bash
```

Installs `cursor-agent` to `~/.local/bin/`. Goodboy invokes the CLI as `cursor-agent` (not `cursor`, which is the IDE binary).

Docs: <https://docs.cursor.com/en/cli/installation>

Verify: `cursor-agent --version`

### Connect

```bash
cursor-agent login
```

`cursor-agent login` opens the browser itself and honors `NO_OPEN_BROWSER` to suppress that. Goodboy sets it, reads the URL off the PTY, and opens the tab, so there is exactly one browser handoff. The probe is `cursor-agent status`.

### Disconnect

```bash
cursor-agent logout
```

### Subscription tier

Requires **Cursor Pro**. Goodboy routes turns through Cursor's subscription-based model cap.

### Default models

Cursor surfaces 193 slugs via `cursor-agent --list-models`. Goodboy exposes a curated subset:

- **Turn**: `composer-2.5`, `claude-fable-5-thinking-high`, `claude-opus-5-thinking-high`, `claude-opus-4-7-thinking-high`, `claude-4.6-sonnet-medium-thinking`, `claude-4.6-sonnet-medium`, `gpt-5.6-sol-high`, `gpt-5.5-high`, `gpt-5.5-medium`, `gpt-5.3-codex`.
- **Cheap**: `auto` (default), `composer-2.5-fast`.
- Every slug above is pinned against `cursor-agent --list-models` by `packages/core/src/providers/cursor/agent-model-ids.test.ts`. Cursor carries the effort level inside the slug, so it never receives an effort flag.

Cursor is the one provider whose cheap pick is special-cased: `getCheapModel` returns `auto` rather than the first cheap-tier entry (`packages/core/src/providers/cli-defaults.ts`).

---

## OpenAI (Codex)

### Install

```bash
npm install -g @openai/codex
```

Docs: <https://developers.openai.com/codex/cli>

Verify: `codex --version`

### Connect

```bash
codex login
```

Goodboy opens an external terminal for the OAuth flow.

### Disconnect

```bash
codex logout
```

### Subscription tier

Requires **ChatGPT Plus/Pro/Business/Edu/Enterprise** (preferred) or an `OPENAI_API_KEY` env var. Goodboy uses whichever auth the local `codex` CLI is configured with.

### Default models

Per <https://developers.openai.com/codex/models> (May 2026):

- **Turn**: `gpt-5.6` (default), `gpt-5.5`, `gpt-5.4`, `gpt-5.2`, `gpt-5.3-codex`, `gpt-5.3-codex-spark`.
- **Cheap**: `gpt-5.4-mini`.

### Turn spawn args

Goodboy spawns codex non-interactively:

```
codex exec --json --skip-git-repo-check --model <ID> --cd <DIR> -s workspace-write -- <PROMPT>
```

In `bypassPermissions` mode `-s workspace-write` is replaced with `--dangerously-bypass-approvals-and-sandbox`. The TUI you see when running `codex "..."` from a shell is a different mode. Goodboy uses `exec` for headless JSONL streaming.

### Non-TTY auth quirk

codex CLI v0.130 writes `codex login status` output to **stderr** when no TTY is attached. Tauri-spawned children never have a TTY, so Goodboy explicitly reads both streams in the auth check (`AuthCommandOutput::primary_text()` in `apps/desktop/src-tauri/src/providers.rs`). If you see "installed, not logged in" in the providers panel even though terminal `codex login status` returns `Logged in using ChatGPT`, your build predates this fix: rebuild from `feat/providers-overhaul`.

### Debugging

```bash
GOODBOY_DEBUG_CODEX=1 pnpm tauri dev
```

The terminal prints `[codex-debug] auth cmd: …`, the raw stdout/stderr from the auth subprocess, and for every codex turn it prints the full spawn args + exit code + stderr tail. Use this when the providers panel says one thing and the terminal says another.

### Smoke test

Confirm end-to-end auth + spawn work against the real binary:

```bash
GOODBOY_TEST_REAL_CODEX=1 cargo test --lib -- --ignored codex_real
```

Skipped by default; opt in when you want to verify a fresh install.

---

## Google (Antigravity)

Google deprecated the Gemini CLI consumer "login with Google" flow on 2026-06-18. Antigravity (`agy`) is its official successor: a single Go binary installed via curl.

### Install

```bash
curl -fsSL https://antigravity.google/cli/install.sh | bash
```

Docs: <https://antigravity.google/cli>

Verify: `agy --version`

### Connect

**Antigravity authenticates outside the CLI, and Goodboy cannot drive it.** `agy` (v1.1.9) has no auth surface at all: `agy help login` answers `Error: unknown subcommand: login`, and the full subcommand list is `agent, agents, changelog, help, install, models, plugin, plugins, update`. There is no `auth`, no `logout`, no `status`. Earlier revisions of this file, and `PROVIDER_LIFECYCLE_COMMANDS`, declared `agy login`: that command has never existed and would fail on click, so gemini ships no Connect button.

Sign in from the Antigravity app itself, which writes the session to `~/.gemini/antigravity-cli/`, or set a Gemini API key via `GEMINI_API_KEY`, which `agy` honors with no browser round-trip.

### Disconnect

```bash
rm -rf ~/.gemini/antigravity-cli
```

Goodboy wires the disconnect button to remove the session directory directly.

### Subscription tier

Requires **Google AI Pro** (or the free tier with rate caps). Goodboy uses the local CLI's authenticated Google account, or a `GEMINI_API_KEY` credential when set.

### Default models

Per Google's Gemini 3.x lineup:

- **Turn**: `gemini-3.1-pro`.
- **Cheap**: `gemini-3.5-flash` (default).

Both support a 1M-token context window.

### Turn spawn args

Goodboy spawns `agy` non-interactively:

```
agy -p <PROMPT> --model <MODEL> --sandbox
```

`--sandbox` is replaced by `--dangerously-skip-permissions` under bypass permission mode. The working directory is set on the spawned process. `agy` has no stable structured JSON output, so the parser treats each stdout line as an `assistant_text` delta; per-turn token usage is unavailable in headless mode, so cost is estimated from per-token pricing.

### Auth detection

`agy` has no stable `auth status` subcommand. Goodboy reads `~/.gemini/antigravity-cli/` directly as ground truth: an email claim in a session file populates the identity, and any session file marks the provider connected. API-key auth leaves no session directory and is surfaced as connected by the credential layer. If the providers panel shows "not logged in" after a successful login, click **refresh** so the file check runs again.

---

## opencode and OpenRouter (beta)

Both ride the same `opencode` binary; OpenRouter is the API-key provider routed through it.

### Install

```bash
npm install -g opencode-ai
```

### Connect

```bash
opencode auth login
```

The flow is menu-driven (`-p <provider>` and `-m <method>` skip the pickers). Goodboy runs it hidden and reveals the terminal when it stalls, which for a menu is immediate.

### Disconnect

```bash
opencode auth logout
```

### Auth probe

```bash
opencode auth list
```

Prints a boxed report of stored credentials, terminated by a `N credentials` row. Goodboy parses the credential names out of that section (each row is `<name>` followed by an ANSI-dimmed method, so the name is everything before the first escape sequence). No rows means disconnected. OpenRouter is connected when one of those rows names it. The `Environment` block below it lists providers reachable through env vars and is deliberately ignored: env-var credentials belong to Goodboy's own credential layer.

---

## Effort

Effort is the third axis of every model picker, next to provider and model. How the picker renders it is owned by [model-picker.md](model-picker.md); this section owns which levels each provider actually accepts. Ladders are declared per model in the provider catalogs under `packages/core/src/providers/<provider>/catalog.ts`:

- **Claude Opus and Fable**: `low`, `medium`, `high`, `extra-high`, `max`.
- **Claude Sonnet**: `low`, `medium`, `high`.
- **Codex turn models**: `minimal`, `low`, `medium`, `high`.
- **`gpt-5.4-mini`**: `minimal`, `low`, `medium`.

Cursor is the exception to the ladder shape: effort is baked into the model slug, so each catalog entry lists the combos it has and the reachable levels depend on the Thinking and Fast toggles. `claude-haiku-4-5` and every Gemini model have no ladder at all and emit no effort arg. Picking a level a model does not support clamps to the top of what it supports (`clampEffort` in `packages/core/src/providers/clampEffort.ts`).

The UI label and the emitted value diverge in exactly one place: `extra-high` reads **Very high** in the picker and goes out as `xhigh` on the wire. Every other level is emitted verbatim. claude takes `--effort <level>`, codex takes `-c model_reasoning_effort="<level>"`, both built in `apps/desktop/src-tauri/src/turn.rs`.

There is no `ultracode` level. `claude --help` lists exactly `low, medium, high, xhigh, max` for `--effort` and the registry matches it. Run that check before extending the union.

---

## Defaults and task models

Provider Studio has a **Defaults** entry (Configuration section of the rail) that owns workspace-level provider configuration:

- **Default provider**: the provider new sessions start on. Only connected providers are selectable.
- **Task models**: which provider and model run each auxiliary operation (summaries, branch names, planning, agent titles, PR and MR drafts). Each row defaults to **Auto** (the cheapest model of the default provider, shown with a recommended tag); picking a concrete provider + model pins that operation to it. Preferences persist per workspace (`workspaces.task_models`) and resolve through `resolveTaskModel` in `@goodboy/core`. A task-model pin carries no effort.
- **Agent roles**: which provider, model and effort every agent spawned in a given role starts on (scout, investigator, planner, architect, product, implementer, reviewer, tester, explorer, custom). A pin on the agent itself or on a workflow step still wins over the role. Overrides persist per workspace (`workspaces.role_models`) and resolve through `resolveRoleRouting` in `@goodboy/core`. Validation is lenient: an unknown provider or a model absent from the registry drops the whole override and the compiled role default applies, while an effort outside the chosen model's ladder is normalized (to the role's default effort when that is on the ladder, otherwise to the top of it) rather than rejected.

Task models never touch chat turns: per-agent model overrides and the session default keep governing conversation turns.

## Multi-account

A common setup: Claude Pro on `personal@example.com` and Claude Team on `work@example.com`. Each session in Goodboy targets one active identity per provider.

**Provider Studio** (footer → Providers) shows the currently authenticated identity (email or username) for each connected CLI. Verify this before starting a session: the displayed identity is the account that will be billed for every turn.

### How to switch accounts

1. Open **Provider Studio** from the footer.
2. Click **disconnect** next to the provider you want to switch.
3. Complete the logout in the terminal that opens.
4. Click **connect** for the same provider.
5. Log in with the desired account in the terminal / browser.
6. Click **refresh** in the providers panel. The identity display updates to the new account.

---

## Troubleshooting

### CLI not detected (PATH issue)

Goodboy detects provider binaries via `$PATH`. If a CLI is installed but the providers panel shows it as missing:

1. Find the install path, e.g. `which claude` or `npm root -g`.
2. Add the directory to your shell profile (`~/.zshrc`, `~/.bashrc`, etc.):
   ```bash
   export PATH="/path/to/bin:$PATH"
   ```
3. Restart your shell, then relaunch Goodboy.

### OAuth callback failure

The login flow opens a system terminal and a browser. If the browser does not open or the callback hangs:

1. Run the login command manually in a terminal (e.g. `claude auth login --claudeai`).
2. Complete the flow there.
3. Return to Goodboy and click **refresh**. The identity should populate.

### Subscription rate-limit errors

Goodboy uses the subscription cap of your CLI. When the cap is hit, the CLI returns an error and the session stalls. Wait for the cap to reset, typically 5 hours for Claude Max. Note: the summarizer runs once per session compaction, so each compaction counts against your cap alongside the primary turn.

### Wrong account connected

If the identity shown in the providers panel is not the account you want:

1. Follow the **switch accounts** steps above.
2. Confirm the updated identity in the providers panel before starting or resuming a session.
