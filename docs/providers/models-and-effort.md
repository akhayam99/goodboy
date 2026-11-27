# Models and effort

> **Read this when** a model ships or retires, or you change a price, an effort
> level, a CLI version floor or how an unusable model is learned.
> **Not for** which model Auto picks ([routing.md](routing.md)) or how the picker
> groups models ([model-picker.md](../model-picker.md)).

These pages do not list models. The models, their context window, cost tier and
effort ladder live in `packages/core/src/providers/capabilities.ts` and each
provider's `catalog.ts`. Folders are named after the CLI, not the provider id, so
the anthropic catalog is `providers/claude/catalog.ts`.

## Ship or retire a model

1. `<cli>/catalog.ts`: the entry with its `presentation.group`, `checkpoint` and
   `order`, which decides the newest model of a line. Set `minCliVersion` to the
   first CLI whose model list describes the id (for Claude, probe the
   `@anthropic-ai/claude-code-<platform>` package of each version in a scratch
   folder, never a global install). One entry per provider carries
   `defaultTurn: true`; array order never decides a default. A catalog past the
   folder rule splits into `<cli>/<name>Catalog.ts` files spread into
   `catalog.ts` (cursor keeps its Claude block in `frontierClaudeCatalog.ts`)
2. `<cli>/agent-model-ids.ts`: the ids the CLI accepts, copied by hand from its
   model listing (for cursor, `cursor-agent models`). It is the independent check
   the catalog tests compare against
3. `<cli>/cost.ts`: the per-Mtok rate of every new id, from the vendor's price
   page. A rate you cannot confirm keeps `assumed: true`
4. `catalogDescriptor.ts`: a `WEIGHT_BY_KEY` row, or `catalogDescriptor.test.ts`
   fails
5. Nothing else. Auto (`autoRouting/effortLadder.ts`) and the chat default
   (`conversation/defaultChatModel.ts`) name a line (`{ group: 'Sonnet' }`) and
   read it through `latestInGroup`: Auto takes the newest model. So does the chat
   default, unless the provider's turn default sits in that line, which it then
   starts on. `model-versions-live-in-the-catalog.test.ts` fails when product
   code outside the catalog layer writes a versioned id

## Catalog keys

- Each key names exactly one model Goodboy can start. Code that holds only a key
  picks `variants[0]`, so paid models sharing a key would start and bill the
  wrong one. `catalog.test.ts` sends every cli id back through
  `resolveModelForProvider` and checks it lands on its own key
- That is why Codex Sol, Terra and Luna are three ids (`gpt-5.6-sol`,
  `gpt-5.6-terra`, `gpt-5.6-luna`), each with its own cost tier and price in
  `codex/cost.ts`
- Old ids still work through `parseLegacyId.ts`, so an id missing from the
  catalog is not always dead
- `cursor/agent-model-ids.test.ts` checks the chosen Cursor slugs against
  `cursor/agent-model-ids.ts`

### Claude models

- Floors and default efforts follow Claude Code's model config page. Opus 5.5,
  Fable 5.2, Sonnet 5.5 and Haiku 5.5 default to `medium`
- Sonnet 4.5 has no effort levels. Anthropic retires it on November 30, 2026, and
  it stays `legacy` until it leaves the catalog

### Codex models

- `gpt-6.1-sol` is the Codex turn default and chat default. It needs CLI
  0.160.0. The two defaults do not read the installed CLI version, so they stay
  on it while `gpt-6.2-sol` needs a newer CLI
- `gpt-6.2-sol` is the newest `mid` model. Its `minCliVersion: '0.171.0'`, shared
  with `gpt-6.2-astra`, makes Auto keep GPT-6.1 Sol and GPT-6 Astra on an older
  CLI
- `gpt-6.1-terra` needs 0.159.0. `gpt-6-luna` is the `cheap` newest Luna,
  `gpt-5.6-terra` and `gpt-5.5` are `legacy` (hidden until shown) and
  `gpt-5.6-sol` is `expensive`, on Codex and OpenRouter
- The GPT-6.2 weights do not exceed those of the models before them, so a tier
  fallback after a failure lands on a model an older CLI also runs
- Context windows: 500k for the Sol models from 6.1 on, 272k for the others, not
  the larger maximum. OpenAI publishes no Codex window for GPT-6.1 Terra, so it
  takes 272k. The orchestrator's context check reads them
