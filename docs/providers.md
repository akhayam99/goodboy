# Provider integration guide

> **Read this when** installing, connecting or managing a provider CLI.
> **Not for** how the picker groups and renders models (`docs/model-picker.md`).

Install, connect and manage each supported CLI. Workspace defaults are at the
bottom; how the picker renders models is [model-picker.md](model-picker.md).

## How Connect works

One button. **Connect** chains install-if-missing then login in a PTY you never
see. Exactly one thing opens your browser: Goodboy, from the first auth URL it
reads out of the CLI output. Cursor is spawned with `NO_OPEN_BROWSER=1` so it
does not race us with its own tab. Success comes from the auth probe, never
from the exit code, because OAuth CLIs stay alive waiting for their callback.

The attempt lives in the store keyed by provider and survives the dialog
closing. Silence for 15s after login started means an interactive prompt, so
Goodboy surfaces the hidden terminal instead of hanging. After 30s in browser
handoff it says so; after 120s it offers the external-terminal escape hatch.

What a provider supports is data, not UI branching:
`PROVIDER_CONNECT_CAPABILITIES` in `packages/types/src/provider-connect.ts`.

| Provider                       | Tier        | Why                                                                                                               |
| ------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| anthropic, codex, cursor       | `one-click` | drivable non-interactively and probe-confirmable                                                                  |
| opencode, openrouter, moonshot | `assisted`  | `opencode auth login` is menu-driven, so the terminal appears when it stalls; the probe still confirms the ending |
| gemini                         | `manual`    | `agy` ships no auth subcommand, so there is nothing to drive                                                      |

## Commands per provider

| Provider                         | Install                                                        | Connect                        | Disconnect                         | Probe                  | Subscription                                       |
| -------------------------------- | -------------------------------------------------------------- | ------------------------------ | ---------------------------------- | ---------------------- | -------------------------------------------------- |
| Anthropic (Claude)               | `npm install -g @anthropic-ai/claude-code`                     | `claude auth login --claudeai` | `claude auth logout`               | `claude auth status`   | Claude Max or Pro, not an API key                  |
| Cursor                           | `curl https://cursor.com/install -fsS \| bash`                 | `cursor-agent login`           | `cursor-agent logout`              | `cursor-agent status`  | Cursor Pro                                         |
| OpenAI (Codex)                   | `npm install -g @openai/codex`                                 | `codex login`                  | `codex logout`                     | `codex login status`   | ChatGPT Plus/Pro/Business/Edu, or `OPENAI_API_KEY` |
| Google (Antigravity)             | `curl -fsSL https://antigravity.google/cli/install.sh \| bash` | none, see below                | `rm -rf ~/.gemini/antigravity-cli` | session dir, see below | Google AI Pro, or `GEMINI_API_KEY`                 |
| opencode / OpenRouter / Moonshot | `npm install -g opencode-ai`                                   | `opencode auth login`          | `opencode auth logout`             | `opencode auth list`   | none for opencode, an API key for the other two    |

The table above is the user-facing copy. What a spawn actually runs is
`PROVIDER_LIFECYCLE_COMMANDS` in `@goodboy/types`, and that constant wins.

Docs: <https://docs.anthropic.com/en/docs/claude-code/getting-started>,
<https://docs.cursor.com/en/cli/installation>,
<https://developers.openai.com/codex/cli>, <https://antigravity.google/cli>.

### Per-provider deltas

**Anthropic.** `claude` has no top-level `login`: the surface is
`claude auth login|logout|status`. `--claudeai` is the subscription flow (the
default), `--console` switches to Console billing, `--sso` forces SSO. The probe
returns JSON by default (`--text` for the human form); Goodboy parses `loggedIn`
plus `email`/`username`.

Every claude spawn passes `--setting-sources project,local`: turns
(`apps/desktop/src-tauri/src/turn.rs`), planner (`planner.rs`), summarizer
(`summarize.rs`). Your user-level config, `~/.claude/CLAUDE.md` and user
`settings.json` (globally configured MCP servers, hooks, permission
allowlists), does not load inside a Goodboy session. The repo's own `CLAUDE.md`
and `.claude/` still do. `--bare` is not an alternative: it forces
`ANTHROPIC_API_KEY` auth and breaks subscription and keychain users, so the arg
builders assert it is never emitted.

**Cursor.** Installs `cursor-agent` to `~/.local/bin/`. Goodboy invokes
`cursor-agent`, not `cursor` (the IDE binary), and sets `NO_OPEN_BROWSER` so the
CLI does not open its own tab.

**Codex.** Spawned non-interactively:

```
codex exec --json --skip-git-repo-check --model <ID> --cd <DIR> -s workspace-write -- <PROMPT>
```

In `bypassPermissions` mode `-s workspace-write` becomes
`--dangerously-bypass-approvals-and-sandbox`.

codex CLI v0.130 writes `codex login status` output to **stderr** with no TTY
attached, and Tauri-spawned children never have one, so the auth check reads
both streams (`AuthCommandOutput::primary_text()` in
`apps/desktop/src-tauri/src/providers.rs`). Debug with
`GOODBOY_DEBUG_CODEX=1 pnpm tauri dev`. Real-binary smoke test, skipped by
default:

```bash
GOODBOY_TEST_REAL_CODEX=1 cargo test --lib -- --ignored codex_real
```

**Google (Antigravity).** Google deprecated the Gemini CLI's login-with-Google
flow on 2026-06-18; `agy` is the successor.

