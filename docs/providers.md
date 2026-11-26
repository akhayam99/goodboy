# Providers

> **Read this when** you set up, connect, switch or fix a provider, or change how
> Goodboy installs a provider CLI, checks its sign-in or starts it.
> **Not for** how the model picker groups and shows models ([model-picker.md](model-picker.md)).

Goodboy runs your tasks on the coding agents you already pay for. This page says
how providers work and which page holds each part.

## How providers work

- A provider is a CLI on your machine, or an API key that runs through OpenCode.
  Goodboy finds the CLI on your `PATH`, starts it in a hidden terminal and reads
  what it prints
- Goodboy runs the provider's own sign-in, so your credentials never pass through
  Goodboy. API keys sit in the system keychain
- One row per provider says what the app knows about it, in a Rust table and a
  TypeScript table that a test keeps equal. Code branches on a flag of that row,
  never on a provider id
- A provider's standing comes from probes and real runs together. Three refused
  runs in 10 minutes open a breaker that keeps automatic routing off it
- Each workspace orders its providers, each On, Backup only or Off. One resolver
  answers which provider, model and effort run, and every screen prints that answer
- Models live in the code catalogs. Auto names a rung of a model line, so a new
  model reaches Auto by itself
- Every turn sends the session's permission mode to its CLI. A mode a CLI can't
  honor runs as the next stricter one

## Pick a provider

| Provider   | What you need         | How it connects        |
| ---------- | --------------------- | ---------------------- |
| Claude     | Claude Pro or Max     | Browser sign-in        |
| Cursor     | Cursor Pro            | Browser sign-in        |
| Codex      | A ChatGPT plan        | Browser sign-in or key |
| Gemini     | Google AI Pro         | Antigravity app or key |
| Copilot    | A Copilot plan        | Browser sign-in        |
| OpenCode   | Nothing, free models  | OpenCode login         |
| OpenRouter | An OpenRouter API key | Paste the key          |
| Moonshot   | A Moonshot API key    | Paste the key          |

Every provider has a page in **Connections** (**Go to Connections** in ⌘K) that
shows whether it is installed, which account is signed in, and its **API keys**.

## Moving a conversation to another model

Cursor, Codex and Gemini do not keep your conversation: Goodboy sends it again
with each turn, as a block of prior turns of at most 8,000 estimated tokens
(`PRIOR_TURNS_BUDGET_TOKENS`). Your original request and the end of the
conversation always go along, with a long message cut and marked. When a move
leaves something out, the transcript says so ("Carried over: 6 turns, the plan, 2
notes; left out: 14 older turns.").

## Pages

- [connect.md](providers/connect.md): connect, disconnect or switch a provider
  account, or fix one that does not connect
- [provider-page.md](providers/provider-page.md): a provider's page, with Usage,
  Models in the picker, Account, Check again and History
- [models-settings.md](providers/models-settings.md): the Models and Every run
  settings rows, from the provider order to the role and task rows
- [routing.md](providers/routing.md): how a provider, model and effort are picked:
  the resolver, Auto rungs, candidates and the provider policy
- [models-and-effort.md](providers/models-and-effort.md): ship or retire a model,
  or change a price, an effort level or a CLI version floor
- [sign-in-checks.md](providers/sign-in-checks.md): the provider tables, Connect,
  the connect tiers, the commands per provider, the checks and the breaker
- [cli-flags.md](providers/cli-flags.md): the arguments, environment and prompt
  channel of each CLI, and how its stream is read
- [permission-modes.md](providers/permission-modes.md): what a permission mode
  becomes on each CLI, and a workspace's default mode
- [usage-limits.md](providers/usage-limits.md): usage windows, free resets,
  spend, room and load

## Defaults and task models

The Models settings page sets what a workspace runs when a model is on **Auto**:
the provider order, the role rows and the background task rows, all read from one
resolver. See [models-settings.md](providers/models-settings.md) and
[routing.md](providers/routing.md).

## Defaults internals

`resolveSlot`, the Auto ladder, the candidates and the provider policy are in
[routing.md](providers/routing.md).

## Models and effort

Catalogs, prices, effort flags and the CLI version gate are in
[models-and-effort.md](providers/models-and-effort.md).

## Permission modes per CLI

The table of what each mode becomes on each CLI is in
[permission-modes.md](providers/permission-modes.md).

## How the checks read the answer

Every version and sign-in check runs through `proc/probe.rs`, which kills and
reaps the CLI's process group on the deadline. The rest is in
[sign-in-checks.md](providers/sign-in-checks.md#how-the-checks-read-the-answer).

## Under the hood

More source files:

- `apps/desktop/src-tauri/src/providers.rs`: finding CLIs and checking sign-in
- `apps/desktop/src/store/slices/providers/providerHealth.ts`: the standing
  reducer, fed by `applyProviderProbe.ts` and `recordProviderRun.ts`
- `apps/desktop/src-tauri/src/provider_standing_log.rs`: the log line for a
  standing change
- `apps/desktop/src/features/providers/components/ProviderConnect/guides.ts`: the
  guide text shown in the app
- `packages/core/src/providers/copilot/`: the Copilot catalog, accepted ids and
  stream parser
