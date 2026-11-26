# The Runs list

> **Read this when** you change the Runs page of a session: its rows, its
> columns, its grouping by state or branch, how a run is started or restarted
> from it, or the run kind chip. **Not for** the page a row opens
> ([run-pages.md](run-pages.md)) or the Branch page itself
> ([../navigation/branch-page.md](../navigation/branch-page.md)).

The Runs page (`WorkflowsPane`) lists every run of the session on one
`ListGrid` (`RunsGrid`, columns in `runsGridColumns.ts`). There is one row per
request from `sessionRunsOf`: preset runs, orchestrated runs, Auto
conversations and the agents you started by hand, newest first. Archived runs
are dropped here; the timeline keeps them and the run page restores them.

## Rows

Every row has the same columns: state dot, shape glyph (Workflow, Lead or
Agent), title, origin, model and effort (agent and Auto rows only), state word,
progress (`runStepCountOf`), cost and age. As the page narrows, cost, step and
age leave before the title is cut, then the model and the origin (`yieldsTo`).

- A row is the button. The title and the chips are siblings of it
  (`ListGridRow` `overlays`), so a row never nests a button.
- **Rename** edits the title in place (`useInlineRename`); leaving the box on
  the same text writes nothing.
- The menu is the run's own (the `runRow` kind), never the session's. An
  agent or Auto row also opens the agent's right click menu.
- **Stop all** and **Continue all** sit in one row at the top.

### Words and verbs

Words say state and verbs are verbs. The row shows the real verb its page
offers (`SessionRun.verb`): **Continue** on anything you stopped, **Start** on
the next step of a preset or a queued manual run, and **Connect** when the
provider is signed out (`useAgentStoppedCopy`). One press guard per run covers
every copy of the row (`useRunVerbPress`).

The state word and dot come from `runRowFactsOf`, which reads `runStateOf`.
That is the one function that holds the word, the page word, the tone, the
primary kind and whether the run needs you, for every way a run stops. The run
tail and the glance read the same table (`runStateOfPrimary`), so a halted step
is **Needs you** on the run page and **Not finished** or **Failed** in the
list, from one place.

## Which branches a row names

`workBranchesOf` (`features/session`) names a row's work from the run's agents
(`Agent.mountId`), the mount a step inherits from the step before
(`inheritedMountIdOf`, shared with `selectRunStepMountId`), and the Auto tree
(`placedAgentsOf`: the Lead takes the tree's `primaryMountId`, a child its
delegation target; the Overview board reads it too). In a session with one
mount on a branch, an agent that recorded none files there (`soleMountIdOf`),
so older rows need no migration. New rows record it (`soleTurnMountIdOf` in
`startRoutedRun`, `createAutoChild`). A read only agent counts.

A detached mount or a removed worktree moves its branch to
`SessionRun.goneBranches`, so the run keeps its group.
`SessionRun.branches` carries the attached result, which the row chips read.
The groups, the count behind the switch and the **Also on** chip read both
lists (`runBranchMembershipOf`), so a removed branch keeps its group even when
the run also works on an attached one.

## Grouping

Under two branches the page groups **By state** (`runGroupsOf`): **Needs
you**, **Running**, **Idle** and **Finished** (the first 30, then **Show
all**). With two or more branches a switch offers **By branch** (the default)
or **By state**. The choice is remembered per session across reloads
(`storedGroupBy` under `goodboy:session-grouping:v1:<sessionId>`, dropped with
the session). `selectGroupBy` serves Questions and Artifacts too.

**By branch** (`branchGroupsOf`) draws one group per branch, one per pull
request series (`store/slices/pr-series`), and **No branch**.

- `branchGroupOrderOf` orders them: what needs you, then what runs, then open
  branches by latest activity.
- A group whose pull requests are all merged or closed, or whose branch is
  gone, with no live run, folds under one **Finished** row
  (`FinishedBranches`).
- Inside a group live runs come first; finished runs fold into **N finished**.
- A run on several branches stands in each group, keyed by group and run, with
  an **Also on** chip that reveals it in its next group.

### The Branch page Runs tab

The Branch page draws the same group on its **Runs** tab (`RunsByBranch`).
Archived runs fold apart and come last (`branchGroupRunsOf`), and the tab
counts what the group header counts (`branchGroupShownCountOf`).

- **All runs** lands on Runs with that group open, or reveals its runs under By
  state (`openBranchWork`, which never calls `setGroupBy`). `useRunsFolds`
  unfolds what hides the row before it scrolls and focuses it.