**Antigravity authenticates outside the CLI, and Goodboy cannot drive it.** `agy`
(v1.1.9) has no auth surface: the subcommand list is `agent, agents, changelog,
help, install, models, plugin, plugins, update`. `agy login` has never existed,
so the provider ships no Connect button. Sign in from the Antigravity app, which
writes the session to `~/.gemini/antigravity-cli/`, or set `GEMINI_API_KEY`.
Goodboy reads that directory as ground truth: an email claim in a session file
populates the identity, any session file marks the provider connected, and
API-key auth is surfaced by the credential layer instead. Turn spawn:

```
agy -p <PROMPT> --model <MODEL> --sandbox
```

`--sandbox` becomes `--dangerously-skip-permissions` under bypass permission
mode. `agy` has no stable structured JSON output, so the parser treats each
stdout line as an `assistant_text` delta; per-turn token usage is unavailable in
headless mode, so cost is estimated from per-token pricing.

**opencode, OpenRouter, Moonshot.** All three ride the same `opencode` binary,
each addressing its own account. `opencode auth login` is menu-driven
(`-p <provider>` and `-m <method>` skip the pickers). `opencode auth list`
prints a boxed report terminated by a `N credentials` row; Goodboy parses the
names out of that section (each row is `<name>` followed by an ANSI-dimmed
method, so the name ends at the first escape sequence), and no rows means
disconnected. The `Environment` block below it is deliberately ignored:
env-var credentials belong to Goodboy's credential layer.

opencode resolves providers live against models.dev, so the model id carries the
provider: OpenRouter models are stored pre-slugged
(`openrouter/anthropic/claude-sonnet-4.5`) and Moonshot addresses Moonshot
directly (`moonshotai/kimi-k3`). Both already contain a `/`, so neither gets an
`OPENCODE_ROUTING` prefix. The Moonshot key lives under `MOONSHOT_API_KEY` and
is validated against `https://api.moonshot.ai/v1/models` before storage.

## Models and effort

Which models exist, their context window, cost tier and effort ladder are all
compiled, never listed here: `packages/core/src/providers/capabilities.ts` and
the per-provider `catalog.ts` under `packages/core/src/providers/`. The
directory is named after the CLI, not the provider id, so the anthropic catalog
is `providers/claude/catalog.ts`.

What the catalogs do not tell you:

- Cursor's accepted slugs are recorded in `packages/core/src/providers/cursor/agent-model-ids.ts`; the curated subset
  is pinned against that list by
  `packages/core/src/providers/cursor/agent-model-ids.test.ts`. Cursor bakes
  effort into the slug, so it never receives an effort flag and its reachable
  levels depend on the Thinking and Fast toggles, and it is the one provider
  whose `getCheapModel` returns `auto` rather than the first cheap-tier entry
  (`packages/core/src/providers/cli-defaults.ts`).
- Retired codex ids still resolve through `parseLegacyId.ts`, so an id absent
  from the catalog is not necessarily dead.
- An unsupported effort level clamps to the top of what the model supports
  (`clampEffort`), it does not fail.
- Label and wire value diverge in exactly one place: the `xhigh` level reads
  **Very high** in the picker. claude takes `--effort <level>`, codex takes
  `-c model_reasoning_effort="<level>"`, both built in
  `apps/desktop/src-tauri/src/turn.rs`.
- There is no `ultracode` level. `claude --help` lists exactly
  `low, medium, high, xhigh, max`. Run that check before extending the union.

## Defaults and task models

Provider Studio → **Defaults** owns workspace-level configuration.

- **Default provider**: what new sessions start on. Connected providers only.
- **Task models**: which provider and model run each auxiliary operation
  (summaries, branch names, planning, agent titles, PR and MR drafts). Each row
  defaults to **Auto**, the cheapest model of the default provider. Persists in
  `workspaces.task_models`, resolves through `resolveTaskModel` in
  `@goodboy/core`. A pin carries no effort, and task models never touch chat
  turns.
- **Agent roles**: provider, model and effort per role, the roles being the
  union `AgentRole` in `@goodboy/types`. A pin on the agent or on a workflow
  step wins over the role. Persists in `workspaces.role_models`, resolves through
  `resolveRoleRouting`. Validation is lenient: an unknown provider or an
  unregistered model drops the whole override back to the compiled default,
  while an effort off the ladder is normalized (to the role's default effort
  when that is on the ladder, otherwise to the top of it).
- **Role fallback**: the optional second pick a pinned role moves to when its
  first choice fails mid-turn. On **Automatic** the key is absent from the
  stored preference, never a sentinel string, because `auto` is a real Cursor
  model id. Set, it is tried first on the first retry of any classified failure,
  with the `planTurnFallback` heuristic as the backstop for the second.
  `MAX_ATTEMPTS` stays 2 and the classification is untouched. It inherits the
  role's effort, is validated independently of the pin, and drops back to the
  heuristic when it names an unknown provider or model, a disconnected
  provider, or the pair that just failed. One entry, then the heuristic.

## Multi-account

Each session targets one active identity per provider. Provider Studio (footer →
Providers) shows the authenticated identity per connected CLI, and that is the
account billed for every turn. To switch: **disconnect**, complete the logout,
**connect**, log in with the other account, then **refresh**.

## Troubleshooting

- **CLI not detected.** Detection is via `$PATH`. Find the install path
  (`which claude`, `npm root -g`), export it in your shell profile, restart the
  shell, relaunch Goodboy.
- **OAuth callback failure.** Use **Show details** → **Open the link again** on
  the connect card, or after 120s **Run in my terminal**, which hands the same
  command to your system terminal. The probe keeps polling for 60s after the CLI
  exits, so Goodboy picks the result up on its own.
- **Rate-limit errors.** Goodboy uses your subscription cap. Wait for the reset,
  typically 5 hours for Claude Max. The summarizer runs once per session
  compaction and counts against the same cap.
- **Wrong account.** Switch as above, then confirm the identity before resuming.
