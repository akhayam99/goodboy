# The orchestrator

> **Read this when** you change how an orchestrated run decides its next step,
> which model the orchestrator or its steps run on, how hints reach it, how a
> plan from a preset follows or adapts the preset, or how a stalled
> orchestrated run is woken. **Not for** the page of an orchestrated run
> ([run-pages.md](run-pages.md)) or how the Lead runs
> ([../auto.md](../auto.md)).

The orchestrator is an agent that plans an **Orchestrated** run, which has no
fixed list of steps (`execution_mode` is `dynamic`). It serves older runs only:
Start a run never starts one, and an open orchestrated run finishes on it
([../features/workflows.md](../features/workflows.md#older-runs)).

After each step it reads the goal, your guidance and what the steps so far
produced. It never does the work itself: it has no tools and cannot open your
repository. It keeps a running recap of what is done and what is left.

## One decision

Between steps, `orchestrateNextStep` asks the orchestrator model for one
decision:

- `next`: the step's name, role, prompt, expected output, task type and
  difficulty. The step is added and its agent starts.
- `done` or `blocked`: saved as the run's outcome with the reason. `blocked`
  sends a notification.

Every decision lands in the transcript as an `orchestrator_decision` event,
with its spend on the run.

- **One at a time.** A request that comes in while the run decides waits in a
  queue. A run reads as deciding until the step it chose exists, never through
  that step's first turn: `orchestratingWorkflowRuns` turns off before
  `activateWorkflowAgent`, while `orchestrationInFlight` keeps the queue closed
  until the turn ends.
- **The summarizer wait overlaps the decision.** The session context
  summarizer must finish before the orchestrator acts, so the next step reads
  fresh context and a run never reports done while it still writes. The wait
  (`waitForSessionSummarizer`, 60s at most, gone when the decision is thrown
  away) starts together with the decision call, so a step costs the longer of
  the two. `maybeAutoAdvanceWorkflow` waits only when a static run is on
  autorun. A forced skip (`bypassGate`) waits on nothing.
- **In memory.** Restart marks, hints being read, deciding runs and queued
  requests live in memory, keyed by run. What a restart needs (outcome, stop,
  summary, hints) is on the run's row.

### Stops are saved, with a kind

Before the call, the orchestrator checks for a session paused by its limit
(`sessionBudgetBlockAfterLoad`, which reads `session_budgets.on_exceed`
first), the run's limit in pause mode, and open questions that block the run.

| Stop        | Saved when                                                                                                                             |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `budget`    | the session or the run is paused at its limit                                                                                          |
| `questions` | an open question blocks the run                                                                                                        |
| `failure`   | the call failed or was unreadable, or the chosen step could not be created (agent row, saved workflow or routing), with a notification |
| `operator`  | **Stop**: autorun turns off and the running steps are skipped, keeping what they wrote                                                 |
| `paused`    | **Pause**: the step in flight keeps going and nothing starts                                                                           |
| `closed`    | **Stop run** (`closeWorkflowRun`), next to the `done` outcome, on static runs too; `isWorkflowRunComplete` reads it as ended           |

So a paid decision never ends with no step and no stop.
`isWorkflowRunClosedByUser` is the one test for a closed run. A decision in
flight is thrown away when it returns after an operator stop or a pause.
Nothing decides again until you continue. Continuing or retrying clears the outcome and the stop; a retry after an
operator stop turns autorun back on.

### A lost wake is recovered

`sweepIdleRuns` runs every 15s and when the window comes back to the front
(`useRunWatchdog`).

1. It looks for an orchestrated autorun run that is started, has no outcome,
   stop or open question, is not deciding, whose session is not advancing, and
   that has a step to decide or start (`findIdleRuns`, built on `nextRunMove`).
2. After 20s of that for a run with no step yet, 45s for any other, it calls
   `maybeAutoAdvanceWorkflow`, at most once per 90s and three times per idle
   stretch (`runIdleEpisodes`).
3. A run still idle after the third try gets a `failure` stop, "Nothing picked
   this run up after three tries", and one notification, with **Retry**.

A run that waits on an answer is never nudged. Answering a question wakes the
run itself, even when no agent could take the answer (`answerOpenQuestions`);
the next sweep is the backstop.

## Models

### The orchestrator's own model

The workspace default is the **Orchestrator** row of **Every run › Older plan
runs**, shown only while the workspace has a plan run that is not discarded
(`useHasPlanRuns`). The run's own pick is the **Orchestrator** chip on the run
page and the routing pill in its composer. Both write `orchestratorRouting`
(`useOrchestratorModel` through `setWorkflowOrchestratorRouting`).

- The orchestrator runs on the run's routing when one is set and the catalog
  still has it, else on the workflow orchestrator task model.
- A saved model the catalog dropped is ignored, never started.
- Its own model is not bound by the run's provider pool.
- Steps take their role models from the resolved settings.

### Who picks a step's model

The orchestrator states how hard a step is (`difficulty`: light, standard or
heavy, which `stepSizeOf` reads as small, medium or large). The code takes the
best candidate for the step's role and size by the run's provider priority
(`resolveOrchestratedStepRouting`, see
[rules.md](rules.md#provider-priority-for-steps)).

- The prompt tells the orchestrator not to name a provider, model or effort,
  and those fields are dropped when it does.
- The opt-in rule `canOrchestratorPickModel` (saved in the run's
  `rulesSnapshot`) lets it pick from a candidates block, sent in place of the
  flat model menu and the role defaults
  (`orchestratorCandidatesBlock`, `ORCHESTRATOR_MODEL_PICK_SYSTEM_PROMPT`). A
  pick from a row runs, with its effort clamped to what the model accepts. A
  pick that is not a row moves to the best candidate, and the why line says so.
  With fewer than two connected providers there is no block and the flat menu
  stays.
- A step lock from a pinned preset step, or a session over its budget, takes
  the older path (`resolveProposedRouting`).
- A generated step with no pick takes the candidates when it starts. A run has
  no per-role model overrides of its own.

Asking for a certain provider or model on a step is a hint too.

### The provider pool

`provider_pool` on `session_workflows` holds the providers picked in the run's
**Models** setting, as a JSON list. Empty means every connected provider.

- `workflowAvailabilitySnapshot` drops the providers outside the pool, so the
  model menu, the routing of each decision, the children a step fans out
  (`childRoutingBatch` with the run id) and the child menu in the agent prompt
  all see the same set.
- A pick outside the pool moves the same way as a pick on a provider in
  cooldown.
- `runProviderPool.ts` reads the pool of an agent's run, which wins. Only Auto
  trees pass the workspace pool instead (`autoChildPool`,
  [../auto.md](../auto.md#providers)).

## Hints

A hint is a note you send the orchestrator while the run goes, and it stays
with the orchestrator for the rest of the run. **Queue** (Enter) waits for the
next decision; on a finished run nothing starts until **Read 2 queued**.
**Send now** (⌘Enter) restarts a decision in progress, and stops a running
step, keeping what it wrote. If the hint can't be saved, your text and images
come back. The composer is in [run-pages.md](run-pages.md#the-composer).

### How hints are stored and read

- Hints live in the run's hint log (`orchestrator_hint_log` on
  `session_workflows`) and survive a restart.
- The decision reads each hint as one `- [new]` line, and every further line
  is indented by two spaces, so a line inside a hint can never pose as a hint
  of its own.
- The orchestrator also gets the session's active numbered decisions (the
  `decisions` slot, cut to its budget), so a step brief can name the number.
- **Read now** marks the decision in flight for restart: its answer is thrown
  away when it returns (its spend still counts) and a fresh decision reads the
  hint. Running steps are cancelled and marked skipped first.
- When a decision lands, the hints it read are marked used with the step they
  informed, after the step exists (`consumeReadOrchestratorHints`). A failed
  write of that mark does not stop the step: the hints stay unread and
  "Couldn't mark the hints as read" shows. A hint added while a decision runs
  stays pending for the next one.
- `orchestratorReadingHints` holds, per run, the unread hints a decision in
  flight took in, plus a **Read now** hint until its decision starts. A
  decision that ends with no restart behind it clears the entry, so a hint
  nothing picked up goes back to queued.

### Hint images

Pasted, dropped or attached images are saved as `goal_attachments` rows the
run owns, listed in every step agent's kickoff, and the hint keeps their
`attachmentIds`. A run with no worktree keeps the files in the session scratch
dir; `attachmentDirOf` says which dir holds a row (see Attachments never need a
worktree in `docs/traps.md`).

1. The orchestrator opens them with Read, Glob and Grep only, on every
   provider. The Rust planner args deny Bash, Edit, Write, web and sub-agent
   tools, and its tools stay off when no hint has an image.
2. Its system prompt allows the reads before the decision
   (`orchestratorSystemPromptFor`), and it writes into the step brief what the
   images show and what to change.
3. The step that starts from that decision gets "Images from the user's hint"
   with absolute paths to those images only, on its first turn
   (`hintImagesForStep`, matched by the hint's `consumedAtStep`).

A restarted run loads its attachments before either lookup.

### Mounts of a run

A branch an unfinished run still uses is refused by `forgetMount`
(`pinnedRunsOf`), and asks first on Close branch and Unmount. A run with no
pinned mount pins the active mount on its next step.

## Plan from a preset

`changeRunRoute` can restart a run as a plan from a preset, named "Plan from
<preset>", with the preset's process as `processText` and a snapshot of its
live steps in `rules.preset` (`presetSnapshotOf`, pins and `routingLock`
included). The prompt lists each step's instructions on one line
(`presetInputOf`, `presetLines` in `packages/core/src/orchestrator/prompt.ts`).
`presetInputOf` maps `promptPrefix` to `instructions`, so an unpinned step
keeps its brief too.
A decision may carry `change` (`added`, `skipped`, `reordered`, with a reason)
and a step its `presetStep` number.

`planChangeVerdictOf` decides:

- **Adapt** applies the change and records it in `rules.planChanges`. The
  agent id tags the checklist row; the reason becomes the step's Why.
- **Follow** stores it as `rules.pendingChange` with the stop kind
  `preset-change`, and `PresetChangeAsk` offers to take it, keep the preset, or
  switch to adapt.

`resolvePresetChange` answers the ask:

1. It queues a hint, skipped when the same hint is still queued, so a retry
   adds none.
2. It writes `approvedChange`, applied once by the next matching decision, and
   clears the stop in one statement (`updateWorkflowRunRules` with
   `shouldClearStop`).
3. It asks again.

A failed write leaves the question, its pending change and the stop as they
were, so the same answer can be retried. An answer to a question another window
already answered does nothing.

A change on a pinned step is never applied, under either closeness. A decision
that runs a pinned step takes its name, role and instruction from the preset
(`pinnedStepOf`) and its routing from the pinned lock (`stepLock`), so it runs
on what the preset pinned and keeps that lock.

## Step sequencing

The `parallel_agents` setting (**Parallel agents** under **Advanced** on Every
run) decides whether a scout step can split into several agents.

The orchestrator prompt carries **WHEN TO ADD A ROLE**, the table Auto also
reads (`packages/core/src/roleNeeds.ts`, driver `orchestrator`, only roles the
orchestrator may pick, so no rewriter, scribe or CI fixer). Discovery before a
decision is skipped when the goal already names the files to change. The
default is the fewest steps that finish the goal.

Every operator facing string in `ORCHESTRATOR_SYSTEM_PROMPT` (a reason, a
run-summary entry) names a thread, decision or commit by what the operator can
find in the app, never by a label a step invented.
