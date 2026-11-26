# Models settings

> **Read this when** you change the Models or Every run settings rows: the
> provider order and its rows, or the run, role and task rows.
> **Not for** how the answer is worked out ([routing.md](routing.md)).

Open **Settings › This workspace › Models** to choose what a workspace uses when
you leave a model on **Auto**. Every model a row prints is the answer of the one
resolver ([routing.md](routing.md#one-resolver)), never a second computation.

## The two pages

- **Models**: a first line points to **Connections** for accounts, usage and
  picker models (`DefaultsPanel/ConnectionsPointer`), then one band each for
  Providers, Chat and Background tasks
- **Every run**, on Workflows (`EveryRunModels`): the Lead, the roles and the
  older plan runs. It mounts the same `RunsSection`, `RoleRow`,
  `OlderPlanRunsBand` and `RolePinsOffLine` through `defaultsPanelSurfaces.ts`
- The header names the workspace, or **All workspaces**, and carries no count

## Provider order

The row sums up the policy ("Claude, Codex · Cursor as backup") and opens the list
in place: drag a provider by its handle or move it with Alt and an arrow. This
band is the one home of the policy and the priority rule.

- **On**: the first On provider is the default for new work, so moving another
  to the top changes the default in the same write
- **Backup only**: runs only when no On provider can work. A pin on it waits too
  (skipped as `backup-idle`)
- **Off**: binds every saved pin, and Auto takes over. Only an explicit pick (one
  turn or one agent chosen by hand) runs there, and the transcript says so once
- **New**: a provider connected later shows last, unused until turned on
- **Keep using after the limit** keeps a provider in the order at its limit.
  **Reset** turns every connected provider On
- A session reads the policy live and ignores the `enabledProviders` it stored

### Rows under the order

`ProvidersInOrder` mounts these, never `DefaultsPanel/index.tsx`.

- **Provider priority** (`ProviderRuleRow`, `useProviderRule`): **By order**, your
  order wins and a provider at 80% of its limit goes last. **By load**, the lowest
  usage band (under 50%, 80%, 100%) wins, then fewer recent agents, then the order
- **Room right now** (`RoomNowRow`): each On and Backup provider's used share,
  marked estimated with no fresh reading (`roomTextOf`)
- **Never picked** (`GuardsRow`): the guards that keep a provider or model out
- **Last 5 hours** (`LastHoursRow`): agents per provider, running ones included
  (`providerLoad` over `ROOM_TURNS_WINDOW_MS`)

The priority rule writes `spreadByHeadroom` in the workspace workflow rules
through `patchWorkspaceOverrides` (off is By order). A failed write says
"Couldn't save the provider priority" and keeps the old rule. No saved rules means
By order (`DEFAULT_WORKFLOW_RULES`), and a saved choice is never rewritten. The
rule applies from the next agent, and a run started from a workflow keeps its rule
(`rulesSnapshot`).

The room, load and candidates come from one snapshot, `useRoutingSnapshot`:
`selectCandidateInputs` (the selector the Lead's candidates list reads) over one
turns read (`routingTurns`) that the rows and every open role share. Turns are
read again every minute, on a workspace switch and when an agent starts or ends.
A late read is dropped, and a read of another workspace shows nothing. The inputs
are worked out again at once when the policy, limits, cooldowns, budget alerts,
strikes, hidden models or CLI requirements change. The Runs settings page shows
nothing of the policy or the rule.

## Rows and columns

- **Runs** (Every run): **Auto agent** is the `auto` role (`roleModels.auto`,
  narrowed to the providers Auto can run on). **Older plan runs** is the
  `workflow_orchestrator` task, shown only while a plan run is not discarded
  (`useHasPlanRuns`). `DEFAULT_GROUPS.runs` lists them
- **Roles** (Every run): Explore and plan, Build, Review and write, Other. A pin on
  an agent or a workflow step beats the role
- **Background tasks** (Models): Writing for you, Running workflows, Git.
  **History rewriter** is task `rebase`, **Scribe** task `pr_draft`

Every row sits on one column template (`DefaultsPanel/roleGrid.ts`): name, job,
model, effort, source chip, chevron. A task or chat row's picker spans the model
and effort columns and keeps an empty chevron slot, so the columns line up. The
job column hides under 720 px. `node scripts/validate-scenes.mjs --only models-grid`
checks the `settings-providers-scope` scene at 960 and 1280 px: one template, no
row past its band, no sideways scroll.

## Task rows

- An unpinned row reads **Auto**, and its closed trigger names the model Auto
  runs (the chat row through `RoutingPicker`'s `autoTrigger="resolved"`)
- Picking a model pins it (`· pinned`); **Back to Auto** in the picker clears it
- **Reset all to Auto** clears this page's pins (new chats and background tasks)
  after a confirm with the count. The pins of Every run stay

## Role rows

Each role row (`DefaultsPanel/RoleRow`) is a `Collapsible`. Closed, it shows the
model from `useResolution({ role, workspaceId })`, its effort and how many more
follow (`Opus 5.5 · High +2`), with a **Pinned** or **Auto** chip.

- When the set's first model cannot run, a muted line says so through
  `explainResolution` and `resolutionNote`. `TaskModelRow` does the same
- When some agents pin only models that cannot run, a line under the title counts
  them, with **Back to Auto for those 7** behind a confirm. It hides at 0

Open, the row shows:

1. **How Scout runs**, built from the engine, never from copy: the
   `ROLE_REGISTRY` `explain` entry, the pick (`isAutoOnly`), and the split limits
   from `roleSplitLimits` (`FAN_OUT_MAX_CHILDREN`, `SCOUT_DEPTH_CAP`,
   `FAN_OUT_DEPTH_CAP`, which `scoutTree` enforces). With Parallel agents off it
   says the role runs as one agent
2. **By step size** (`roleRunFacts` `bySize`): Auto for a small, normal and large
   step through `resolveSlot` with `size`, the call the run makes. A step that
   follows its role says when its size moved the rung (`isSizeMovingRung`)
3. **Candidates for Scout right now** (`RoleRow/RoleCandidates`), except on the
   Lead: `buildCandidates` at the default size from the same snapshot, struck rows
   with their cause, and a check on `bestCandidate`. A pinned role lists its
   pinned models
4. **Models for planning**: the role's set of up to three. **Add** adds the model
   in view once; remove with **x** or Backspace, move with Alt and an arrow

The **Older plan runs** band, shown only while a plan run exists, holds the
Orchestrator row and **Models in older plan runs**, off by default
(`canOrchestratorPickModel` in `workflowRules`, read from the run's
`rulesSnapshot`). The Lead starts on the request as typed; a
`models.classifyRequests` row in the settings table is never read.

## Saved models notice

`SavedModelsNotice` shows under the header while role or task models a project
once had are still saved ([routing.md](routing.md#project-model-settings)).
**Show** lists each folder; **Apply to this page** merges it into the workspace
(the saved value wins a role or task both set); **Discard** deletes its key. Each
has a confirm anchored to its button. A failed write shows its reason and keeps
both buttons and the saved settings.
