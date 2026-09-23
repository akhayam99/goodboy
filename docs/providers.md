# Providers

> **Read this when** setting up, connecting, switching or troubleshooting a provider,
> or changing how a provider CLI is installed, probed or spawned.
> **Not for** how the model picker groups and renders models ([model-picker.md](model-picker.md)).

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
pass through it.

## Claude

**What you need:** a Claude Pro or Max plan on claude.ai. An Anthropic API key also
works, added under **API keys**.

**Connect**

1. Click **Connect**
2. If `claude` is missing, Goodboy installs it first (5 to 30 seconds)
3. Your browser opens on claude.ai: sign in and approve the request
4. Come back to Goodboy, the card shows your account as **connected**

If the install asks for your password, click in the terminal on the card and type
it. A global npm install can need `sudo` when Node is not managed by nvm.

**Disconnect:** click **Disconnect**, then **Confirm**. This clears the token on
your machine only, your Anthropic account is untouched.

## Cursor

**What you need:** a Cursor Pro plan on cursor.com, or a Cursor API key.

**Connect**

1. Click **Connect**
2. If `cursor-agent` is missing, Goodboy installs it into `~/.local/bin`
3. A tab opens on cursor.com: sign in and approve the request
4. Back in Goodboy, the card shows your account

The token lasts until you sign out. If `cursor-agent` does not show up after the
install, restart Goodboy so it picks up the new `PATH`.

**Disconnect:** **Disconnect**, then **Confirm**. The local token goes away, and
you can sign back in any time.

## Codex

**What you need:** a ChatGPT Plus, Pro, Business or Edu plan, or an OpenAI API key.

**Connect**

1. Click **Connect**
2. If `codex` is missing, Goodboy installs it first
3. If Codex asks how to sign in, the terminal appears on the card: click it and pick
   ChatGPT or API key with the arrow keys
4. With ChatGPT, your browser opens: sign in and approve

Codex keeps the sign-in in `~/.codex/auth.json`. You can also set `OPENAI_API_KEY`
in your shell, or add a key under **API keys**, and Codex shows as connected.

**Disconnect:** **Disconnect**, then **Confirm**. This deletes `~/.codex/auth.json`,
your OpenAI plan stays intact.

## Gemini

**What you need:** a Google AI Pro plan, or a Gemini API key (the free tier works).
Gemini runs through Antigravity (`agy`), the successor to the Gemini CLI.

**Connect**

1. Install `agy` from a terminal:
   `curl -fsSL https://antigravity.google/cli/install.sh | bash`
2. Sign in from the Antigravity app with your Google account
3. In Goodboy, click the refresh icon (**Re-detect CLIs**) on the Gemini card

Antigravity signs you in from its own app, so the card has no **Connect** button.
Prefer a key? Add a Gemini API key under **API keys** instead.

**Disconnect:** **Disconnect**, then **Confirm**. Goodboy removes
`~/.gemini/antigravity-cli/`, your Google account stays intact.

## OpenCode

**What you need:** nothing to start. OpenCode ships a set of models that need no key,
and you can sign in to your OpenCode account for more.

**Connect**

1. Click **Connect**
2. If `opencode` is missing, Goodboy installs it first
3. The terminal appears on the card with a menu: pick the provider and sign in
4. Goodboy checks again when the login finishes

**Disconnect:** **Disconnect**, then **Confirm**, and pick the account to remove.

## OpenRouter and Moonshot