- One install's `codex debug models` need not list every model, so an id it omits
  is checked on OpenAI's Codex model page

### Gemini models

- Antigravity's plans decide who runs what. Gemini 4 Hydrogen runs on every
  Google plan, Neon and Carbon need Google AI Pro or Ultra, and 3.1 Pro, 3.7
  Flash and 3.6 Flash are Enterprise only, so they are `legacy`
- Hydrogen is the turn default and the `cheap` model. Auto takes it up to the
  Standard rung, Carbon on Hard and Neon on Top
- Goodboy cannot read the Google plan, and no Antigravity refusal text is
  recorded for `classifyProviderError`. On a plan without Neon or Carbon, a Hard
  or Top turn fails until you hide them in the model list; then it runs Hydrogen
- A `cliId` is the base name; the level goes in `agy --effort`
- 3.8 Flash leaves Antigravity on November 30, 2026, and the catalog no longer
  lists it. `parseLegacyId` moves a saved pick of it to Hydrogen, and its price
  row stays for recorded spend

### Moonshot models

- Kimi K3.1 Pro is the turn default. The K3 and K3.1 models offer Low, High and
  Max, and default to Max
- The K2.x models are closed to new Moonshot accounts and retire at the end of
  December 2026, so they are `legacy`

### OpenRouter and opencode models

- Efforts, context windows and ids of the newest OpenRouter and opencode entries
  come from the models.dev registry that opencode reads
- A free Zen model that leaves the Zen model page becomes `legacy`

### Cheap model

Only Cursor's `getCheapModel` is set by hand, to `auto` in `cli-defaults.ts`. The
others take the non-legacy cheap entry with the highest catalog `order`, never the
first in the array, so a newer cheap model (Haiku 5.5, GPT-6 Luna) wins.

## Effort

- An unsupported level becomes the nearest lower one the model has, else the
  nearest higher one (`clampEffort`), never a failure
- Only `xhigh` has its own label: **Very high**
- A model with no published levels (Haiku 4.5; on opencode Big Pickle, MiMo and
  both Nemotrons) gets no effort flag. opencode Zen lists variants per model, so
  each entry carries only those
- Cursor puts the effort inside the slug and never gets a flag. Its reachable
  levels depend on the Thinking and Fast toggles
- There is no `ultracode` level: `claude --help` lists exactly
  `low, medium, high, xhigh, max`, and Claude Code's docs call `ultracode` a
  separate setting (v2.1.203 or newer). Codex's `ultra` is its own fan-out, and
  Goodboy owns fan-out. Run that check before you add a level to the union

`effort_args` in `apps/desktop/src-tauri/src/providers/cli_args.rs` builds the
flag for turns, the planner and the summarizer: `--effort <level>` for claude and
Antigravity (`agy --effort`), `-c model_reasoning_effort="<level>"` for codex,
`--reasoning-effort <level>` for Copilot and `--variant <level>` for the opencode
family.

### Copilot models

Copilot lists `auto` (the default) and ids from the CLI reference's supported
models table that GitHub's supported models page also lists. Keys are short names
(`sonnet-5.5`), so one `WEIGHT_BY_KEY` row serves every provider; `cliId` is what
the CLI gets. Only models the supported models page marks as configurable
reasoning (Sonnet 5.5, Opus 5.5, Haiku 5.5, the GPT models and Codex 5.3) carry
efforts, and only low, medium and high: the CLI accepts `xhigh` and `max` but
publishes no per-model list. Haiku 4.5, the two Gemini models and `auto` get no
effort flag. Every window is 200k, the one limit read from a real run. The Sol
models are `mid`, at the price of Sonnet 5.5. GitHub's plan table leaves them,
GPT-6.2 Astra, GPT-6 Astra and Opus 5.5 out of Copilot Pro, so GPT-6.1 Terra
shares the Sol weight and comes first in the array: it is the `mid` tier pick.

## Prices

- Each provider has one price table, its `cost.ts`, which telemetry, budgets and
  estimates all read
- `getProviderModelPrice({ provider, model })` looks only in the running
  provider's `cost.ts` and returns `null` with no rate. The same key on two
  providers (`sonnet-4.6` on cursor and anthropic) never borrows a price
