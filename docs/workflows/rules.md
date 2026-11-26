# Workflow rules

> **Read this when** you change the Every run tab, the run defaults a new run
> copies, standing guidance, run and session limits, or how steps pick a
> provider. **Not for** the provider order and limits themselves
> ([../providers.md](../providers.md)) or how the Lead routes its helpers
> ([../auto.md](../auto.md#providers)).

Rules are the workspace defaults every new run starts from. A run copies them
when it is attached (`session_workflows.rules_snapshot`, written by
`attachWorkflowToSession`), so a later change never touches a run that already
started, even after a restart. The workspace rules are one JSON column,
`workspaces.workflow_rules`; `null` means the defaults. Runs attached from
elsewhere (palette, chat, suggestions) copy the rules with the autonomy their
caller asked for.

## The Every run tab

The rules are the **Every run** tab of the Workflows studio (`EveryRun`,
opened by `setWorkflowStudioView('every')`). Settings has no Runs page: every
link to the run defaults (`openRunDefaults`, a search hit, the section id
`general` or `workflow_orchestrator`) passes `isRunDefaultsFocus` in
`settingRows.ts` and lands here. Search finds older names through
`FORMER_NAMES` and `RUN_DEFAULTS_SEARCH_ALIASES`. The all-pages Restore
defaults and Copy from in the workspace settings menu still carry the run
defaults and list them as Every run.

The tab has one row per setting (`FieldRow`). `WorkflowRulesPanel` owns **When
a run stops for you**, **Spending** and **Guidance**; `EveryRun` passes in
**Edits** (`DefaultModeCards`), **Agents**, the Lead (`RunsSection`), the
roles (`RoleRow`), **Older plan runs** (`OlderPlanRunsBand`, only while
`useHasPlanRuns`) and, last and closed, **Advanced** with **Parallel agents**
(`RunsAdvancedBand`). A failed save keeps the old value and shows the error
under its row.

### Stops for your OK

**Stops for your OK** (`DefaultAsksSetting`, `useStopsLevel`) offers Every
step, After the plan or Never, one level for workflows and the Lead.

1. A pick runs `changeStopsLevel`. It writes `WorkflowRules.autonomy`, then the
   workspace `auto.level` for the named workspace.
2. If the second write fails, it puts the first back and the row shows the
   error.
3. The tabs keep the old level until both writes land. A second pick waits for
   the first.

`stopsLevelOf` reads both keys, an unsaved key as its own default (workflows
`step`, Lead `plan`). When they differ, the row names both and selects none,
and nothing is written until you pick. Both keys reach other windows on the
data-changed bus (`announceWorkspaceChange`, `listenSettingChanges`).
`auto.permissions` is not touched.

## Limits

Each run can have a limit in dollars and a choice of **Pause runs** or **Warn
only** at it, in the same editor as the session's (`SpendLimitFields`).

- The run limit starts at the **Limit** of Every run, and at no limit when that
  is blank (`runLimitOf`). You change it on the run or in Start a run.
- **Limit** on Every run (`DefaultLimitSetting`) applies on Enter or when the
  field loses focus (`useLimitAmountDraft` in `shared/hooks`).
- One limit covers every run, the Lead included: Start a run, `moveToAuto` and
  the Auto runtime all read it.
- A value left under `auto.treeLimitUsd` is folded in once at boot
  (`foldAutoLimitsAtBoot`, `foldAutoLimitIntoRunDefaults`). The smaller stays
  and the key is cleared once the Limit is saved; a failed save keeps both and
  reports the error.
- Every limit field is a text field with a decimal keypad, so `2.50` or `2,50`
  goes through and Enter is never stopped by a browser step rule.
  `parseSpendLimit` in `features/budget/` is the one rule for an
  amount.

A session has its own limit, from the spend popover or an agent page's
**Limit** chip.

- **Pause runs** (the default): every workflow of the session stops at the
  limit, and its strip offers **Raise limit**.
- **Warn only**: nothing stops; one notification says the session passed its
  limit.
- A run that pauses at its own limit notifies "Run is over its limit"
  (`budgetBlock.ts`, `orchestrateNextStep.ts`).
- Single agents are never stopped by it.

## Guidance

The rules carry a markdown text every new run starts with. An empty text adds
nothing.

- An orchestrated run sends it to the orchestrator, merged once with the
  workflow's process text (`orchestratorProcessText`).
- A custom or preset run adds it to the brief of the roles in the run's copy of
  the rules, Implementer and Docs by default (`standingGuidanceSection`). The
  tester or the reviewer get it only when you pick them.
- A run started with its own guidance snapshots that text instead.
- A lone agent gets a **Guidance** section ahead of its ask. An Auto agent
  keeps it in the `run.guidance` workspace value and sends it to every child
  ([../auto.md](../auto.md)).

Steps whose role got it show a **Guidance** tag (`guidanceSentTo`, the check
the brief uses); an orchestrated run tags no step. **Polish** uses `polishWorkflowGuidance` in `packages/core`: one rule per
line, the input's language, every rule kept and none added. The band
(`RulesGuidanceBand`) names who gets the text (`guidanceRoleNames`,
`guidanceLeftOutText`) and which roles never read the profile's working rules
(`workingRulesSkippedText`, from `PROFILE_ACCESS`).

## Provider priority for steps

Workflow and orchestrated steps start on the same candidates as the Lead's
helpers: `buildCandidates` in `packages/core/src/providers/candidates/`, with
scope `step` (no writer guard). The run's copy of `spreadByHeadroom` picks the
rule:

- **By order** (off, the default, `DEFAULT_WORKFLOW_RULES.spreadByHeadroom` is
  `false`): your provider order wins, and a provider at 80% of a limit or more
  is skipped. A run with no copy is By order.
- **By load** (on): the provider with the most room left wins.

The switch is **Provider priority** on the **Models** page
([../providers.md](../providers.md#defaults-and-task-models)). The Lead's
helpers read the workspace rule, not a run copy.

### How a step is placed

- A fixed workflow picks every step when the run is attached
  (`candidateRoutedStep` in `preSpawnWorkflowAgents`). It counts the steps
  already placed, so By load spreads one run over the providers.
- A step that names its own provider, model or effort, or carries a lock or a
  decision, keeps it. A role pin steers a step; the session's composer model
  does not.
- A Reviewer step runs on another model family than the last step that wrote
  code, unless no other family is left (`writerFamilyOf`).
- The pick is stored as the agent's `routing_decision`, in words an older build
  reads (`kind_default`, or `role_default` for a pinned role, and an existing
  `adjustment`), with a short why
  line such as "Codex: most room left".
- When a waiting step starts, `recheckPendingStepRouting` looks again. If its
  provider went Off, into cooldown, past its budget or out of the run's
  providers, the step moves to the best candidate and the why line names the
  cause. A pick you changed by hand is left alone.
- Fan-out children (`childRoutingBatch`) with no pick take the best candidate
  and count their siblings. A planner's pick is kept while its provider passes
  the guards. A session over its budget keeps the older refusal.
- By load with a limit reading older than 30 minutes asks for one re-read
  (`probeProviderLimits`). Providers without a reading use the estimate in
  [../providers.md](../providers.md). With fewer than two connected providers
  nothing is read.

How the orchestrator's steps use these candidates is in
[orchestrator.md](orchestrator.md#who-picks-a-steps-model).
