# Providers

> **Read this when** you set up, connect, switch or fix a provider, or change how
> Goodboy installs a provider CLI, checks its sign-in or starts it.
> **Not for** how the model picker groups and shows models ([model-picker.md](model-picker.md)).

Goodboy runs your tasks on the coding agents you already pay for. This page shows
what each provider needs and how to connect it, then how it works under the hood.

## Pick a provider

| Provider   | What you need         | How it connects        |
| ---------- | --------------------- | ---------------------- |
| Claude     | Claude Pro or Max     | Browser sign-in        |
| Cursor     | Cursor Pro            | Browser sign-in        |
| Codex      | A ChatGPT plan        | Browser sign-in or key |
| Gemini     | Google AI Pro         | Antigravity app or key |
| OpenCode   | Nothing, free models  | OpenCode login         |
| OpenRouter | An OpenRouter API key | Paste the key          |
| Moonshot   | A Moonshot API key    | Paste the key          |

Every provider lives in the same place:

1. Open **Settings** (`⌘,` on macOS)
2. Choose **Providers & models**
3. Pick the provider in the list

The card shows whether the provider is installed, which account is signed in, and
its **API keys**. Goodboy runs the provider's own sign-in, so your credentials never
pass through Goodboy.

## Claude

**What you need:** a Claude Pro or Max plan on claude.ai. An Anthropic API key also
works. Add it under **API keys**.

**Connect**

1. Click **Connect**
2. If `claude` is missing, Goodboy installs it first (5 to 30 seconds)
3. Your browser opens on claude.ai. Sign in and approve the request
4. Come back to Goodboy. The card shows your account as **connected**

If the install asks for your password, click the terminal on the card and type it.
A global npm install can need `sudo` when nvm does not manage your Node.

**Disconnect:** click **Disconnect**, then **Confirm**. This removes the token from
your machine only. Your Anthropic account stays as it is.

## Cursor

**What you need:** a Cursor Pro plan on cursor.com, or a Cursor API key.

**Connect**

1. Click **Connect**
2. If `cursor-agent` is missing, Goodboy installs it into `~/.local/bin`
3. A tab opens on cursor.com. Sign in and approve the request
4. Back in Goodboy, the card shows your account

You stay signed in until you sign out. If Goodboy does not find `cursor-agent` after
the install, restart Goodboy so it sees the new `PATH`.

**Disconnect:** **Disconnect**, then **Confirm**. This removes the token from your
machine, and you can sign back in any time.

## Codex

**What you need:** a ChatGPT Plus, Pro, Business or Edu plan, or an OpenAI API key.

**Connect**

1. Click **Connect**
2. If `codex` is missing, Goodboy installs it first
3. If Codex asks how you want to sign in, a terminal appears on the card. Click it
   and pick ChatGPT or API key with the arrow keys
4. If you pick ChatGPT, your browser opens. Sign in and approve

Codex saves your sign-in in `~/.codex/auth.json`. You can also set `OPENAI_API_KEY`
in your shell, or add a key under **API keys**. Either way, Codex shows as connected.

**Disconnect:** **Disconnect**, then **Confirm**. This deletes `~/.codex/auth.json`.
Your OpenAI plan stays as it is.

## Gemini

**What you need:** a Google AI Pro plan, or a Gemini API key (the free tier works).
Gemini runs through Antigravity (`agy`), the app that replaces the Gemini CLI.

**Connect**

1. Install `agy` from a terminal:
   `curl -fsSL https://antigravity.google/cli/install.sh | bash`
2. Sign in to the Antigravity app with your Google account
3. In Goodboy, click the refresh icon (**Re-detect CLIs**) on the Gemini card

You sign in to Antigravity inside its own app, so the card has no **Connect** button.
Rather use a key? Add a Gemini API key under **API keys** instead.

**Disconnect:** **Disconnect**, then **Confirm**. Goodboy deletes
`~/.gemini/antigravity-cli/`. Your Google account stays as it is.

## OpenCode