- Copilot, opencode, OpenRouter and Moonshot return `null` on purpose.
  `model-price.test.ts` checks every anthropic, cursor, codex and gemini model has
  a price
- An unpublished rate is copied from the model it follows with `assumed: true`, so
  `costCoverage` reports its spend as approximate (Cursor `auto`, billed at the
  rate of the model it routes to)
- Cursor bills by its own list (`cursor.com/docs/models-and-pricing`), not the
  vendor's. Every Haiku 5.5 combo on Cursor needs Max Mode, which Cursor keeps
  only on legacy plans
- Gemini 4 Carbon carries on Cursor the same post launch rate as on Gemini

### Gemini price dates

Gemini 3.6, 3.7 and 3.8 Flash bill 0.75/3.75 per Mtok (cached 0.075) in
`gemini/cost.ts` until December 31, 2026. Google lists 1.50/7.50 (cached 0.15)
from January 1, 2027, so move the three rows then. `priceSources.test.ts` turns
red on that day so the move cannot be forgotten.

Gemini 4 Carbon carries 4/20 (cached 0.20), the rate Google lists from December
1, 2026, not the lower launch rate that ends the day before.

### Prices by prompt size

A row with a higher rate above a prompt size has an `aboveLevel` (`ModelPrice` in
`provider-registry.ts`): Haiku 5.5 above 100,000 prompt tokens, Codex above 272k,
Gemini 3.1 Pro above 200k, Cursor's Grok 4.7 above 256k. The size is per request
and counts cached tokens.

- `priceLevels.ts` bills each request in `ProviderUsage.largeRequests` at its own
  level and the rest of the turn at the lower one
- Only the Claude parser (`anthropic-envelope-parser.ts`, one entry per assistant
  message id above 100,000 prompt tokens) fills `largeRequests`. Codex and Gemini
  turns bill at the lower rate until their parsers list requests

## CLI version gate

- `minCliVersion` on a catalog model is the oldest CLI that runs it. The Codex
  0.162.1 floor of GPT-6 Sol and GPT-6 Luna is the first version whose
  `codex debug models` was read, so it can only fall
- Write a floor only when a refusal, a release note or the CLI's model list names
  it. A refusal on an older CLI is left to `learnCliRequirement`, which stores the
  required version per provider and model in `provider.cliRequirements`, so the
  gate warns before the next send even with no catalog minimum
- `cliGate` (`packages/core/src/providers/cliGate.ts`) compares the requirement
  with the detected version. An unknown version is never gated
- A refusal becomes a `cli_too_old` transcript item, encoded like `auth_required`,
  with the model, both versions and the raw error. When the turn already fell back
  to a sibling model, the item names it and no second fallback row is written
- The update runs through `provider_lifecycle_run` (action `update`) in the same
  PTY as install and login, then refreshes detection. `provider-cli-updated` logs
  the new version; `provider-cli-outdated` is logged when a requirement is first
  learned, with an action that opens the provider and starts the update

## Models an account cannot use

1. A stream `error` that `classifyProviderError` reads as `model_not_available` or
   `authentication` fails the turn even on exit 0. `readTurnStream` keeps the first
   such message out of the transcript and throws it after the stream ends
2. `recoverTurnFailure` runs the usual path (provider run `failed`, fallback plan,
   strike) and writes one error row with Retry. `settleTurn` passes the reason to
   `onSettled` as `failureReason`, so an Auto helper ends `failed` with it, not
   `no_closing_envelope`
3. `learnFromCliRefusal` stores a `model_not_available` refusal (the ChatGPT and
   Codex account texts, not Cursor Max Mode) per provider, account and model key
   in `provider.unavailableModels`. The account is the provider's `identity` at
   run start (`TurnProgress.accountId`)
4. `selectModelContext` adds the signed-in account's learned keys to `hidden`, so
   candidates, `checkPick` and the turn fallback skip them. An explicit pin still
   runs
5. An accepted run on the model clears the entry in `finalizeTurnStream`

- `unavailableModelsWriter` writes the setting one change at a time. Boot reads
  it, dropping keys the catalog no longer has
- A Lead retry of a helper that ended `model_not_available` or `authentication`
  drops the earlier provider, model and effort (`prepareRetry`), so it is routed
  again
