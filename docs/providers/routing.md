# Routing: which model runs

> **Read this when** you change how the provider, model and effort are picked:
> the resolver, the Auto ladder, the candidates, the provider policy or the saved
> role and task models.
> **Not for** the Settings rows ([models-settings.md](models-settings.md)) or
> which models exist ([models-and-effort.md](models-and-effort.md)).

## How Auto picks

Auto picks the same way for roles and tasks: the model chosen for that job on the
default provider, then the next model in that list when your CLI is too old for
the first, then the next provider in the fallback order when the default is not
connected.

### Rungs

A job names a rung, never a model. `effortLadder.ts` gives each curated provider
five rungs, each a model line plus an effort, and `slotRungs.ts` gives each role
and task its rung for a normal step. A line is never a version, so a new model
reaches Auto on its own, and each rung keeps the older models of its line for a
CLI that is too old.

| Rung     | Claude                                       | Codex              | Gemini                                          | Cursor                                        |
| -------- | -------------------------------------------- | ------------------ | ----------------------------------------------- | --------------------------------------------- |
| Quick    | Haiku Low                                    | GPT-6 Luna Low     | Hydrogen Low                                    | Auto                                          |
| Light    | Haiku Medium                                 | GPT-6 Luna Medium  | Hydrogen Medium                                 | Haiku Medium (Auto without Max Mode)          |
| Standard | Sonnet Medium                                | GPT-6.2 Sol Medium | Hydrogen Medium                                 | Sonnet Medium                                 |
| Hard     | Sonnet High                                  | GPT-6.2 Sol High   | Carbon High (Hydrogen with Carbon hidden)       | Sonnet High                                   |
| Top      | Opus High (Opus 5.5, Opus 5 on an older CLI) | Astra High         | Neon High (Hydrogen Very high with Neon hidden) | Opus High (Sonnet Very high without Max Mode) |

The Planner sits on Top, the Debugger and the Reviewer on Hard, Scout, Docs,
Scribe and re-checks on Light, the five small writing jobs (step summaries,
learnings, prose polish, agent naming, issue briefs) on Quick, and the
Implementer, Tester, Resolver, plan drafting, Generalist, Report and the other
roles on Standard. OpenRouter, Moonshot and opencode follow the cost tier of the
Claude model on the same rung.

### Step size

`modelForStep` (`autoRouting/modelForStep.ts`) is the one function that turns a
slot, a step size and the connection state into a model. Auto (`resolveAuto` is
its size-less call), the Models page, Auto's children and workflow steps call it.

- A small step moves an agent role one rung down, a large one up. `SLOT_RUNGS`
  holds both per role, so agents never sit on Quick and the Planner never below
  Hard. A background task never moves
- When the rung's newest model cannot run, it tries the older models of the line,
  then the rungs below (a large step climbs first), then the strongest visible
  model of the rung's cost tier, and only then the next provider at the same rung

### Role model sets and steps

- A role with a set runs on one of its models: the first that can run with no
  size or a large step, the first at mid cost or cheaper for a medium step, the
  first cheap one for a small step, the cheapest when none fits. Off, not
  connected and retired models are skipped. A role without a set runs on Auto
- Workflow steps follow their role's set unless the step pins a model
- The orchestrator's prompt lists each role's set. A pick outside the set falls
  back to the set by the difficulty it named (light, standard, heavy as small,
  medium, large)

## One resolver

`resolveSlot({ slot, layers, context, pins })`
(`packages/core/src/providers/resolve/`) answers what runs for a role or a task.

- `slot` is `{ kind: 'role' | 'task', id }`
- `layers` are the workspace, project and session overrides. Role and task models
  merge per key by `mergeLayers` over the workspace and the session only (the
  session wins), as `resolveSettings` does. The project layer supplies only the
  provider list and the default provider
- `context` holds the provider policy, connected and at-limit providers, hidden
  models, CLI versions and learned CLI requirements
- `pins` are the turn, agent, step and run models, in that order, before any
  layer. Turn and agent pins are explicit picks and may run on an Off provider,
  never on one that is not connected. Step and run pins are bound by Off

The answer is `{ provider, model, effort, source, via, skipped }`. `source` is
who decided (`turn`, `agent`, `step`, `run`, `session`, `workspace`, `auto`). `via`
is `pin`, `backup` (a later model of the set, or a task fallback) or the Auto step.
`skipped` lists each pin or candidate passed over: `off`, `not-connected`,
`at-limit`, `hidden`, `cli-too-old`, `unknown-model`, `backup-idle`.

It is built on `resolveRoleRouting`, `traceTaskModel` and `resolveAuto`.
`explainResolution` turns `skipped` into the sentence a row prints, and
`skippedPinNote` into the orchestrator prompt's clause.

### Who reads it