**What you need:** nothing to start. OpenCode comes with some models that need no
key. Sign in to your OpenCode account to get more.

**Connect**

1. Click **Connect**
2. If `opencode` is missing, Goodboy installs it first
3. A terminal with a menu appears on the card. Pick the provider and sign in
4. When the login ends, Goodboy checks your sign-in again

**Disconnect:** **Disconnect**, then **Confirm**, then pick the account to remove.

## OpenRouter and Moonshot

**What you need:** an API key from [OpenRouter](https://openrouter.ai/docs) or
Moonshot. Both run on top of OpenCode, so install OpenCode first.

**Connect**

1. Install OpenCode (see [OpenCode](#opencode)), then click **Detect** on the card
2. Under **API keys**, click **Add key**
3. Give the key a name (for example "work") and paste it
4. Click **Save key**. Goodboy tests the key with the provider before it saves it

**Disconnect:** remove the key from **API keys**. Goodboy keeps a key while a
workspace still uses it.

## API keys per workspace

Claude, Cursor, Codex, Gemini, OpenRouter and Moonshot take API keys as well as the
CLI sign-in.

- Add as many keys as you want, each with its own name
- Under **Workspace credentials**, pick the key each workspace uses
- A workspace with no key shows **billed to CLI login**. A workspace with a key shows **billed to API key**

Goodboy stores keys in your system keychain, not in its own database.

## Defaults and task models

Go to **Settings** → **Providers & models** → **Defaults** to choose how a workspace
uses its providers.

- **Default provider**: the provider new sessions start on. Only connected providers
  appear here
- **Routing pool**: the providers Goodboy can move work between by itself
- **Task models**: the provider and model for each small side job. Side jobs include
  summaries, planning, prose polish, agent titles, issue briefs, the workflow
  orchestrator, delegated answers, pull request drafts and rebases. Each one starts on **Auto**
- **Agent roles**: the provider, model and effort for each role. Each one starts on
  **Auto**. If you pin a model on an agent or a workflow step, that pin beats the role
- **Auto** picks the same way for roles and tasks: the model chosen for that job on
  the default provider, then the next model in that list when your CLI is too old
  for the first one, then the next provider in the routing pool when the default
  is not connected. On Claude, the Planner runs on Opus 5.5 (Opus 5 on an older CLI),
  the Debugger and the Reviewer on Sonnet 5 High, Docs on Sonnet 5 Low, Scout and
  the small writing jobs on Haiku 4.5, and plan drafting, Custom, Report and the
  other roles on Sonnet 5 Medium
- **Fallback** on a role: the second choice Goodboy switches to when the first one
  fails during a turn. **Automatic** lets Goodboy choose

## Usage and spend

Each provider page in **Settings > Providers & models** opens on **Usage**:

- **Usage limits**: one row per window the provider reported (5 hours, the
  week, a model's week), with the share used and the reset. A notice says when
  the provider is about to run out or is out. Cursor and Gemini report nothing
  Goodboy can read, and an API key provider is billed per token, so neither
  shows windows
- **Spend in Goodboy**: today, the last 7 days and this month for the current
  workspace, counted by Goodboy at API prices, and the provider's budget when
  you set one in Impact. On a plan this is what the same tokens would cost on
  the API, not what you pay
- The provider's row in the rail turns warning from 80% of a window and danger
  when the provider is out, with the reason under its name

## Switching accounts

Each provider uses one account at a time, and the card shows which one. That account
pays for every turn.

1. Click **Disconnect** and **Confirm**
2. Click **Connect** and sign in with the other account
3. Click the refresh icon and check the account on the card before you continue

## Troubleshooting

- **Provider not detected**: Goodboy looks for CLIs on your `PATH`. Find where the
  CLI is (`which claude`, `npm root -g`), add that folder to your shell profile, open
  a new shell and restart Goodboy
- **Browser sign-in stuck**: click **Show details**, then **Open the link again**.
  After two minutes, **Run in my terminal** runs the same command in your own
  terminal. Goodboy notices when it finishes
- **How close am I to a limit?** The Limits chips in the top bar show a bar per
  provider. Hover one for every window and its reset, click it for the provider
  page. Claude updates its numbers only while a Claude agent runs
- **Rate limit reached**: every turn counts against your plan's limit. Wait for the
  reset (about 5 hours on Claude Max), or let the routing pool send the next turn to
  another provider. Session summaries count against the same limit
- **Wrong account**: follow [Switching accounts](#switching-accounts), then check
  the account on the card before you continue
- **A model needs a newer CLI**: some models only run on a recent CLI. When yours is
  too old, the composer and the model picker say so before you send, and the
  provider shows **Update needed** in Settings. **Update Claude CLI** runs the
  update in a terminal inside the card. A turn the CLI turned down keeps your
  message: retry it once the update is done, or run it on the newest model your
  CLI supports. Goodboy never guesses: a CLI whose version it can't read is never
  flagged. Update waits while a turn on the same provider is running

## Under the hood

This part is for contributors and agents who change how providers work.

### How Connect works

**Connect** installs the CLI if it is missing, then runs its login. Both run in a
hidden terminal (a PTY).

- Goodboy opens the browser itself. It uses the first sign-in URL it finds in the CLI output
- Goodboy starts Cursor with `NO_OPEN_BROWSER=1`, so Cursor does not open a second tab
- Goodboy checks that you are signed in by asking the CLI directly. It does not trust
  the exit code, because some CLIs keep running while they wait for the browser
- The store keeps each connect attempt, one per provider. Closing the card does not stop it

The timers live in `apps/desktop/src/store/slices/providers/connectProvider.ts`:

- `STALL_MS` (15s): if the login goes quiet for this long, it is probably waiting for
  input. The hidden terminal appears
- `HANDOFF_LONG_MS` (30s): the card says it is still waiting for the browser
- `HANDOFF_FALLBACK_MS` (120s): the card offers **Run in my terminal**
- `POST_EXIT_PROBE_MS` (60s): after the CLI exits, Goodboy keeps checking the sign-in
  for this long

### Connect tiers

Each provider's connect options live in one table, not in UI code. The table is
`PROVIDER_CONNECT_CAPABILITIES` in `packages/core/src/providers/provider-connect.ts`.

| Provider                       | Tier        | Why                              |
| ------------------------------ | ----------- | -------------------------------- |
| anthropic, codex, cursor       | `one-click` | No prompts, sign-in gets checked |
| opencode, openrouter, moonshot | `assisted`  | Login is a menu                  |
| gemini                         | `manual`    | `agy` has no sign-in command     |

- `assisted`: `opencode auth login` shows a menu. When it goes quiet, the terminal
  appears so you can pick. Goodboy still checks the sign-in at the end
- `manual`: the card shows `manualReason` and a docs link. It has no **Connect** and
  no **Re-authenticate** button
- `isApiProvider` reads `PROVIDER_KIND` in `packages/types/src/provider-catalog.ts`.
  It marks openrouter and moonshot as `api`. Their card is `ApiProviderDetail`, which
  checks the runtime and lists keys, instead of the CLI connect card

### Commands per provider

The exact commands Goodboy runs live in `PROVIDER_LIFECYCLE_COMMANDS` in
`@goodboy/core` (`packages/core/src/providers/provider-commands.ts`). If this page and that
constant disagree, the constant is right.

| Provider                       | Connect                        | Disconnect                | Sign-in check         |
| ------------------------------ | ------------------------------ | ------------------------- | --------------------- |
| anthropic                      | `claude auth login --claudeai` | `claude auth logout`      | `claude auth status`  |
| cursor                         | `cursor-agent login`           | `cursor-agent logout`     | `cursor-agent status` |
| codex                          | `codex login`                  | `codex logout`            | `codex login status`  |
| gemini                         | none                           | delete the session folder | session folder        |
| opencode, openrouter, moonshot | `opencode auth login`          | `opencode auth logout`    | `opencode auth list`  |

Install commands:

- anthropic: `npm install -g @anthropic-ai/claude-code`
- cursor: `curl https://cursor.com/install -fsS | bash`
- codex: `npm install -g @openai/codex`
- gemini: `curl -fsSL https://antigravity.google/cli/install.sh | bash`
- opencode, openrouter, moonshot: `npm install -g opencode-ai`
- gemini logout: `rm -rf ~/.gemini/antigravity-cli`

Update commands (`update` in the table). A provider without one runs its install
command again, which is how the cursor and gemini installers update:

- anthropic: `claude update`
- codex: `npm install -g @openai/codex@latest`
- opencode, openrouter, moonshot: `npm install -g opencode-ai@latest`

### CLI version gate

- `minCliVersion` on a catalog model is the oldest CLI that runs it. Opus 5.5
  needs Claude CLI 2.1.280 and Fable 5.1 needs 2.1.251
- A `cli_too_old` refusal also teaches the gate. `learnCliRequirement` stores the
  required version per provider and model in the `provider.cliRequirements`
  setting, so the next time the gate warns before the send even for a model with
  no catalog minimum
- `cliGate` in `packages/core/src/providers/cliGate.ts` compares the requirement
  with the version detection read. An unknown version is never gated
- The transcript turns a refusal into a `cli_too_old` item, encoded like
  `auth_required`. Its payload keeps the model, both versions and the raw error.
  When the turn already fell back to a sibling model, the item names it and no
  second fallback row is written
- The update runs through `provider_lifecycle_run` with action `update`, in the
  same PTY as install and login. On exit the lifecycle refreshes detection, and
  `provider-cli-updated` logs the new version. `provider-cli-outdated` is logged
  the first time a requirement is learned, with an action that opens the provider
  and starts the update

Docs from each CLI: [Claude Code](https://docs.anthropic.com/en/docs/claude-code/getting-started),
[Cursor CLI](https://docs.cursor.com/en/cli/installation),
[Codex CLI](https://developers.openai.com/codex/cli),
[Antigravity CLI](https://antigravity.google/cli).

### Claude CLI

- `claude` has no top-level `login`. Its sign-in commands are `claude auth login|logout|status`
- `--claudeai` signs in with your subscription and is the default. `--console`
  switches to Console billing. `--sso` forces SSO
- The status check returns JSON by default (`--text` gives the readable form).
  Goodboy reads `loggedIn` plus `email`/`username`

Goodboy passes `--setting-sources project,local` every time it starts claude. That
covers turns (`turn.rs`), the planner (`planner.rs`), the summarizer (`summarize.rs`)
and side jobs (`aux_spawn.rs`). All four live under `apps/desktop/src-tauri/src/`.

- Your personal config does not load inside a Goodboy session. That means
  `~/.claude/CLAUDE.md` and your user `settings.json`, with its global MCP servers,
  hooks and permission allowlists
- The repo's own `CLAUDE.md` and `.claude/` still load
- `--bare` does not work as a replacement. It forces `ANTHROPIC_API_KEY` auth and
  breaks sign-in for subscription and keychain users. The arg builders check that it
  is never added

### Cursor CLI

- The installer puts `cursor-agent` in `~/.local/bin/`
- Goodboy runs `cursor-agent`, never `cursor` (that one is the IDE)
- `NO_OPEN_BROWSER` comes from `loginEnv` in the capability table

### Codex CLI

Goodboy runs codex with no prompts:

```
codex exec --json --skip-git-repo-check --model <ID> --cd <DIR> -s workspace-write -- <PROMPT>
```

- In `bypassPermissions` mode, `-s workspace-write` becomes
  `--dangerously-bypass-approvals-and-sandbox`
- `--skip-git-repo-check` is required. Without it, codex refuses folders it does not trust
- codex CLI v0.130 writes the `codex login status` output to stderr when no terminal
  (TTY) is attached. Processes that Tauri starts never have one. So the sign-in check
  reads both streams through `AuthCommandOutput::primary_text()` in
  `apps/desktop/src-tauri/src/providers.rs`

A test against the real codex binary. It is skipped by default:

```bash
GOODBOY_TEST_REAL_CODEX=1 cargo test --lib -- --ignored codex_real
```

### Antigravity CLI

Google deprecated the Gemini CLI's sign-in with Google on 2026-06-18. `agy` replaces it.

- `agy` (v1.1.9) has no sign-in commands. Its subcommands are `agent, agents, changelog,
help, install, models, plugin, plugins, update`. `agy login` does not exist
- The Antigravity app writes the session to `~/.gemini/antigravity-cli/`. Goodboy
  trusts that folder as the source of truth
- If a session file holds an email, the card shows it as the account. Any session
  file at all means the provider is connected
- The credential layer handles API key sign-in with `GEMINI_API_KEY` instead

Each turn starts like this:

```
agy -p <PROMPT> --model <MODEL> --sandbox
```

- In bypass permission mode, `--sandbox` becomes `--dangerously-skip-permissions`
- `agy` has no stable JSON output. So the parser treats each stdout line as one
  `assistant_text` delta (a chunk of reply text)
- In headless mode `agy` reports no token usage per turn. Goodboy estimates the cost
  from the price per token instead

### opencode runtime

opencode, OpenRouter and Moonshot share the `opencode` binary. Each one has its own
account.

- `opencode auth login` shows menus. `-p <provider>` and `-m <method>` skip them
- `opencode auth list` prints a boxed report that ends in an `N credentials` row.
  Goodboy reads the names from that section. No rows means disconnected
- Each row is `<name>` followed by the method in dim ANSI color. So the name ends at
  the first escape sequence
- Goodboy ignores the `Environment` block below it on purpose. Credentials from env
  vars belong to Goodboy's credential layer

opencode looks up providers live on models.dev, so the model id names the provider too.

- OpenRouter models are saved with the full slug (`openrouter/anthropic/claude-sonnet-4.5`)
- Moonshot models point at Moonshot directly (`moonshotai/kimi-k3`)
- Both already contain a `/`, so `opencodeModelArg` adds no `OPENCODE_ROUTING` prefix

### API keys

- `PROVIDER_API_KEY_ENV` in `packages/types/src/provider-registry.ts` maps each
  provider to its env var: `ANTHROPIC_API_KEY`, `CURSOR_API_KEY`, `OPENAI_API_KEY`,
  `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `MOONSHOT_API_KEY`
- `probe_for` in `apps/desktop/src-tauri/src/provider_credentials.rs` tests each key
  before Goodboy saves it. It tests Moonshot keys against
  `https://api.moonshot.ai/v1/models` and OpenRouter keys against
  `https://openrouter.ai/api/v1/auth/key`
- Secrets live in the OS keyring under `provider_credential.<id>` (`secrets.rs`)
- When a turn starts, `turn.rs` sets the workspace's chosen key as that env var

### Models and effort

This page does not list models. The models, their context window, their cost tier and
their effort levels (the ladder) are built into the code. They live in
`packages/core/src/providers/capabilities.ts` and each provider's `catalog.ts`.
Folders are named after the CLI, not the provider id. So the anthropic catalog is
`providers/claude/catalog.ts`.

What the catalogs do not tell you:

- Cursor's accepted slugs (model ids) are in `cursor/agent-model-ids.ts`.
  `cursor/agent-model-ids.test.ts` checks our chosen subset against them
- Cursor puts the effort inside the slug, so it never gets an effort flag. Which
  levels it can reach depends on the Thinking and Fast toggles
- Each catalog key names exactly one model Goodboy can start. `catalog.test.ts` sends
  every cli id Goodboy can pass back through `resolveModelForProvider`. It checks that
  each one lands on the key that owns it
- This matters because code that holds only a key picks `variants[0]`. If several
  paid models shared one key, Goodboy would start and bill the wrong one
- That is why Codex Sol, Terra and Luna are three ids: `gpt-5.6-sol`, `gpt-5.6-terra`
  and `gpt-5.6-luna`. Each has its own cost tier and price in `codex/cost.ts` (5/30,
  2.5/15 and 1/6 per Mtok). The picker shows them as version chips
- Cursor is the only provider whose `getCheapModel` is set by hand. It is set to
  `auto` in `cli-defaults.ts`
- Old ids still work through `parseLegacyId.ts`. So an id missing from the catalog is
  not always dead
- If a model does not support an effort level, Goodboy uses the highest level it does
  support (`clampEffort`). It does not fail
- Only one level has a label that differs from the value Goodboy sends. `xhigh`
  reads **Very high** in the picker
- claude takes `--effort <level>` and codex takes `-c model_reasoning_effort="<level>"`.
  Both are built in `apps/desktop/src-tauri/src/turn.rs`
- There is no `ultracode` level. `claude --help` lists exactly
  `low, medium, high, xhigh, max`. Run that check before you add a level to the union
- Prices are looked up only within the provider that runs the model.
  `getProviderModelPrice({ provider, model })` reads that provider's `cost.ts`
  and returns `null` when it has no rate. The same key on two providers
  (`sonnet-4.6` on cursor and anthropic) never borrows the other's price.
  opencode, OpenRouter and Moonshot return `null` on purpose.
  `model-price.test.ts` checks that every anthropic, cursor, codex and gemini
  catalog model has a price

When a provider ships or retires a model, update three files under
`packages/core/src/providers/<cli>/` together:

1. `catalog.ts`: the entry, keeping the array order (the default model is the
   first entry).
2. `agent-model-ids.ts`: the ids the CLI accepts, copied from its model
   listing (for cursor, `cursor-agent models`). Keep it hand-written. It is the
   independent check the catalog tests compare against.
3. `cost.ts`: the per-Mtok rate for every new id.

### Defaults internals

- **Auto** is one ladder for roles and tasks, `resolveAuto` in
  `packages/core/src/providers/autoRouting/resolveAuto.ts`. The curated picks live in
  `AUTO_DEFAULTS` (`autoRouting/defaults.ts`), one column per curated provider
  (Claude, Codex, Gemini, Cursor) and one ordered list per role or task. The ladder
  tries the default provider first, then the fallback order; within a column it
  skips a model the installed CLI is too old for (`cliGate`) or a Cursor combo that
  needs Max Mode when Max Mode is off. A provider with no column (OpenCode,
  OpenRouter, Moonshot) falls back to `strongestModelForTier`, after every curated
  provider. `AUTO_PROVIDER_GATES` is the list of provider checks: connected, and not
  at its usage limit (`atLimit`, from `providersAtLimit`: a provider whose last
  observation says a window is out and has not reset). A pick that passed a
  provider for its limit carries `skippedAtLimit`. The desktop fills `atLimit`
  through `autoLimitContext` only while some provider is out, for agent spawns
  and every task. The desktop resolves a task model only through
  `resolveLimitedTaskModel` (a test fails on a direct `resolveTaskModel` call),
  and a lookup for a provider the user picked passes `limitContext: null`. The
  Auto row of the Defaults
  task pickers and the orchestrator picker then says which provider it left and
  why, and a provider's Usage notice says where Auto sends new agents. No
  Cursor default needs Max Mode, and `defaults.test.ts` validates every cell against
  the catalogs and snapshots the table
- `ROLE_REGISTRY` holds no routing any more: the Claude column of `AUTO_DEFAULTS` is
  the reference. `kindRouting` maps an agent kind to its role and reads the same
  ladder; there is no separate cheap tier for Scout, Docs or Custom
- **Task models** are saved in `workspaces.task_models` and read through
  `resolveTaskModel` in `@goodboy/core`. A pin may carry an effort and a `fallback`.
  A pin without an effort runs at `medium`, clamped to the model's ladder. Models
  without an effort axis get none. PR drafts and rebases preselect the agent's
  model and carry no automatic effort. Task models never affect chat turns. Given
  `connectedProviders`, a pin on a disconnected provider moves to its fallback, then
  to Auto
- **Agent roles** are the union `AgentRole` in `@goodboy/types`. They are saved in
  `workspaces.role_models` and read through `resolveRoleRouting`, which takes an
  optional `auto` context (default provider, fallback order, connected providers,
  CLI versions). Without one it answers for Claude. A pin on a provider the context
  says is not connected moves to its fallback, then to Auto, and the result carries
  `pinnedUnavailable` so the UI can say so
- Role checks are forgiving. If an override names an unknown provider or an
  unregistered model, the whole override goes back to the built-in default
- If an effort is not on the ladder, it becomes the role's default effort when that
  one is on the ladder. Otherwise it becomes the top of the ladder
- **Fallback** set to **Automatic** means the key is missing from the saved
  preference. It is never a special string, because `auto` is a real Cursor model id
- After a failure Goodboy recognizes, the first retry uses the fallback you set. The
  second retry uses the `planTurnFallback` heuristic as a safety net. `MAX_ATTEMPTS`
  stays 2, and the way failures are recognized does not change
- The fallback uses the role's effort and gets checked on its own. Goodboy skips it
  and uses the heuristic if it names an unknown provider or model, a disconnected
  provider, or the same pair that failed on this turn. There is one fallback entry,
  then the heuristic

### Usage limits

Goodboy reads the usage limits a provider reports on its own. It never makes a
network call for them and never reads a sign-in token or the keychain.

- **Claude**: during a turn, `claude -p` emits a `rate_limit_event` line in the
  stream. `parseStreamJsonLine` hands it to `ctx.onProviderLimits` and keeps it out
  of the transcript. Each event names one window (`five_hour`, `seven_day`,
  `seven_day_opus`, `seven_day_sonnet`) and a status (`allowed`,
  `allowed_warning`, `rejected`). Only `allowed_warning` carries `utilization`, so a
  plain `allowed` window has no percentage. Claude reports only the window that
  limits you right now, so `mergeProviderLimits` keeps the other windows it saw
  until their reset. The numbers change only while a Claude agent runs
- **Codex**: the `token_count` lines of the rollout files under
  `$CODEX_HOME/sessions` carry `payload.rate_limits` (`primary` is the 5-hour window,
  `secondary` the week, plus `plan_type`). `codex_rate_limits_latest` in
  `codex_rollout.rs` reads the newest reading among the five newest rollouts, so it
  also sees Codex use outside Goodboy. The desktop asks for it at boot and after
  every Codex usage event
- **Antigravity and Cursor** report nothing Goodboy can read
- The last observation per provider lives in `provider_limits` (m176) and in the
  `providerLimits` store slice. A write never replaces a newer observation.
  Thresholds are in `packages/core/src/providers/limits/constants.ts`: warning from
  80%, old data after 30 minutes

### Source map

- `packages/core/src/providers/provider-connect.ts`: connect tiers and `loginEnv`
- `packages/core/src/providers/provider-commands.ts`: install, update, login and logout commands
- `packages/core/src/providers/cliGate.ts`: which models the installed CLI can't run
- `packages/core/src/providers/provider-catalog.ts`: `PROVIDER_KIND`, `OPENCODE_ROUTING`
- `packages/types/src/provider-registry.ts`: provider ids
- `packages/core/src/providers/provider-api-key-env.ts`: `PROVIDER_API_KEY_ENV`
- `apps/desktop/src/store/slices/providers/connectProvider.ts`: the steps and timers behind **Connect**
- `apps/desktop/src/features/providers/components/ProviderStudio/`: the provider cards and **Defaults**
- `apps/desktop/src/features/providers/components/ProviderConnect/guides.ts`: the guide text shown in the app
- `apps/desktop/src-tauri/src/providers.rs`: finding CLIs and checking sign-in
- `apps/desktop/src-tauri/src/provider_credentials.rs`: API key checks
- `apps/desktop/src-tauri/src/turn.rs`: the args and env for starting a turn