- Back returns to the tab and the row you left (`Focus.runGroup` on the history
  entry). **Open branch** on a group lands on that tab (`openBranchWorkTab`).

### Questions and artifacts by branch

Questions and Artifacts group by the same function (`branchKeyedGroupsOf` in
`branchGroupsOf.ts`), switch (`useGroupBy`, `GroupBySwitch`) and address
(`Focus.runGroup`, read by `useGroupArrival`). Under By state the Artifacts
list reads that address too and focuses the first artifact of the branch,
leaving the switch alone.

- A question finds its branches through its asker and the asker's
  descendants, else its run (`questionBranchesOf`). `questionBranchGroupsOf`
  draws the one question model in every group, so a change moves everywhere.
- An artifact finds its branches from `ArtifactProvenance.mountIds`
  (`useArtifactMountIds`), else the agent, else the run
  (`artifactBranchesOf`). `groupArtifactRowsByBranch` runs after
  `filterArtifactRows`, keeps the trash apart and leaves the state groups
  untouched.
- A replicated row has one key per group (`artifactBranchRowKeyOf`,
  `questionBranchRowKeyOf`). The open question is marked only in its first
  group.
- The Runs tab draws the question and artifact groups of the branch the same
  way. Its **All questions** and **All artifacts** go through
  `openBranchWork`, and Back from Questions or Artifacts returns to Work
  (`parentPlace`).
- The artifacts section of the Runs tab is registered by the artifacts feature
  (`branchWorkArtifactsRegistration`), so no cross feature import grows.

## Starting a run

The page opens on the list. **New** in the head and the `session.startRun`
verb (⌘K, the sidebar row) open the field (`StartRun`, see
[Start a run](../features/start.md#start-a-run)) above the list through
`startRunEventName`; **Esc** closes it. A session with no run shows the field
alone.

`startRoutedRun` (`features/session/startRun/`) goes one of two ways:

- **Start a run** always routes to the `lead` shape (`runRouteOf`). One agent
  goes to `spawnAgent`: the Lead or, for a role named with `@`, that role
  (`kindOverride`).
- The `plan` shape is reached only when `changeRunRoute` restarts an older run
  as a plan (`olderPlanRouteOf`). It creates an `origin: 'orchestrated'`
  workflow with no steps and attaches it with `executionMode: 'dynamic'`
  ([orchestrator.md](orchestrator.md#plan-from-a-preset)).

The route (`RunRoute`) rides in the run's rules snapshot as `rules.route`,
parsed by `parseWorkflowRules`. One agent keeps its route in the settings key
`runs.routes.<sessionId>`, written compare and swap (`writeRunRoute`), so two
windows starting at once both keep theirs. The route also keeps the ask, so a
second run can start from it.

The router never adopts a workflow. A typed `~name` or the Workflow pill picks
one; `suggestedWorkflowOf` only names the best match on the pill
(`StartWorkflowPill`). The `runs.defaultShape.*` keys are never read
([../versioning.md](../versioning.md#retired-state)).

### The run kind chip

`RunKindChip` (`features/session/components/RunRoute/`) shows the stored route
as the first chip of the settings line and on an agent's page
(`runKindOfRoute`). Its popover holds the why, the count of
`rules.planChanges`, the closeness and the other kinds (`runKindChoicesOf`). A
pick calls `changeRunRoute`.

The popover follows the run (`runKindPhaseOf`): read only while a step runs or
the orchestrator decides, **Restart as** once the run stopped, failed or
blocked, **Start a new run as** once it finished.

- Follow or Adapt, and a new preset before the first step, only rewrite
  `rules.route` and the run's `processText`.
- A change after work started refuses while a step is going, else calls
  `startRoutedRun` with the findings (`runFindingsOf`).
- On a stopped run the first run is then closed (`closeWorkflowRun`), so two
  runs never edit one branch. On a finished run, or an agent that finished,
  nothing is written to the first (`route.changedTo` is only parsed, for older
  runs).

### Writing a run's rules

Every rules write (route, plan changes, the preset answer, autonomy) goes
through `updateWorkflowRunRules`. It keeps one queue per run in this window and
a compare and swap on the stored `rules_snapshot` text
(`replaceWorkflowRunRulesIfUnchanged`). When another window saved first, it
re-reads and re-applies the patch, so no write drops another.

## Opening a row

A row opens [its run page](run-pages.md); the session rail stays on the
session and the run's agents are in the Agents column. A saved `orchestrated` lens opens
Runs (`foldedLensOf`). Esc returns to the list (`leaveRunLevel`), and so does
going up (`upTo`).