The store builds the inputs once (`selectModelContext`, `selectResolution` in
`store/runtime/models/`), and components read them through `useResolution`.
`autoModelOn` answers what Auto would pick on a provider the user chose.

The Models rows, the run and builder pills, the orchestrator defaults
(`roleDefaultsFor`), helper tasks (`selectTaskModel`), turn fallbacks
(`selectModelOnProvider`), the History rewriter (`historyRewriterConfig`) and
Scribe (`scribeModelConfig`), the report and wireframe spawns all read it, and a
session's own layer reaches each of them. Workflow child and node picks
(`rolePicks`) hand `resolveWorkflowRouting` the resolved model as both defaults,
so a pin that can't run has no second recovery.

A model a step or an Auto child proposes goes through `resolveProposedRouting`
(`store/slices/workflows/`): parse, keep it inside the role's set, `rolePicks`,
`resolveWorkflowRouting`. The orchestrator and the Auto delegation verb both call
it. Only kind and step routing (`kindRouting` behind `selectKindRouting`, and
`resolveStepRouting`) stay outside, on the same settings and scope, and the parity
test checks them against the row.

Tests: `resolution.parity.test.tsx` (rows and pills agree),
`resolution.runtime.parity.test.ts` (the runtime agrees with the row on a
Codex-only workspace with Anthropic pins and an older session) and
`resolveProposedRouting.test.ts`. The `resolver-entrypoints` ratchet counts files
that still import `resolveRoleRouting`, `resolveTaskModel`, `resolveAuto` or their
wrappers, and only falls.

## The Auto ladder

`resolveAuto` (`packages/core/src/providers/autoRouting/resolveAuto.ts`) is one
ladder for roles and tasks.

- `AUTO_JOBS` (`autoRouting/defaults.ts`) holds one column per curated provider
  (Claude, Codex, Gemini, Cursor) and one ordered list of jobs per role or task. A
  job names a line and an effort
- `latestInGroup` expands it once, at load, into `AUTO_DEFAULTS`: the non-legacy
  models of each line, newest first. A resolve never expands again
  (`expandAtLoad.test.ts`)
- It skips models the CLI is too old for (`cliGate`) and Cursor combos that need
  Max Mode while it is off
- A provider with no column (OpenCode, OpenRouter, Moonshot) falls back to
  `strongestModelForTier`, after every curated provider
- `defaults.test.ts` checks every cell against the catalogs and that each starts on
  its line's newest model. No Cursor default needs Max Mode
- `ROLE_REGISTRY` holds no routing: the Claude column of `AUTO_DEFAULTS` is the
  reference. `kindRouting` maps an agent kind to its role and reads the same
  ladder; there is no separate cheap tier for Scout, Docs or Generalist

### Providers at their limit

`providerCandidates` keeps a provider that is connected and not at its limit
(`atLimit`, from `providersAtLimit`: a window is out and has not reset). A pick
that passed one for its limit carries `skippedAtLimit`. The Auto rows of the task
and orchestrator pickers say which provider it left and why, and a provider's Usage
notice says where Auto sends new agents.

- The desktop fills `atLimit` through `autoLimitContext` only while some provider
  is out, for agent spawns and every task
- A task model resolves only through `resolveLimitedTaskModel`; a test fails on a
  direct `resolveTaskModel` call. A provider the user picked passes
  `limitContext: null`

## Candidates

`packages/core/src/providers/candidates/` lists every model a new agent could
start on, for one role and size, across every On and Backup provider.

- `buildCandidates` walks `providerCandidates` and the Auto pick chain per provider
  (`providerStepPick`): the rung for the role and size plus one lighter rung,
  never below the role's lowest
- Each row carries the order, the room, agents started in the last hour, the rate
  and the family (`modelFamily`, from the catalog group: Sonnet through Cursor is
  the Claude family, Cursor Auto has none)
- A Backup provider stays idle only while an On provider can run the need
- A role pin lists only its pinned models while one can run. A pin skips the
  hidden check, not the CLI check or the family guard

A guard strikes a row with a cause from `CANDIDATE_CAUSES`: the provider checks
(not connected, Off, Backup idle, out of room, cooling down, an open breaker, a
budget alert), outside the run's providers, a provider the Lead never starts
helpers on, a writer off `AUTO_WRITER_CHILD_PROVIDERS`, a failed start of the same role in this work (`failedStarts`), hidden, CLI too old,
outside a role pin, or the writer's family for a review (kept, and said, when no
other family is left). Each cause maps to an `adjustment` word an older build
reads, so a stored decision stays a patch.

- `bestCandidate` takes the best valid row. By order: not near its limit, then the
  order, then the rung before the lighter one. By load: room band, then load plus
  picks made in the same batch, then the order. A pin wins over either
- `checkPick` keeps a pick, moves it to the best row with its cause, or refuses it
  only when no row is valid. A pick at an effort no row lists is moved