**What you need:** an API key from [OpenRouter](https://openrouter.ai/docs) or
Moonshot. Both run through the OpenCode runtime, so install OpenCode first.

**Connect**

1. Install OpenCode (see [OpenCode](#opencode)), then click **Detect** on the card
2. Under **API keys**, click **Add key**
3. Give it a label (for example "work") and paste the key
4. Click **Save key**. Goodboy checks the key with the provider before saving it

**Disconnect:** remove the key from **API keys**. A key a workspace still uses is kept.

## API keys per workspace

Claude, Cursor, Codex, Gemini, OpenRouter and Moonshot accept API keys next to the
CLI sign-in.

- Add as many keys as you like, each with a label
- Under **Workspace credentials**, pick which key each workspace uses
- A workspace without a key is **billed to CLI login**, one with a key is **billed to API key**

Keys are stored in your system keychain, not in Goodboy's database.

## Defaults and task models

**Settings** → **Providers & models** → **Defaults** sets how a workspace uses its
providers.

- **Default provider**: where new sessions start. Only connected providers show up
- **Routing pool**: the providers Goodboy can switch between on its own
- **Task models**: the provider and model for each side job, such as summaries,
  branch names, planning, agent titles and pull request drafts. Each defaults to
  **Auto**, the cheapest model of the default provider
- **Agent roles**: provider, model and effort for each role. A pin on an agent or a
  workflow step wins over the role
- **Fallback** on a role: the second choice Goodboy moves to when the first fails
  mid-turn. **Automatic** lets Goodboy pick

## Switching accounts

Each provider uses one account at a time, and the card shows which one. That account
pays for every turn.

1. Click **Disconnect** and **Confirm**
2. Click **Connect** and sign in with the other account
3. Click the refresh icon and check the account on the card before you resume

## Troubleshooting

- **Provider not detected**: Goodboy finds CLIs on your `PATH`. Find where it lives
  (`which claude`, `npm root -g`), add that folder to your shell profile, open a new
  shell and relaunch Goodboy
- **Browser sign-in stuck**: click **Show details**, then **Open the link again**.
  After two minutes, **Run in my terminal** runs the same command in your own
  terminal, and Goodboy notices when it finishes
- **Rate limit reached**: turns use your plan's limit. Wait for the reset (about 5
  hours on Claude Max), or let the routing pool move the next turn to another
  provider. Session summaries count against the same limit
- **Wrong account**: follow [Switching accounts](#switching-accounts), then check
  the account on the card before you resume

## Under the hood

This part is for contributors and agents changing how providers work.

### How Connect works

**Connect** chains install-if-missing, then login, in a PTY you do not see.

- Only Goodboy opens the browser, using the first auth URL it reads from the CLI output
- Cursor is spawned with `NO_OPEN_BROWSER=1` so it does not open a second tab
- Success comes from the auth probe, never the exit code, because OAuth CLIs stay
  alive waiting for their callback
- The attempt lives in the store, keyed by provider, and survives the card closing

Timers in `apps/desktop/src/store/slices/providers/connectProvider.ts`:

- `STALL_MS` (15s): silence after login started means an interactive prompt, so the
  hidden terminal is shown
- `HANDOFF_LONG_MS` (30s): the card says it is still waiting for the browser
- `HANDOFF_FALLBACK_MS` (120s): **Run in my terminal** is offered
- `POST_EXIT_PROBE_MS` (60s): the probe keeps polling after the CLI exits

### Connect tiers

What a provider supports is data, not UI branching:
`PROVIDER_CONNECT_CAPABILITIES` in `packages/types/src/provider-connect.ts`.

| Provider                       | Tier        | Why                            |
| ------------------------------ | ----------- | ------------------------------ |
| anthropic, codex, cursor       | `one-click` | Non-interactive, probe-checked |
| opencode, openrouter, moonshot | `assisted`  | Menu-driven login              |
| gemini                         | `manual`    | `agy` has no auth subcommand   |

- `assisted`: `opencode auth login` is menu-driven, so the terminal appears when it
  stalls. The probe still confirms the ending
- `manual`: the card renders `manualReason` and a docs link, with no **Connect** and
  no **Re-authenticate**
- `isApiProvider` (`PROVIDER_KIND` in `packages/types/src/provider-catalog.ts`)
  marks openrouter and moonshot as `api`, so their card is `ApiProviderDetail`
  (runtime check plus keys) instead of the CLI connect card

### Commands per provider

What a spawn runs is `PROVIDER_LIFECYCLE_COMMANDS` in `@goodboy/types`
(`packages/types/src/provider-commands.ts`). That constant wins over this page.

| Provider                       | Connect                        | Disconnect             | Probe                 |
| ------------------------------ | ------------------------------ | ---------------------- | --------------------- |
| anthropic                      | `claude auth login --claudeai` | `claude auth logout`   | `claude auth status`  |
| cursor                         | `cursor-agent login`           | `cursor-agent logout`  | `cursor-agent status` |
| codex                          | `codex login`                  | `codex logout`         | `codex login status`  |
| gemini                         | none                           | remove session dir     | session dir           |
| opencode, openrouter, moonshot | `opencode auth login`          | `opencode auth logout` | `opencode auth list`  |

Install commands:

- anthropic: `npm install -g @anthropic-ai/claude-code`
- cursor: `curl https://cursor.com/install -fsS | bash`
- codex: `npm install -g @openai/codex`
- gemini: `curl -fsSL https://antigravity.google/cli/install.sh | bash`
- opencode, openrouter, moonshot: `npm install -g opencode-ai`
- gemini logout: `rm -rf ~/.gemini/antigravity-cli`

Upstream docs: [Claude Code](https://docs.anthropic.com/en/docs/claude-code/getting-started),
[Cursor CLI](https://docs.cursor.com/en/cli/installation),
[Codex CLI](https://developers.openai.com/codex/cli),
[Antigravity CLI](https://antigravity.google/cli).

### Claude CLI

- `claude` has no top-level `login`. The surface is `claude auth login|logout|status`
- `--claudeai` is the subscription flow (the default), `--console` switches to
  Console billing, `--sso` forces SSO
- The probe returns JSON by default (`--text` for the human form). Goodboy parses
  `loggedIn` plus `email`/`username`

Every claude spawn passes `--setting-sources project,local`: turns (`turn.rs`),
planner (`planner.rs`), summarizer (`summarize.rs`), aux (`aux_spawn.rs`), all
under `apps/desktop/src-tauri/src/`.

- Your user-level config does not load inside a Goodboy session: `~/.claude/CLAUDE.md`
  and user `settings.json` (global MCP servers, hooks, permission allowlists)
- The repo's own `CLAUDE.md` and `.claude/` still load
- `--bare` is not an alternative: it forces `ANTHROPIC_API_KEY` auth and breaks
  subscription and keychain users, so the arg builders assert it is never emitted

### Cursor CLI

- Installs `cursor-agent` to `~/.local/bin/`
- Goodboy invokes `cursor-agent`, never `cursor` (the IDE binary)
- `NO_OPEN_BROWSER` comes from `loginEnv` in the capability table

### Codex CLI

Spawned non-interactively:

```
codex exec --json --skip-git-repo-check --model <ID> --cd <DIR> -s workspace-write -- <PROMPT>
```

- In `bypassPermissions` mode `-s workspace-write` becomes
  `--dangerously-bypass-approvals-and-sandbox`
- `--skip-git-repo-check` is required, otherwise codex refuses non-trusted dirs
- codex CLI v0.130 writes `codex login status` to stderr when no TTY is attached,
  and Tauri-spawned children never have one. The auth check reads both streams
  through `AuthCommandOutput::primary_text()` in `apps/desktop/src-tauri/src/providers.rs`

Real-binary smoke test, skipped by default:

```bash
GOODBOY_TEST_REAL_CODEX=1 cargo test --lib -- --ignored codex_real
```

### Antigravity CLI

Google deprecated the Gemini CLI's login-with-Google flow on 2026-06-18, and `agy`
is the successor.

- `agy` (v1.1.9) has no auth surface. Its subcommands are `agent, agents, changelog,
help, install, models, plugin, plugins, update`, and `agy login` does not exist
- The Antigravity app writes the session to `~/.gemini/antigravity-cli/`, and
  Goodboy reads that directory as ground truth
- An email claim in a session file fills the identity, and any session file marks
  the provider connected
- `GEMINI_API_KEY` auth is surfaced by the credential layer instead

Turn spawn:

```
agy -p <PROMPT> --model <MODEL> --sandbox
```

- `--sandbox` becomes `--dangerously-skip-permissions` under bypass permission mode
- `agy` has no stable structured JSON output, so the parser treats each stdout line
  as an `assistant_text` delta
- Headless mode reports no per-turn token usage, so cost is estimated from
  per-token pricing

### opencode runtime

opencode, OpenRouter and Moonshot share the `opencode` binary, each with its own
account.

- `opencode auth login` is menu-driven. `-p <provider>` and `-m <method>` skip the pickers
- `opencode auth list` prints a boxed report ending in an `N credentials` row.
  Goodboy parses the names from that section, and no rows means disconnected
- Each row is `<name>` followed by an ANSI-dimmed method, so the name ends at the
  first escape sequence
- The `Environment` block below it is ignored on purpose: env-var credentials
  belong to Goodboy's credential layer

opencode resolves providers live against models.dev, so the model id carries the
provider.

- OpenRouter models are stored pre-slugged (`openrouter/anthropic/claude-sonnet-4.5`)
- Moonshot addresses Moonshot directly (`moonshotai/kimi-k3`)
- Both already contain a `/`, so `opencodeModelArg` adds no `OPENCODE_ROUTING` prefix

### API keys

- `PROVIDER_API_KEY_ENV` in `packages/types/src/provider-registry.ts` maps each
  provider to its env var: `ANTHROPIC_API_KEY`, `CURSOR_API_KEY`, `OPENAI_API_KEY`,
  `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `MOONSHOT_API_KEY`
- Keys are validated before storage by `probe_for` in
  `apps/desktop/src-tauri/src/provider_credentials.rs` (Moonshot against
  `https://api.moonshot.ai/v1/models`, OpenRouter against `https://openrouter.ai/api/v1/auth/key`)
- Secrets live in the OS keyring under `provider_credential.<id>` (`secrets.rs`)
- `turn.rs` injects the workspace's bound key as that env var at spawn

### Models and effort

Which models exist, their context window, cost tier and effort ladder are compiled,
never listed here: `packages/core/src/providers/capabilities.ts` and the
per-provider `catalog.ts`. Folders are named after the CLI, not the provider id, so
the anthropic catalog is `providers/claude/catalog.ts`.

What the catalogs do not tell you:

- Cursor's accepted slugs are in `cursor/agent-model-ids.ts`, and
  `cursor/agent-model-ids.test.ts` pins the curated subset against them
- Cursor bakes effort into the slug, so it never receives an effort flag. Its
  reachable levels depend on the Thinking and Fast toggles
- A catalog key names exactly one spawnable model. `catalog.test.ts` routes every
  emittable cli id back through `resolveModelForProvider` and asserts it lands on
  the key that owns it
- Why: anything holding only a key resolves through `variants[0]`, so a key shared
  by several billable models spawns and bills the wrong one
- Codex Sol, Terra and Luna are therefore `gpt-5.6-sol`, `gpt-5.6-terra` and
  `gpt-5.6-luna`, each with its own cost tier and price in `codex/cost.ts` (5/30,
  2.5/15 and 1/6 per Mtok). The picker shows them as version chips
- Cursor is the one provider whose `getCheapModel` is pinned by hand, to `auto`, in
  `cli-defaults.ts`
- Retired ids still resolve through `parseLegacyId.ts`, so an id missing from the
  catalog is not necessarily dead
- An unsupported effort level clamps to the top of what the model supports
  (`clampEffort`), it does not fail
- Label and wire value differ in one place: `xhigh` reads **Very high** in the picker
- claude takes `--effort <level>`, codex takes `-c model_reasoning_effort="<level>"`,
  both built in `apps/desktop/src-tauri/src/turn.rs`
- There is no `ultracode` level. `claude --help` lists exactly
  `low, medium, high, xhigh, max`. Run that check before extending the union

### Defaults internals

- **Task models** persist in `workspaces.task_models` and resolve through
  `resolveTaskModel` in `@goodboy/core`. A pin carries no effort, and task models
  never touch chat turns
- **Agent roles** are the union `AgentRole` in `@goodboy/types`. They persist in
  `workspaces.role_models` and resolve through `resolveRoleRouting`
- Role validation is lenient: an unknown provider or unregistered model drops the
  whole override back to the compiled default
- An effort off the ladder is normalized to the role's default effort when that is
  on the ladder, otherwise to the top of it
- **Fallback** on **Automatic** means the key is absent from the stored preference,
  never a sentinel string, because `auto` is a real Cursor model id
- A set fallback is tried first on the first retry of any classified failure, with
  the `planTurnFallback` heuristic as the backstop for the second. `MAX_ATTEMPTS`
  stays 2 and the classification is unchanged
- The fallback inherits the role's effort and is validated on its own. It drops back
  to the heuristic when it names an unknown provider or model, a disconnected
  provider, or the pair that failed on this turn. One entry, then the heuristic

### Source map

- `packages/types/src/provider-connect.ts`: connect tiers and `loginEnv`
- `packages/types/src/provider-commands.ts`: install, login and logout commands
- `packages/types/src/provider-catalog.ts`: `PROVIDER_KIND`, `OPENCODE_ROUTING`
- `packages/types/src/provider-registry.ts`: provider ids, `PROVIDER_API_KEY_ENV`
- `apps/desktop/src/store/slices/providers/connectProvider.ts`: the connect state machine
- `apps/desktop/src/features/providers/components/ProviderStudio/`: the provider cards and **Defaults**
- `apps/desktop/src/features/providers/components/ProviderConnectModal/guides.ts`: in-app guide copy
- `apps/desktop/src-tauri/src/providers.rs`: detection and auth probes
- `apps/desktop/src-tauri/src/provider_credentials.rs`: API key validation
- `apps/desktop/src-tauri/src/turn.rs`: turn spawn args and env
