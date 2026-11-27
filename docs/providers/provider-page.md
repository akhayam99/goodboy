# The provider page

> **Read this when** you change a provider's page in Connections: its head, its
> Usage, Models in the picker and Account groups, **Check again** or **History**.
> **Not for** how the numbers are read ([usage-limits.md](usage-limits.md)) or
> how the standing is worked out ([sign-in-checks.md](sign-in-checks.md)).

A provider tile in **Connections** opens its page under the trail
`Connections > Claude` (Esc goes back up). A provider in the Not set up row opens
on its install or sign in step. Settings has no provider pages.

## Layout

Four groups, in the same order for every provider: **Usage**, **Models in the
picker**, **Account**, and a closed **What works with Claude** row with the
permissions table and how many modes work fully (`4 of 6 work fully`).

- The head carries the glyph, the name, the same state word as the tile
  (`Signed in`, `About to run out`, `Key saved`, `Not set up`), a check again
  button and the menu. Pills below show the plan, the account, the CLI version and
  the last check
- The menu holds **Check again**, **Sign in again**, **History**, **Copy CLI
  path** and, after a line, **Disconnect**. It reads the provider kind of the
  action registry (`useProviderTarget`, `kinds/provider.ts`), so no button repeats
  a verb
- A provider that is not set up shows only its setup path

## Usage

- One row per reported window (5 hours, the week, a model's week) with the share
  used and the reset. The header says when the numbers were updated and has a
  refresh that asks the CLI now
- A notice says when the provider is about to run out or is out, or that three
  checks in a row failed
- Cursor and Gemini share no usage, and an API key provider is billed per token,
  so neither shows windows
- A Codex free reset shows with **Use reset** behind a confirm
  ([usage-limits.md](usage-limits.md#codex-free-resets))
- **Spent in Goodboy**, the last row, shows spend at API prices and the budget
  ([usage-limits.md](usage-limits.md#spent-in-goodboy))

## Models in the picker

A model turned off here is never offered for a new choice, in any workspace, and
no automatic choice uses it: the pickers, Auto for roles and tasks, the
orchestrator's model menu, the run planner, workflow recovery, turn and task
fallback, and the Ask and Chat defaults all skip it. A pick the orchestrator still
names is replaced by an allowed model (the decision says `hidden`).

- A model that is the only one left for a role is never swapped for a hidden one:
  the run says `No model is allowed for this agent`
- With every curated pick of a provider hidden, Auto takes that provider's
  strongest visible model by cost tier that the CLI can run (and, on Cursor, that
  needs no Max Mode while it is off), else the next provider
- An explicit choice still wins: a Settings pin, a step or agent lock, or a model
  picked by hand keeps running, and its Models row says so

The group's rule line reads _Hidden models are not used by agents or the
orchestrator, except where a task setting names one._

- The header shows `Showing 6 of 11` and **Show all**, and counts this
  workspace's pins on the provider (`ProviderPage/ModelsGroup/PinnedCount`)
- Each family has a switch, then one chip per version. Older versions start
  hidden, and the last visible model of a provider stays visible
- A pinned value always shows in the picker, marked **Hidden in the picker**
- The settings icon next to **Provider** in the picker opens this group

## Account

- Who is signed in, the plan and when the server confirmed it, and one chip
  (`Working`, `Not confirmed`, `Update needed`, `Signed out`). `providerAccountChip`
  asks the same `providerRailStatus` as the rail dot but leaves usage to the
  notice, so a nearly out provider stays `Working`
- No button, except **Sign in again** while the sign-in has expired or the last
  connection test failed
- One CLI row in the same place on every CLI provider, with `CliUpdateNotice`
  right below it when a model needs a newer CLI. A provider with its CLI but no
  sign-in shows the same row under its connect card (`AccountGroup/CliGroup`),
  where an `update` deep link starts the update too
- **Use an API key instead of your plan** opens an inline form with **Cancel** and
  **Save key**. A failed save keeps the form and the key and says so. Saved keys
  show with the workspace credentials under them

**What works with** says what the CLI does with each mode (`Works`, `Partly` with
the reason, or `Not available` with the mode it runs as), whether it follows Allow
and Deny rules (only Claude does), and that role limits are asked, not locked. It
reads `modeSupport` ([permission-modes.md](permission-modes.md)).

The rail row carries a dot only when the provider needs you, with the reason as
tooltip and accessible name: warning from 80% of a window and when out, danger on
an error. A working provider shows no dot, never a green one.

## Check again and History

**Check again** refreshes the providers and, on Claude, Codex and Cursor, makes a
real account call with a 15-second deadline. The row shows the elapsed time, or
the error's first line with **Sign in again**. A refusal counts once in the
breaker; a pass confirms the account.

The command is `provider_test_connection` (`src-tauri/src/providers/test_connection.rs`).
It answers with a typed outcome (`answered`, `timed_out` with its seconds, `empty`,
`unsupported`, `refused` with the CLI's text) and never a sentence, so the row
names the deadline the command used. On Cursor it also returns the model ids the
account lists, which mark the others as not on the account
([models-and-effort.md](models-and-effort.md#models-an-account-cannot-use)).

**History** opens a panel under Account with the newest 20 changes since launch,
relative times with absolute ones in tooltips. **Hide history**, Escape or History
again closes it. It reads the health ring through the
[Account history panel](../../apps/desktop/src/features/providers/components/ProviderStudio/ProviderPage/AccountGroup/ConnectionHistory/index.tsx),
and each change uses the standing log.

## Under the hood

- `apps/desktop/src/features/providers/components/ProviderStudio/`: the rail,
  **Models** and `ProviderPage/` (`UsageGroup`, `ModelsGroup`, `AccountGroup` with
  `ApiKeyForm`)
- `apps/desktop/src/features/providers/ProviderDetailBody/`: the page body (head,
  facts, group order, `PermissionsFold` over `permissionRows`), shared by Settings
  and `features/connections/components/ProviderDetail.tsx`. Its head word reads
  `features/connections/model/connectionStateOf.ts` through `useProviderStateWord`