- `formatCandidatesBlock` writes the prompt table, one line per provider, with the
  role guards, the run budget and which providers keep a session after a question.
  It drops rates, then facts, then the last providers to stay under 2,400
  characters, never throws, and is left out when fewer than two providers are
  named or one still does not fit

## Provider policy

`workspaces.provider_pool` holds a list of names (`["anthropic","codex"]`: those
On in order, the rest Off, the saved default first) or a list of entries
(`[{ "id": "codex", "state": "on", "keepAfterLimit": true }, ...]`). `null` means
every connected provider On, in today's order.

- `parseProviderPolicy`, `override-row.ts` and `settings_overrides.rs` read both
  shapes. A 0.15.4 build reads entries as `null` and falls back to every provider,
  and the backup bundle carries either shape at the same schema version
- One writer, `setProviderPolicy`, patches the policy and the default provider
  together. Writes queue per workspace (`patch_workspace_overrides`) and send only
  changed keys, so two quick edits, even from two windows, keep both. A value of
  neither shape is refused with `invalid_setting_value`, not stored as null
- One reader, `providerCandidates` (`autoRouting/providerCandidates.ts`): usable On
  providers in order, then usable Backup only ones. The curated-first rule stays
  only for a `null` policy
- `providerStanding` names why a provider is out (`not-connected`, `off`,
  `at-limit`, `backup`), so a pin on an Off provider falls back to Auto
- `workingProviders` (On, or Backup only once no On provider can work) filters
  `workflowAvailabilitySnapshot` for static steps, fan-out children and the
  orchestrator menu (`availability.providerOrder`)
- `workspacePolicyAvailability` gives each snapshot the policy of the workspace
  that owns the session (the current workspace only when no session is known) and
  the providers at their limit

## One calculation for "what runs here"

Every agent launch asks `selectKindRouting` (a session) or
`selectWorkspaceKindRouting` (the kickoff). Both go through `scopedKindRouting`,
the call `spawnAgent` makes, with role pins, the default provider and
`autoLimitContext` (limits, hidden models, CLI versions), so the model a launch
shows is the model it runs.

- Step routing (`resolveStepRouting`) takes the same scope from
  `selectRoutingScope`, or `useRoutingScope` in a component
- Pre-spawned step agents take the candidates instead
  ([workflows.md](../workflows.md#provider-priority-for-steps))
- An Off provider is never offered or estimated there, even as the session default
- Resolve, its next-step card and Start work from chat follow the workspace
  default provider

`one-routing-calculation.test.ts` fails on a bare `kindRouting(` anywhere else and
on a step routing call without its scope.

## Saved role and task models

### Task models

- Saved in `workspaces.task_models`, read through `resolveTaskModel`. A pin may
  carry an effort and a `fallback`; without an effort it runs at `medium`, clamped
  to the model's ladder. A model without an effort axis gets none
- PR drafts and rebases preselect the agent's model with no automatic effort.
  Task models never affect chat turns
- A pin on a disconnected provider moves to its fallback, then to Auto
- Re-checks are the `recheck` task in the Review group

### Agent roles

Roles are the union `AgentRole`, saved in `workspaces.role_models` and read
through `resolveRoleRouting` with an optional `auto` context and step `size`.
Without a context it answers for Claude.

- `auto` has a registry entry, a slot in `AUTO_DEFAULTS` (Sonnet 5.5 at medium)
  and a place in `ROLE_SLOTS` and `PROFILE_ACCESS`, but every eligibility flag is
  off and `DEFAULT_GROUPS` leaves it out, so the Models page has no row for it
- The saved shape is `{ providerId, model, effort, models }`, with the first entry
  of `models` mirrored in the old fields for older readers. An older row
  `{ providerId, model, effort, fallback }` reads as a set of two
  (`roleModelChoices`)
- When the set's first model cannot run here, the result carries
  `pinnedUnavailable`
- An unknown provider or model in a set is skipped; with none left the role uses
  its built-in default. An effort off the ladder becomes the role's default
  effort, or the top of the ladder

### Retries

1. After a recognized failure, the first retry uses the set's next model after the
   failed one, or its second model when the failed one is not in it
   (`nextRoleModelChoice`). A set of one has no retry of its own
2. The second retry uses the `planTurnFallback` heuristic. `MAX_ATTEMPTS` stays 2

A set model uses its own effort, else the role's. The heuristic takes over when it
names an unknown provider or model, a disconnected provider, or the pair that
failed on this turn.

### Project model settings

Project model settings do not apply. Their role and task models sit under the
settings keys `legacy.projectModels.<projectId>` (`{ taskModels, roleModels }`),
which `resolveSettings` and `mergeLayers` ignore. The `saved-project-models` slice
reads and writes them for the notice on the Models page
([models-settings.md](models-settings.md#saved-models-notice)).
