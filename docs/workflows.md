# Workflows

> **Read this when** you want to know how workflows, the orchestrator and
> hands-free runs work, or you are changing the workflow tables, the code that
> moves a run to its next step, or the summarizer that runs after each step.
> **Not for** the workflow header and breadcrumbs ([navigation.md](navigation.md)).

A workflow splits a task into steps and runs each step as its own agent. This
page covers how you pick or build one, what the orchestrator does and how a
run moves from step to step. The code details come at the end.

Each object in Goodboy is explained in [concepts.md](concepts.md). The
header and breadcrumbs are covered in [navigation.md](navigation.md).

## What a workflow is

A workflow is a list of steps you can use again and again, for example scout,
plan, implement, test. Each step starts a new agent with a short brief. When
that agent is done, it hands a summary to the next one.

- A workflow can have a goal, and you can change it for each run
- Adding a workflow to a session starts a **run**
- The same workflow can run as many times as you like in one session, and each run is separate
- A session does not need a workflow. You can always add free agents next to a run

## Picking or building one

Open the workflow builder in a session. The plan draws with the same nodes,
lane and meta as the run. A recipe reads top down and a run reads up from NOW,
so the builder lists step 1 first and the workflow detail grows upward from
it. From the top:

- **Name**: a large inline field that wraps a long name instead of cutting
  it, and never takes a line break. It stays empty and shows a name as its
  placeholder. Once you leave the goal, Goodboy asks the naming model for a
  title from the goal and shows it there; **Tab** keeps it. The suggestion is
  never typed into the field for you. An empty field starts with the
  suggestion, or else the planner title, the preset name, "Custom workflow" or
  "Orchestrated workflow", so the name never blocks the start. If you rename a
  preset, you get a new workflow of your own and the shared preset keeps its
  name.
- **Goal**: what the run should do. **Add files**, **Use session goal**,
  **Undo** and **Polish** sit inside the field.
- **Mode**, with one line under it that says what the mode does, and the
  mode's own control on the right of the same row.
- **Plan**: the steps as a tree that reads top down, step 1 first and **Add step** last.
- **Launch bar**: when it starts, when to ask (**Ask before each step** or
  **Run on its own**), the spend cap or **Save as preset**, and **Start
  workflow**. The reason Start is off shows under it.

The three modes:

1. **Orchestrated**: give a goal and let the orchestrator choose each step as the work goes. The plan shows the orchestrator with its model first, then **Add guidance for the orchestrator** and three example steps under it that grow in once when the tab opens, top to bottom. They are marked as an example and carry no model, because the real steps are picked one at a time. The guidance link opens **Guidance (optional)**: what the orchestrator should respect or avoid, and when to stop. An emptied field folds back. **Can use**, next to the tabs, sets the providers this run may put agents on. It starts on every connected provider and keeps at least one. The goal alone is enough to start.
2. **Custom**: write the steps yourself, or open **Draft with planner**, describe what you want and Goodboy drafts the steps for you to edit.
3. **Preset**: pick a ready workflow from the **Preset** picker. Goodboy comes with three: **Refactor** (scout, plan, implement, test), **Plan and ship** (scout, plan, implement, review) and **Fix a bug** (investigate, implement, test). The last two are built from the built-in steps. A preset is a source: editing a step marks it, the name shows "Edited from" the preset, and switching to **Custom** keeps the steps.

Click a step to edit it in place: title, role, instruction and expected
output on the left, the model on the right. Instruction and expected output
are document fields (markdown with **Write** and **Preview**, Cmd+Enter
closes the editor), each with **Polish** and, after a polish, **Undo
polish**. The model block has two choices: **Follow role** (the default,
which says what Auto picks for the role from the providers you can use now)
or **Pin a model** (providers as named chips with their state, then model and
effort), and **Reply verbosity** under both. A pinned step carries a dot on
its row, like an edited one. The footer has one primary, **Done**, and a ⋯
menu with **Duplicate**, **Save as step**, **Move up**, **Move down** and
**Delete step**. Delete acts at once and the toast offers **Undo**. Escape
closes the editor too. The grip on the row drags a step, and the arrow keys on
the grip move it: up runs it earlier, down runs it later. A step added to a
running run opens the same editor, with **Add step** as its primary.

Once the workspace has measured 10 finished steps, every step row shows how
long steps like it usually take and what they usually cost, as a range
("12-20m", "$0.90-1.60"), and the name row carries the plan's total
("≈ 35-55m · $2.10-3.40"). A range with `~` leans on a broader history than
this exact model and effort, a dash means there is not enough history for that
step, and the tooltip always names the basis. When no step in the plan has an
estimate yet, the rows show no time or cost columns at all. When the run asks before each step the total
adds "+ your reviews", because your time between steps is not estimated. An
orchestrated run shows a total only once the workspace has 5 finished
orchestrated runs. The open editor repeats the step's estimate in its footer.
Steps drafted with the planner carry the planner's size (small, medium or
large), and the range narrows to the faster or slower half of past runs; the
tooltip and the editor footer say so. The planner never gives minutes, and the
agents never see the size.
Every estimate is machine time only ([turns.md](turns.md#measured-time-and-estimates)).

The builder opens on the mode of the last workflow you started in that
workspace, and on **Orchestrated** the first time. Only starting a workflow
changes it, so looking at another tab does not. A remembered **Preset** falls
back to **Orchestrated** once the workspace has no presets left.

Each run also gets a title of its own, at most six words, written from the run
goal by the `agent_naming` task model when the run starts. The activity feed,
the workflow detail, the breadcrumb and the **Starts** picker show that title, so
two runs of the same preset read apart. Until the title arrives, or when the
run has no goal, they show the workflow name. An orchestrated run keeps the
name generated for its workflow and gets no second title. You rename a run
only from the header of its workflow detail. That name stays with the run, a
later generated title never replaces it, and the preset keeps its own name.

A workflow you are still building stays there when you switch sessions. It
goes away once you create it or discard it. **Workflow Studio** is where you
keep presets. Its home is one list: **New workflow**, **Import**, and a menu to
restore the built-in workflows. **Import** lists the custom presets of every
other workspace, grouped by workspace, and copies all the checked ones at once.
A copy whose name is taken here gets its workspace name added, for example
`Settlement replay (Northwind)`. Built-in rows say **Built in**, and **Edited** once you change them.
**Restore built-in workflows** asks first and names only the built-ins you
edited or deleted in this workspace. It puts back their name and steps, drops
the steps you added to them, and leaves your own workflows alone. With nothing
changed the menu item is off and says so. A built-in whose name one of your
own workflows now holds is left out. When an update brings a new built-in,
every workspace gets it at the next launch, unless one of your workflows
already has that name. A built-in you never had is not counted as deleted.
A row opens the editor: the builder without its launch bar, with the same step
tree, a breadcrumb back to the list, and autosave. **Draft steps** asks an
agent to write the steps from the goal. With steps already there it reads
**Redraft steps**, asks first, and offers an undo once the new steps land.

**Add step**, in the Studio and in the builder, opens a menu: a search field,
**Blank step**, then the built-in steps and the steps saved in this workspace.
The pick lands at the end of the tree, under the last step, with its editor open. **Save as step** in
a step's editor saves it to the workspace. The **Saved steps** tab next to
**Workflows** is where you manage them. Built-in steps, one per role that works
in the repo, cannot be edited or removed: **Save a copy** makes a workspace copy
that says what it is based on. A saved step saves once, when you press **Done**
or move to another row, never on every field.

### When a run starts

The **Starts** chip in the launch bar picks one:

- **Now**, as soon as you start it. This is the default
- **Manually**, when you press start
- **After** another run that is still going, and then it carries on by itself

When to ask comes from the workspace rules, **Ask before each step** until you
change them: the run waits for your go after each step so you can review it.
**Ask after the plan** runs on its own but holds once when the plan is written,
until you press **Approve plan**. **Run on its own** starts each next step by
itself. The choice is stored as the run's autorun flag plus the run's copy of
the rules, and can change later from the run's ⋯ menu.

## Workflow rules

Rules are the workspace defaults every new run starts from. They live only in the
**Run defaults** tab of the Workflows studio; the workspace settings have no page for
them. The all-pages Restore defaults and Copy from in the workspace settings menu
still carry them and list them as Workflow rules in the preview.

The tab is titled **Run defaults**: three controls and one text field, in this
order, each with one line of copy at most.

- **When to ask**: Ask before each step, Ask after the plan or Run on its own. The
  hints are the ones the builder shows (`RUN_AUTONOMY_OPTIONS`)
- **Spend cap**: a switch, the amount per run and what happens at the limit, pause
  or warn
- **Providers**: one switch, **Use providers with room left**, and one sentence
  that says where the next step goes. It lists no provider; the policy is in
  Models, one **Open Models** button away. With no provider that reports its
  limits (Claude or Codex) turned on, the switch is off and says why
- **Guidance**: text every run starts with, with its own **Polish**

### Guidance

The rules carry a markdown text every new run starts with. The builder's
guidance field opens filled with it in all three modes, with **From your
rules**, and once you edit it **Edited for this run**, **Reset** and **Save as
default**. Where it goes:

- an orchestrated run sends it to the orchestrator, merged once with the
  workflow's own process text (`orchestratorProcessText`)
- a custom or preset run adds it to the brief of the roles in the run's copy of
  the rules, Implementer and Docs by default (`standingGuidanceSection`); the
  tester or the reviewer get it only when you pick them under **Goes to the
  planning agent and to**, behind **Edit**
- an empty text adds nothing

On the run page, each step whose role got the guidance (`guidanceSentTo`, the
same check the brief uses) shows a small **Guidance** tag; its tooltip quotes
the first line. An orchestrated run tags no step.

**Polish** on guidance uses `polishWorkflowGuidance` in `packages/core`, its own
prompt next to the goal polish: one rule per line as a list, the language of the
input, every rule kept and none added. The builder has no "Also sent to" line:
the guidance box says only where it goes, and the Run defaults tab keeps the
line about the profile field. The names there come from `PROFILE_ACCESS`: the
roles that never read the working rules.

### Spread by what I have left

`providerHeadroom` in `packages/core` reads the limit snapshots the app already
has, with the thresholds of the limit chips: _ok_, _tight_ (80% used or more),
_out_, _unknown_. A snapshot older than 30 minutes, twice the re-read time, is
_unknown_; a workflow decision that finds one asks for one re-read
(`probeProviderLimits`) and then decides, so a decision reads the headroom once
and no new poll exists. Limits that arrive with a turn count as fresh. A
provider marked **Keep using after the limit** counts as tight, not out.

With the rule on (the run's copy, `spreadByHeadroom`):

- the orchestrator menu drops the _out_ providers and puts the _tight_ ones last
  (`workflowAvailabilitySnapshot` with `headroom`)
- static steps and fan-out children pick through Auto with the headroom, and the
  role's Auto wins over the session provider (`resolveStepRouting`,
  `resolveWorkflowChildRouting`); a provider pinned on the step still wins
- if dropping the _out_ providers empties the menu, the menu of today comes back

With the rule off nothing changes. Workspaces that existed before 0.16.0 start
with it off (m217); new workspaces start with it on. The Run defaults tab shows the
switch and one sentence: with it off, "New steps follow the order set in
Models."; with it on, where the next step goes and, when a provider is passed,
how full it is (`nextStepPick`, `spreadSentence`).

The builder opens filled from the rules and shows them in one **From your
rules** line with **Edit**. A launch control that leaves the rules shows a dot
whose tooltip names the rule, and its menu offers **Reset**. A run copies the
rules when it is attached (`session_workflows.rules_snapshot`), so changing them
later never touches a run that already started, even after a restart. The
workspace rules are one JSON column, `workspaces.workflow_rules`; `null` means
the defaults. Runs attached from elsewhere (palette, chat, suggestions) copy the
rules with the autonomy their caller asked for.

## What a step carries

Each step is one agent with its own brief and its own model.

- **Name** and **role**: scout, investigator, planner, implementer, reviewer, tester, resolver, docs, report, wireframe or custom
- **Prompt**: the instruction the agent starts from
- **Expected output**: what this step promised the next one. It goes at the top of the handoff
- **Provider**, **model** and **effort**: for example scout on a cheap model, plan on a strong one

If you leave the model on auto, Goodboy picks one based on the role, the model
tier and the cost. A model you set on the step wins over that choice.

Steps run one after another. Parallel work happens inside a step, where a
scout step can split into several agents.

## The orchestrator

The orchestrator is an agent that plans the run for you. In an
**Orchestrated** run there is no fixed list of steps. After each step
finishes, the orchestrator reads the goal, your guidance when you gave any,
and what the steps so far produced. Then it decides one thing: the next step, done, or
blocked.

- It never does the work itself. It has no tools and cannot open your repository
- A run usually starts with discovery, then a plan, then the work
- It picks the provider, model and effort for each step, and gives a short reason
- It keeps a running recap of what is done and what is left
- It ends the run when the goal is met, or stops and asks you when a decision needs you

You choose the model the orchestrator runs on in the launch form, and the
providers it may pick from with **Can use**.

### The orchestrator strip

In the workflow detail, an orchestrated run shows the orchestrator as one row
(`OrchestratorStrip`): what it is doing ("Choosing the next step", "Waiting on
step 3 · Implement"), how long the running step has taken, the model it runs
on, a menu and, while a step is in flight, **Stop step**. The row says its state
with a `ToneBar` inside its padding, never with an outer edge or a filled
background. **Pause**, **Resume** and **Stop run** are not in the row: they are
one cluster in the header of [the run page](#the-run-page). Besides **Stop step**
the row shows at most one action: **Decide next step** only when the run asks
before each step, **Continue the run** after you stopped it or once it is
complete, **Retry** after a failed decision, **Review plan** while the run
waits for its plan, **Answer** when the planner asked a question, or the spend
cap on a budget pause. **Stop step** asks first, then cancels the step in
flight, marks it skipped and holds the run (`stopWorkflowRunNow`); **Continue
the run** takes it from there.

The row has phases of its own for a run held for its plan. A held run reads
"Plan ready · waiting for you" (`plan-approval`). While the planner revises the
plan after your comments it reads "The planner is revising the plan"
(`plan-revising`, pulsing, no action). When the planner asked you something it
reads "The planner asked: ..." (`plan-question`) with **Answer**, which opens the
planner at its question. Both phases are checked before the stop presentation,
and `resolveOrchestratorState` takes them as a `plan` signal the strip reads
from the plan the run waits on, so a pause or a decision in flight still speaks
first.

A failed step and an open question are left to the Next action strip, so the
row only says the run is paused, on a neutral line: the strip above carries the
tone. When the pane is too narrow for the sentence and the controls on one
line, the controls wrap to a second line on the right instead of cutting the
sentence. When to ask (**Ask before each step** or **Run on its own**) and
**Model per step** (the model each step runs on, and why) sit in the menu. A
model picked for the orchestrator turns its chip amber, and the picker itself
says "Overriding default" with **reset**; the row draws no separate cross
beside the chip (`hasTriggerReset={false}`). The hint field is not in the row:
it docks at the bottom of the page.

### Why each step

Under the goal, **Why each step** gives the orchestrator's reason for each step
it chose, newest first (`WorkflowDecisions`). Each line opens with the same
node the run tree draws for that step, with the same number or check. Hovering
a line lights its row in the tree, and hovering or selecting a step row lights
its line. When the run has ended, its closing reason sits on top. The five
newest lines show, and the rest sit behind a count. The tree rows carry no
reasons of their own. An agent's own step reason is the why of the handoff
block at the top of its transcript, which is also where the step's expected
output sits, as Done when. The Brief keeps only the state: one line naming who
sent the agent (it opens that block), then Now, questions, the outcome, what
it produced and the meta line.

### Hints

A hint is a note you send the orchestrator while the run is going. Every hint
stays with the orchestrator for the rest of the run. It is marked as new, or
with the step where the orchestrator first read it.

- **Queue** waits until the next decision
- **Read now** restarts a decision that is in progress. If a step is running, it stops that step, keeps what it wrote, and decides again
- The help sits in each button's tooltip, not in a sentence under the field. Read now says what it does in the state the run is in
- The field is a message box: Enter queues, Shift+Enter adds a line, ⌘Enter reads now. **Preview** shows it as markdown, and the hint log reads it as markdown too
- Paste, drop or attach images. They are saved as files of the run, so the next agent gets them, and the hint keeps their ids
- The field stays open while the orchestrator decides, and it empties as soon as you send. If the hint can't be saved, your text and your images come back
- Queued hints fold into one row, "2 queued", with a chevron that opens them in place. A hint a decision is reading shows by itself, and each says where it stands: **Waits for the next decision**, **Reading now**, or **Read at step N**. Read hints sit behind a count
- You can remove a hint, except while a decision is reading it

Asking for a certain provider or model on a step is a hint too.

### Spend cap

Each run can have a spend cap in dollars. You set it on the run, in the
orchestrator strip or in the creation form. You also choose what happens when
the run reaches it: **Pause workflows** or **Warn only**, the same editor
and words as the session's spend cap. The cap starts at unlimited. The
orchestrator decides how many steps to plan based on the goal.

A session has its own spend cap, set from the spend chip in its header. With
**Pause workflows** (the default) every workflow of the session stops at the
cap and its strip says `Paused at the $10.00 spend cap for this session.`
with **Raise spend cap**, which opens the chip on the editor. With **Warn only**
nothing stops: one notification says the session passed its cap. Single
agents are never stopped by it.

## The run page

The run page (`WorkflowsPane` over `WorkflowRow`) reads top to bottom: a
pinned header, the strips, the steps in their own scroller, and a composer
docked under them.

- **Header.** The title, the status, the facts (steps, agents, cost, spend cap, when to ask, time left) and one cluster of actions: **Review plan** while the run waits for its plan, **Pause** (or **Resume**) and **Stop run** as one pair (`RunControls`), and an overflow menu. The chevron is named **Show run summary**, in its accessible name and its tooltip. It folds the run into its card in the Runs list; a run opened from a list that is collapsed offers **Expand ... run** instead
- **Scroll edge.** The steps scroll under the pinned block. `ScrollFade` takes `edge="line"`: its root draws a 1px `border` line at its own top edge while `scrollTop` is above 0, shown through `data-scrolled` on the root, set imperatively inside `applyFade`, never through React state, and faded in over 120ms under `motion-safe`. With the line the top mask fade is off and the bottom fade stays. `PaneShell` with `scroll="body"` and the steps scroller of the run both use it. The default `edge="fade"` is unchanged. The scroller opens at 0; the live-row reveal of the run tree uses `scrollIntoView({ block: 'nearest' })`, so it only moves the scroller when the live row is below the visible area
- **Composer.** A dynamic run's hint field docks at the bottom of the page as the `dock` of the `PaneShell`, as in Chat, below the scroller and never inside it (`OrchestratorDock`). Steps and cost come first. Queued hints fold into one "2 queued" row above the steps, and the help sentence moved into the tooltips of **Queue** and **Read now**
- **Two Stops, two names.** **Stop run** is in the header, next to Pause: it ends the run and asks first ("Steps that have not run are skipped..."). **Stop step** is in the strip while a step is in flight: it cancels that step, holds the run and leaves **Continue the run** on offer. A static run has no strip, so it has the one Stop run. Never two buttons with one name
- **Plan entry points.** While the run is held for its plan, the header's primary is **Review plan**: it opens the drawer for the plan the run waits on with `openPlanDrawer`, over the page. The plan comes from `runPlanOf` (the newest active plan the run's planner wrote, `useRunPlan`). **Approve plan** moves into the overflow menu: it is one item of the run controls menu on a static run, and of a **Plan actions** menu on a dynamic one, and it is off with the reason "The planner is revising this plan" while the planner revises. A run with no plan to open keeps **Approve plan** as its primary. The static run's **Plan ready** status becomes a secondary **Review plan** button when the header holds the primary. The orchestrator strip has the same **Review plan**, plus the `plan-revising` and `plan-question` phases ([The orchestrator strip](#the-orchestrator-strip))
- **Approve from the overflow** (`useApproveRunPlan`) calls `approveWorkflowRunPlan` and reads its answer: `approved` marks the run as a start of yours (`markUserStart`) and raises one `useFollowToast` toast, **Plan approved**, saying "The run goes on" or "Implement started" with the step's name, with the action **Follow the run** left out because the run page is on screen. `noop` raises nothing and `failed` goes to the log as "Couldn't approve the plan"
- **Tone and empty states.** The strips draw their tone as a `ToneBar` inside their padding. A run with no agents says "No agents yet" and "The run starts its first step here." (`EmptyState size="section"`)

## How a run advances

When a step finishes, Goodboy turns its chat into a short summary called a
handoff. The next step reads that handoff instead of the whole previous chat.
Then the run either moves on or waits for you.

A run waits when:

- An agent asked a question you have not answered yet
- A step failed or is blocked
- The summarizer is still writing the handoff
- An agent is still running

When a run waits for more than one reason, its row in the activity feed says
one thing only. A failed or blocked step comes first, then an open question, then a step
waiting for your click, then the spend cap. A summarizer writing the handoff
and an agent still running are Goodboy at work, so the row shows them as
running, never as waiting on you. The rule lives in `resolveRunRowState`.

An open question belongs to the agent that asked it, not to the run. While
the asking agent's row or its question row is in the feed, the run row stays
quiet (`stepAsking`: a neutral "Waiting on a step" node, no sentence, no
Answer). The run row takes the question only when the filter hides both, and
its Answer then opens the asking agent at that question.

A failed, blocked or stopped step works the same way. The run row names it
("Step 4 failed", "Step 4 stopped by you") and offers nothing; the step's own
row carries the one **Restart the step** or **Continue**. The run row keeps the
Restart only when the run is held on a failed step that no row of the run
shows.

The workflow detail draws the run as a run tree (`RunTree`), the same stream
the activity feed builds, limited to one run (`buildRunTreeStream`). Time runs
the same way: the first step sits on top, steps follow in the order they ran,
and queued steps come last, dashed. There is no NOW: the story ends on the last
step, as the agent tree does. The run lane starts on the first step, so the
tree has no session spine and no time column. Sub-agents sit one column right,
under their step, on the run's colour, and their label starts one column right
of their step's label too (two columns for a sub-agent of a sub-agent), so the
nesting reads in the text and not only in the lane. A step keeps its place
whatever its sub-agents do. The view scrolls to the row that is
running or waiting on you when it opens. The run header and the Next action
strip stay pinned while the tree scrolls. A long run name wraps to a second
line in the header before it truncates, and so does a long agent name in the
agent header.

The run tree shows which agent is waiting on you. The agent that asked, even a
sub-agent under a step, gets the question mark on its node and an **Answer**
action on its row, which opens the questions view on that question. An agent
that answers a question for a step never shows it, in the tree or in the
activity feed, because the question belongs to that step. Every row ends with
the same meta as the activity feed: the model, the effort and what the row has
spent, with a dotted model name when routing picked another one than the plan.
The action column exists only while a row in the tree has an action, so a tree
with nothing to do gives that width to the titles. The action is **Answer**, or
on the step that produced a plan **Review plan** while the run waits on that
plan and **Open plan** once it does not. Both open the plan in the plan
drawer, over the run, and a row that asks something keeps its **Answer** alone.
In a narrow pane the kind chip narrows and the effort column hides, so the
title keeps its room. Clicking a row opens that agent.

A set of sub-agents, the children of one agent, folds into one row under its
parent when every one of them is settled and none has an open question,
whatever the state of the parent. The row says what the set holds, for example
`3 scouts · done · 2m · $0.09`: the role when all of them share one,
`subagents` otherwise, the work time of the set (time spent waiting on you is
not counted) and what it spent. A set with a running, queued, waiting, failed
or asking agent stays open and has no fold row, and a new or restarted
sub-agent opens a folded set again. The fold follows the activity feed: a set
already settled when the page opens starts folded, a set you watched settle
stays open until you fold it, and leaving the page forgets it. Click the row,
or press Enter or Right on it, to open the set downward under the row, whose
chevron then points up; click, Enter or Left folds it. Inside an open set the
sub-agents run oldest first, top to bottom, and a set inside a set folds on its
own. `foldSettledSets` does this over the items of the run tree, so the
activity feed and its stream builder are untouched.

An agent's Brief draws its sub-agents with the same tree, under **Subagents**
(`SubagentTree`, from `buildAgentTreeStream`). The agent sits on top
with its ordinal in the run, for example `3`, and its sub-agents follow under
it one column right, `3.1`, `3.2`, `3.3`, each with its own model, effort and
spend. Sub-agents of an agent outside a workflow are numbered from `1`. The
header counts them in words ("2 of 3 done"). An implementer split into parts
shows no Outcome, because the tree already says what each part did. A planner
shows no sub-agents, and delegates and follow-ups keep their own sections. This
tree never folds a set and has no plan action.

In the activity feed, an agent or step row leads with its role as a glyph and
ends with the model that ran, then its duration with what it has spent under
it. The model is on the row, in a model cell of about 150px: the provider glyph
and the model, and when a step moved to another model (a fallback, a retry, a
routing change) every model in the order it ran ("Kimi K3 → Sonnet 5.5", "3
models" past two). The effort, why a model took over, planned against picked,
tokens and the start and finish times are in the card that opens when the
pointer rests on the role glyph or on the model cell, and in the Brief. A step
that has not started shows its planned model and its meta in faint. In the run tree and
a Brief's Subagents, every row keeps the model: before a step starts, the meta
shows the routing it is planned to run on, in faint. Once it runs, the meta
shows what actually ran, and a dotted model name means routing picked something
other than the plan (the tooltip names both). The
effort works the same way: once a run has started, the column shows the effort
the CLI was started with, in the row tone, and a dotted effort means it left
the plan ("Planned High, ran Medium" in the tooltip). A run with no recorded
effort, like one from before turn spans existed or a CLI with no effort flag,
keeps the planned effort in faint and never shows a made-up value. The agent
header reads the same way. The
run row in the feed shows the models of its steps ("Sonnet 5.5 + 1" on two, "4 models" on more) and what
the whole run has spent; the step it has reached ("Step 4 of 7", or "Step 4"
for an orchestrated run, which has no total) is in the card of its glyph, with
the status tally and one line per model with its steps and cost.

The time column is measured machine time, never the wall clock between start
and end. A `~` always marks an estimate; how sure it is lives in the tooltip
with the sample count. A queued step shows its usual range ("~6-9m"). A
running row with enough history shows the time left ("~3-7m left", a range
until the low end of the band passes, then "~2m left") and its node fills an
arc toward the usual time; the elapsed time moves to the tooltip and the agent
header ("4m · ~3-7m left"). Past the top of the band the row shows the elapsed
time ("14m"), the arc stays full and the state reads "Longer than usual" in
faint, with no color. At twice the usual time the Brief's Now adds a line that
points at the transcript; nothing stops the agent. While the row waits on you
the arc freezes in amber and the time freezes too, never "left": the pause is
said once, by the row state and the node. A failed row drops the arc and reads
"4m", next to its "Failed" state. A finished row shows its active time ("8m
12s"), with no "Longer than usual" note: the row says it only while it runs. Without enough
history a running row shows only its elapsed time, the node keeps the moving
border, and the tooltip counts what is missing ("No estimate yet: 3 of 5
finished scout turns on 3.8 Flash"). The run row adds up finished steps and
the usual time of the steps left, and shows a total only when every step left
has an estimate. The workflow detail header adds what the run has left
("~9-16m left", or "usually 20-35m" before any step starts) only when every
step left has an estimate and none is past its band; an orchestrated run reads
it from past orchestrated runs. The workflow detail and a Brief's Subagents
use the same column.
How the numbers are measured is in [turns.md](turns.md#measured-time-and-estimates).

### Next action

When a run needs you, one **Next action** strip says what to do. It sits on
the workflow run row and at the top of the agent detail body, right under the
header that holds Brief and Transcript, so both tabs show the same strip and
the transcript does not repeat it at the bottom. Opening an agent from Activity, Workflow, the board or
a toast follows one rule (`agentOpenTab`): an agent with an open question, and a
resolver, open on Brief, where the question or the summary comes first; any other
agent opens on Transcript, pinned to the latest line. A resolver that is still
working shows its live line at the top of its Fix run. Orchestrated runs get the same strip, and the
orchestrator strip carries no answer or skip button of its own.

- A failed step: "Implement stopped before finishing." with the steps that wait on it. **Ask it to continue** asks the same agent to verify its work and finish, **Skip** skips it after an inline confirmation. The error the turn ended with sits behind **Show details**
- A blocked step: "Implement stopped without finishing and without asking you anything. Tell it what to do next." with the same **Ask it to continue** and **Skip**, on the warning rail instead of the danger one. Writing to the agent in its chat also resumes it
- A quiet step: "No output for 20 min" with the last event the turn sent ("Last event: read_file src/retry/backoff.ts") once a running step has said nothing for 15 minutes. **Ask it to continue** stops the silent turn and sends the agent a message to check where it stands and finish; **Skip** skips it. The clock is the shared `useNow` tick, no timer per agent, and it holds while a tool call or a permission request is still open, because a build or a test suite can print nothing for minutes (`quietSignal.ts`, `useQuietStep`). Goodboy never skips on its own
- A stopped step: no strip. The agent header already offers Continue, and a step you stopped is never an alarm. The orchestrator strip says "Step 2 stopped by you" in a neutral tone
- An open question that no row of the run tree shows, such as one the orchestrator holds or one a question delegate asked: "Answer for Implement asks: ...", or "An agent asks: ..." when no agent asked, with the step that waits on it, and **Answer**, which opens the agent that asked at its question, or the questions view when no agent asked. A question a run tree agent asked stays on that agent's row, which already carries the question mark and **Answer**, so the strip never repeats it. This shows in the workflow detail only, because the agent detail already shows its own questions
- The summarizer holding the run: "Writing the handoff from Plan." with nothing to click

In the agent detail, the strip shows only on the agent the failed step is
waiting on, or on one of its sub-agents. `resolveNextAction` picks the strip
from the advance state. It reads `resolveWorkflowAdvance` and never decides
on its own whether the run can move.

The workflow detail header says nothing about an open question while the run
tree is open, because the asking agent's row shows it. Collapsed, the header
keeps one quiet needs-you count in place of the status, and clicking it opens
the run again on the row that waits on you.

### Skipping a step

Every step that has not finished, live or stuck, has one verb: **Skip**, on
its row in the run tree and in the Next action strip. It asks inline first and
says what follows ("Its turn is cancelled and the step is marked Skipped. Its
changes stay in the worktree. The run moves on to Test."). Confirming cancels
only that step's turn, marks the step **skipped** (never failed) and, when the
run runs on its own and is not paused, starts the next step once. When the run
asks before each step, the next step waits for your go.

### Closing a workflow

**Stop run** ends a run that nobody else will end: an orchestrated run
between decisions, a run stuck on a failed step, a run you have seen enough
of. It sits in the header of the workflow detail, next to **Pause**, and in the
menu of the run row in the activity feed. Goodboy asks you to confirm first. Steps that have
not run are marked skipped, the step in flight stops and is marked skipped,
and a failed step stays failed, because it did fail. Everything already written
is kept.

A closed run reads **Closed by you**, never complete: its node is the neutral
check, its lane ends on its newest node with no dash to NOW, and it offers no
Next action and no autorun. A run chained to start after it switches to a
manual start, so closing never starts other work. The closure lands in the
activity feed as its own row ("Closed Add rate limiting by you"). Adding a step
opens the run again.

Stop run is offered once the run has started and until it ends. A queued
run has nothing to stop; archive it instead. **Archive run** and
**Delete** sit in the run menu next to it.

**Delete** removes the run and every agent it owns, for preset, custom and
orchestrated runs alike: its step agents, the agents the orchestrator spawned,
and their fan-out children at any depth. It is a bulk delete of those agents
with the single-agent method, so the result is the same as deleting each one
by hand: a running agent is stopped first (`stopAgentForDelete`), its
worktree writer and attachment files are released (`releaseAgentFiles`), its
store entries are cleared (`omitDeletedAgents`), and in the database its
messages, turn events, open questions and summary go and the row is
tombstoned (`agentPurgeStatements`, one transaction for the whole run). The
agents drop out of the session, the board and the per-agent cost rows at
once, and there is no undo. What they already spent stays in the session
total, as it does for a deleted agent. The launch cleanup of agents a run left
behind purges them the same way. Archive run is the verb that keeps the
run and its agents restorable.

### Hands-free runs

**Run on its own** makes a run hands-free. Each next step starts without you
clicking. You can turn it on for one run or for the whole session. A run
without its own setting follows the session.

- The session's autorun also covers agents running outside a workflow
- A workflow you add to a session with autorun on starts with autorun on
- **Pause** lets the step in flight finish its turn and starts nothing new: no next step, no orchestrator decision, no read-now hint, no step button, not even turning autorun back on. The pause survives a restart. **Resume** starts where the run left off, static or orchestrated, and never changes when to ask
- **Stop step**, in the orchestrator strip, cancels the step that is running and holds the run. Goodboy asks you to confirm first. The step is marked skipped and everything it already wrote is kept. **Stop run** in the header ends the run ([Closing a workflow](#closing-a-workflow))
- **Continue the run** starts a stopped run again. It turns autorun back on and asks for the next step

A hands-free run still stops and waits for you when:

- An agent has a question for you
- A step failed. You get one **workflow blocked** notification that names it
- The run's budget alert is showing and you have not dismissed it
- It is waiting for another run to finish

If a hands-free step stops without saying it is done, Goodboy nudges it once.
If it stops again, the step fails and waits for you.

## For contributors

Everything below is the code behind the sections above.

### Where it lives

- `packages/db/src/migrations/`: the workflow schema
- `packages/db/src/queries/workflow.ts`: `saveWorkflow` and `removeWorkflow` write workflows and steps for edits, and the seeder (`packages/core/src/workflows/seeder.ts`) writes the shipped presets through `upsertWorkflow` and `restoreSeededWorkflow` in the same file. Rust does not write them, except the backup import
- `packages/db/src/queries/agent-write.ts`: `insertAgent`, `insertAgentBatch`, `recordAgentStatus` (the one status writer) and the other writes of `agents`
- `apps/desktop/src-tauri/src/workflows.rs`: the reads of workflows and the step library (`step_def_upsert` writes `step_library`)
- `apps/desktop/src/features/workflows/advanceGate.ts`: `resolveWorkflowAdvance`, which decides if a run can move on
- `apps/desktop/src/store/slices/workflows/maybeAutoAdvanceWorkflow.ts`: moves a hands-free run to its next step
- `apps/desktop/src/store/slices/workflows/handsFree.ts`: `isHandsFree`, which checks the run first, then the session
- `apps/desktop/src/store/slices/workflows/preSpawnWorkflowAgents.ts`: creates the run's agents when a workflow is added
- `apps/desktop/src/store/slices/workflows/notifyWorkflowGateBlock.ts`: sends the blocked notification
- `apps/desktop/src/store/slices/workflows/orchestrateNextStep.ts`: asks the orchestrator for one decision
- `apps/desktop/src/features/workflows/runProviderPool.ts`: reads the provider pool of the run an agent belongs to
- `apps/desktop/src/features/workflows/components/WorkflowBuilderView/`: the builder. It draws the plan with the shared step tree
- `apps/desktop/src/features/workflows/components/StepTree/`: the step tree (`StepTree`, `StepRow`, `StepEditor`). It draws steps with `WorkNode` and `WorkMeta`, and `StepEditor` mounts `RoutingPicker` with `presentation="inline"`. Polish and the estimate note are optional, so a host without a session leaves them out
- `apps/desktop/src/features/workflows/components/WorkflowsPanel/`: the Studio. `useWorkflowEditor` owns the open workflow, autosave and Draft steps; `WorkflowStudio/WorkflowList` is the home and `WorkflowStudio/WorkflowEditor` the editor on the step tree. The Studio leaves the time and cost columns empty: a preset has no run to estimate from
- `apps/desktop/src/store/slices/workflows/suggestWorkflowTitle.ts`: the name suggestion from the goal. It only returns text; `generateWorkflowTitle` renames a saved orchestrated run that started on the fallback name
- `apps/desktop/src/store/slices/workflows/summarizeWorkflowAgentOutput.ts`: the summarizer that runs after each step
- `packages/core/src/summarizer/step-output.ts`: the rules every handoff follows
- `packages/core/src/orchestrator/prompt.ts`: `ORCHESTRATOR_SYSTEM_PROMPT`
- `packages/core/src/workflows/library.ts`: `WORKFLOW_LIBRARY`, the presets that come with the app
- `packages/core/src/workflows/builtinSteps.ts`: `BUILTIN_STEPS`, the built-in saved steps. They live in code, not in `step_library`
- `apps/desktop/src/features/workflows/savedSteps.ts`: one shape for built-in and workspace steps. `AddStepMenu` and `WorkflowStudio/SavedStepsList` read it through `useSavedSteps`
- `packages/core/src/roles.ts`: `ROLE_REGISTRY`, the roles a step can take

### `phaseTemplate*` means workflow

There is no phase template anymore, and no `phase_templates` table. That
table was removed in `packages/db/src/migrations/m014-rename-domain.ts`,
together with `phase_definitions`, `session_phase_runs` and
`parallel_phase_groups`.

Any `phase*` name still in the store, the workflow slices and `workflows.rs`
is an old name for a workflow. There is no second system to look for.

### The tables

The schema is in `packages/db/src/migrations/`. A few things it does not tell you:

- A run is keyed by `workflow_run_id`, not by workflow. That is how one workflow can be added to a session many times
- Every per-run flag lives on `session_workflows`. The agents of a run carry the same id
- A run's plan and open questions belong to the run, not the session. Two runs on one session never read each other's state. A question blocks a run when it carries that run's id, or, for old rows with no run id, that run's workflow id (`workflowRunHasOpenQuestions`). A question with neither blocks only the agent that asked it, never a run
- `is_preset = 0` marks a one-off run. It does not show up in the preset picker
- `step_library` holds only workspace steps. The rows with a `NULL` `workspace_id` are soft-deleted anchors (`m180`): they keep the `seed_*` ids that `steps.library_step_id` points at valid. `step_def_list` never returns them, and `step_def_upsert` and `step_def_delete` refuse them. A new built-in step needs an anchor row in a migration, or a workflow step that links to it fails the foreign key
- A built-in workflow has the id `wf_seed_<slug>_<workspace id>`, so a restore only reaches its own workspace. The slug stays when the name changes: `Refactor` keeps `refactor-example`, and `m188` renamed it from `Refactor (example)` only where the user had left that name. The Studio compares each seeded row with its `WORKFLOW_LIBRARY` entry (`restorableBuiltins`) and a restore goes through `restoreSeededWorkflow`, which also clears `deleted_at` and soft-deletes the steps the user added
- Every launch runs `seedMissingBuiltinWorkflows` after the migrations: it inserts a built-in only where its `wf_seed_*` id has no row at all and the name is free among the live presets. Deleting a built-in keeps its row with `deleted_at` set, which is how the Studio tells "deleted" (`listRemovedSeededWorkflowIds`) from "never had", and why a launch never brings a deleted one back

Adding a workflow creates every agent of the run at once, each one `pending`.
Each step's settings are worked out per agent. When a step sets nothing, the
role's recommended model fills in. So the shape of a run is fixed the moment
you add it. It is not worked out step by step.

Every screen that creates or edits a workflow saves it through the same
upsert command. A second way of saving could create a workflow the picker
cannot see.

### Advance states

`resolveWorkflowAdvance` is the only place that decides if a run can move on.
It returns exactly one state. The order it checks them in is part of the
contract.

| Order | Result                   | When                            |
| ----- | ------------------------ | ------------------------------- |
| 1     | `complete`               | every step is done              |
| 2     | `blocked` `questions`    | an open question exists         |
| 3     | `blocked` `summarizer`   | summarizer busy, not `auto_run` |
| 4     | `blocked` `failed-step`  | a step failed or is blocked     |
| 5     | `automatic`              | `auto_run` is on                |
| 6     | `blocked` `turn-running` | a turn or agent is running      |
| 7     | `ready`                  | the user can advance            |

The reason it returns is the one the user has to deal with first. A run with
both an open question and a failed step returns `questions`. If you change the
order, you change what every screen tells the user to do.

A blocked result always carries the failed step, whichever reason came first.
So screens that name the failed step keep naming it while a short-lived block
is showing.

Every screen reads this one resolver through a view that handles every case
of the union: `viewWorkflowAdvance` for the step rows and the advance button,
`resolveNextAction` for the Next action strip. No screen narrows the union on
its own. The one exception on
purpose is the chat button, because it shows nothing under `automatic`.

### Autorun logic

With `auto_run` on, the summarizer case and the turn-running case both become
`automatic`. The manual buttons do not show, because autorun is about to make
that click.

An open question and a failed step both still show with autorun on, because
autorun stops on both. `maybeAutoAdvanceWorkflow` skips a run with open
questions and a paused run.

### Ask after the plan

A run whose copy of the rules says `plan` holds once a plan for that run exists
(`active` or `consumed`). The hold is a saved stop,
`orchestrationStop { kind: 'plan-approval' }`, in the same columns as a pause,
so it survives a restart. `admitWorkflowRun` is the admission check for both:
it returns `paused`, `plan-approval` or nothing, writes the hold the first time
it sees the plan, and runs inside `activateWorkflowAgent`, `orchestrateNextStep`
and `maybeAutoAdvanceWorkflow`. `bypassGate` never skips it, so the step
button, a skip, a read-now hint and a retry all stop at the hold.
Switching the run to another autonomy also drops the hold. A plan step that
writes no plan never holds. While it holds, the run's status reads
**Plan ready**, not a failure (a button, **Review plan**, on the run page), and
**Run next step** is hidden, so **Approve** is the only way on; **Run next
step** comes back once the plan is approved.

#### Approve moves the run on

**Approve** (`approveWorkflowRunPlan(sessionId, runId)`) approves the plan the
run holds for and moves the run on, whether or not it runs on its own.
It writes the copy's `planApproved` first, then clears the stop, then moves on,
and it answers with what happened so the caller can say it:

| Result                                           | When                                                                                                                                                                                                                        |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `approved`, `next: 'started'`, `agentId`         | the run does not run on its own: the step that consumes the plan was started through `activateWorkflowAgent`, the same door as **Run next step**, and the answer comes once that step has started, not once it has finished |
| `approved`, `next: 'continues'`, `agentId: null` | the run runs on its own (`maybeAutoAdvanceWorkflow` takes it from here), a dynamic run (the orchestrator decides the next step), or the next step was blocked by an open question (the notification says why)               |
| `noop`, `missing-run`                            | the run is not in the session                                                                                                                                                                                               |
| `noop`, `not-held`                               | the run is not held, or an Approve for it is already in flight: a second Approve does nothing and starts nothing                                                                                                            |
| `failed`, `message`                              | a write failed, or the planner is revising the plan; the hold stays                                                                                                                                                         |

A write that fails leaves no half approval: the snapshot write comes first, and
if clearing the stop fails after it, the snapshot is put back. The in-store run
changes only after both writes went through. The run header's overflow reads it
through `useApproveRunPlan`; the plan drawer, its comment bar and the plan row
read it through `usePlanPrimaryAction`; the Artifacts page, the palette and the
object menu read it through `artifact.runPlan` ([The run page](#the-run-page)).

#### One primary for a plan

`planPrimaryOf({ plan, run, drafts })` (`features/plans/planPrimaryOf.ts`) is
the one rule for the primary button of a plan, on every surface. `run` is the
run the plan feeds (`planRunOf`): the run held for the plan, or the run whose
planner step wrote it and whose next step consumes plans.

| Plan and run                                      | Primary                                                | Label                                                 |
| ------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| the planner is revising it                        | `disabled`, reason "The planner is revising this plan" | `Approve` on a run plan, `Run plan` on a session plan |
| ran, replaced, deleted or running                 | `none`                                                 | none                                                  |
| a run is held for it                              | `approve`                                              | `Approve`                                             |
| its run's next step consumes it                   | `approve`                                              | `Approve`                                             |
| its run took it already (`planApproved`, no hold) | `none`                                                 | none                                                  |
| its run was discarded                             | `run`                                                  | `Run plan`                                            |
| a session plan                                    | `run`                                                  | `Run plan`                                            |

With unsent comments the kind stays and `isSecondary` is true: the comment
bar's **Send to planner** is the one filled button. `artifact.runPlan` takes its
label, its reason and its action from this rule, so it is never **Run plan** on
a plan that belongs to a run. On a held run it calls `approveWorkflowRunPlan`,
whatever the page hands it as its own run port; on a run that is not held it
runs the plan through its workflow. After an `approved` result, or a workflow
start from **Approve**, it shows one `info` toast, **Plan approved**, saying
"The run goes on" or "Implement started", with the key `follow:<run id>` and
the action **Follow the run** (left out when the run page is already open).
A `noop` shows nothing and a `failed` goes to the notifications as "Couldn't
approve the plan".

#### The plan drawer

The drawer (`features/artifacts/components/ArtifactDocumentDrawer`) is where a
plan is read, commented, edited and approved. Every plan entry opens it over
the current page (`openPlanAnywhere`); the only way to the Artifacts page is its
own **Open in Artifacts**.

- **Header.** Two rows at any width: the plan icon, the title (two lines at
  most) and Close; then the state chip, the version (`v2`), the one primary,
  **Edit** and an overflow with **Open in Artifacts**, **Expand** or
  **Collapse**, and **Copy markdown**. Expanded, the header is one full-width
  row and the body is centred at 720px. A line under the header says one thing
  at a time: the inline question, the reason the primary or **Edit** is off, or
  who wrote this version ("v3 · Revised by planner", "v3 · Edited by you",
  from the revision's author).
- **One primary.** `PlanPrimaryButton` draws `planPrimaryOf`: `approve` is a
  filled **Approve**, `run` a filled **Run plan**, `disabled` the same button
  off with its reason printed beside it, `none` no button (the chip says
  Approved or Running). With unsent comments the kind stays, the button turns
  secondary and the comment bar's **Send to planner** is the one filled
  button; pressing **Approve** then asks inline "3 comments are not sent.
  Approve anyway?". The comment bar keeps an **Approve** (secondary) whenever
  the run waits on the plan, with or without comments. **Run plan** on a
  session plan is `usePlanRun` and its own toast.
- **Approve.** `markUserStart` for the run first, then
  `approveWorkflowRunPlan` for the run held for the plan (a run that is not
  held starts the step through `runPlan`). `approved` raises one
  `useFollowToast` toast, "Plan approved" with "The run goes on" or
  "<Step> started" and the action **Follow the run**, which the hook leaves
  out when the run page is open and uncovered; when the drawer sits over that
  run's page it closes first. `noop` closes and raises nothing. `failed`
  goes to `reportError` ("Couldn't approve the plan") and the drawer stays.
- **Comment and re-plan.** Drafts gather in the bar. Send dims the body under a
  "Revising to v3" line. A new version shows "v3 · Revised by planner" and
  settles the comments as before. `unchanged` shows "The planner answered
  without changing the plan" with **Open the reply** (the planner's page) and
  leaves the comments open. A question the planner asked is the existing
  question card at the top of the body with **Answer**, and the bar waits
  ("The planner asked a question. Answer it first.").

#### Editing a plan by hand

A hand edit saves against the revision it started from
(`updatePlanBody(sessionId, planId, title, bodyMd, expectedRevision)` over
`updatePlanBodyIfRevision`): if the planner wrote meanwhile the answer is
`conflict` with the planner's revision and nothing is written; a save bumps the
revision as author `user` and refreshes the session's plans and artifacts.
`planEditBlockOf` gives the reason **Edit** is off: the planner is revising,
comments are unsent ("Send or discard your 3 comments first"), or the plan
runs as two or more parallel parts ("This plan runs as 3 parallel parts. Ask
the planner to change it."), because the parts a run fans out from live in the
plan's metadata and a hand edit keeps them.

The editor is one component, `PlanEditor` with `usePlanEditor`
(`features/artifacts/components/PlanEditor`), used by the drawer and by the
Artifacts page through the `artifact.edit` action. **Edit** swaps the body for
the markdown editor in place; the header's primary becomes **Save** with
**Cancel** beside it, and **Approve** is hidden. **Save** sends the revision the
edit started from: `saved` leaves edit mode and the line reads "v3 · Edited by
you"; `conflict` keeps your text and says "The planner wrote v3 meanwhile",
with **Copy your text** and **Discard**. **Esc** in edit mode leaves edit mode
and never closes the drawer: the editor registers its own escape layer above
the drawer's, so a scrim click does the same. A changed edit asks "Discard your
edit?" first, and **Esc** again keeps editing.

### Pause is one admission check

A pause is a saved stop, `orchestrationStop { kind: 'paused' }`, in the
existing `orchestration_stop_kind` and `orchestration_error` columns, so it
needs no migration and survives a restart. An older build reads it as a stop
it does not recognize. `isRunPaused` is the one admission check:
`activateWorkflowAgent` throws a `WorkflowGateError` with reason `paused`
before it starts, before it consumes a plan and again right before the turn,
so a pause that lands while an activation is in flight starts nothing. The
check ignores `bypassGate`, which still means only "skip the question gate".
`orchestrateNextStep` returns at once on a paused run and drops a decision
that comes back after the pause, `maybeAutoAdvanceWorkflow` leaves paused
runs out, a read-now hint stays queued, and a skip marks the step but starts
nothing. `pauseWorkflowRun` and `resumeWorkflowRun` write and clear the stop;
resume calls `maybeAutoAdvanceWorkflow`, so the run moves only when it runs
on its own, and `auto_run` is never touched. `continueWorkflowRun` also takes a
static run, through the same auto advance. It only starts the next agent when every agent is `completed` or
`skipped`, and a `failed` or `blocked` agent is never either.

One check decides when a run is finished: `isWorkflowRunComplete`. The chain
trigger, attach and the builder all use it. A run is not finished while any
agent with a parent is still neither `completed` nor `skipped`. This is checked
first, so a dynamic run marked `done` still waits for a running child. After
that, a dynamic run finishes on its `done` outcome. A static run needs its
template, at least one step, and every step agent settled.

"Settled" has one definition in `@goodboy/core`, with two readings.
`isAgentStatusSettled` is the status alone: `completed` or `skipped`. Every
check that advances, chains or finishes a run uses it, so closing an agent by
hand (`doneAt`) never moves a run. `isAgentSettled` also counts an agent you
closed. Only what the screen draws uses it: the lane of an agent's children in
the activity rail and in the run tree of the workflow detail.
`isAgentStatusHalted` is the other side: `failed` or `blocked`, an agent that
stopped and waits for you. The workflow chain, the Next action strip and the
recovery prompt all read it, so a blocked step holds the run exactly like a
failed one.

An agent you stop (Interrupt, or Stop in the composer) is `stopped`, with
`stopped_by = you`. An agent still running when Goodboy quits comes back as
`stopped` with `stopped_by = app`, and the next time its workspace loads it is
resumed on its own when the exit was clean (see
[turns.md](turns.md#surviving-a-reload-or-a-restart)). One it cannot resume
reads "Stopped by restart" and offers Resume, which runs the same resume. When
the restart stopped any of the run's agents, the run shows one **Resume all**
above its steps for all of them. A stopped agent is neither settled nor failed: its row, the run and the agent
header say it was stopped and offer Continue, which sends "Continue from where
you stopped." as a normal message. A resumed step completes like any other, so
autorun moves on from it.
The run never passes a stopped step (`stopped-step`), and a stopped step does
not count as needing you. Any later status change clears the stop.

A step has no Close. Closing an agent is for agents outside a workflow (see
[concepts.md](concepts.md#agents)). A stuck or live step is passed with
Skip, which says what the run does next. `skipStuckStepAndAdvance` takes
`force` and `agentId` for a live step: it cancels only that agent's turn,
marks it `skipped`, and starts the next step once without waiting for its
turn.

A hands-free run (`auto_run`, set on the run or taken from the session) waits
for a busy summarizer. It checks every 100ms for up to 60 seconds, then moves
on whether the summarizer finished or not. It still stops on any budget alert
you have not dismissed. A run can also be held until another named run
finishes.

When autorun stops on a failed step, Goodboy sends a `workflow blocked`
warning that names the step, **once per stop, not once per check**. The
warning is keyed by the failed step and the agent that failed on it.

- Another run on the same session that is still going does not repeat the warning for the same stop
- A retry creates a new agent row, so it does send a new warning

Screens outside the lens name the block and offer the skip. They do not say
the run is on autorun. Outside the lens the resolver cannot see the budget
stop or a run waiting on another run. It would call a run automatic even
though that run will never take another step, and the manual button would
disappear.

### Orchestrated runs

A run whose `execution_mode` is `dynamic` has no list of steps to walk.
Between steps, `orchestrateNextStep` asks the orchestrator model for one
decision: the next step (name, role, prompt, expected output and a proposed
model), `done`, or `blocked`. A `next` decision adds the step and starts its
agent. `done` and `blocked` are saved as the run's outcome with the reason,
and `blocked` sends a notification. Every decision lands in the transcript as
an `orchestrator_decision` event, and its spend is recorded against the run.

- **One decision at a time.** A request that comes in while the run is
  deciding waits in a queue and runs once the current decision settles.
- **Stops are saved, with a kind.** Before the call, the orchestrator checks
  for a session paused by its spend cap (`sessionBudgetBlockAfterLoad`,
  which reads `session_budgets.on_exceed` first), the run's spend cap in
  pause mode, and open
  questions that block the run. Each one saves a `budget` or `questions` stop.
  A failed or unreadable call saves `failure`. **Stop** saves `operator`,
  turns autorun off and skips the running steps, keeping what they wrote.
  **Pause** saves `paused`, which keeps the step in flight and starts nothing.
  **Stop run** (`closeWorkflowRun`) saves `closed` next to the `done`
  outcome, on static runs too, so `isWorkflowRunClosedByUser` is the one test
  for a closed run and `isWorkflowRunComplete` reads it as ended. A decision
  in flight is thrown away when it returns, as after an operator stop or a
  pause.
  Nothing decides again until you continue. Continuing or retrying clears the
  outcome and the stop, and a retry after an operator stop turns autorun back
  on.
- **Its model.** The orchestrator runs on the run's own routing when one is
  set and the catalog still has it. Otherwise it runs on the workflow
  orchestrator task model. A saved model the catalog dropped is ignored, never
  started. Steps take their role models from the resolved settings. A run has
  no per-role model overrides of its own.
- **Its provider pool.** `provider_pool` on `session_workflows` (m170) holds
  the providers picked in **Can use**, as a JSON list. Empty means every
  connected provider. `workflowAvailabilitySnapshot` drops the providers
  outside the pool, so the model menu, the routing of each decision, the
  children a step fans out (`childRoutingBatch` with the run id) and the child
  menu in the agent prompt all see the same narrowed set. A pick outside the
  pool is moved the same way as a pick on a provider in cooldown. The
  orchestrator's own model is not bound by the pool.
- **Hints.** Hints are saved in the run's hint log (`orchestrator_hint_log` on
  `session_workflows`) and survive a restart. A hint with images carries
  `attachmentIds`; the files are `goal_attachments` rows owned by the run, so
  every step agent's kickoff lists them. The decision reads each hint as one
  `- [new]` line, and every further line of the hint is indented by two
  spaces, so a line inside a hint can never pose as a hint of its own. **Read now** on a live
  orchestrated run marks a decision in flight for restart: its answer is
  thrown away when it returns (its spend still counts) and a fresh decision
  reads the hint. Running steps are cancelled and marked skipped before a new
  decision is asked for. When a decision lands, the hints it read are marked
  used, with the step they informed. A hint added while it was deciding stays
  pending for the next one. `orchestratorReadingHints` holds, per run, the
  unread hints a decision in flight took in, plus a hint sent with **Read now**
  until the decision it asked for starts. A decision that ends with no restart
  queued behind it clears the entry, so a hint nothing picked up goes back to
  queued.

The restart marks, the hints being read, the set of runs that are deciding and
the queued requests live in memory, keyed by run and removed with it. Everything a restart needs
(outcome, stop, summary, hints) is on the run's row.

Expected output belongs to a workflow's own steps and to saved steps
(`step_library.expected_output`, `m181`). Rows written before the field existed
have none, except the seeded example steps that the backfill filled in.

### The post-step summarizer

A step finishes when its agent writes a `<<step-done ...>>` marker or saves a
plan. Goodboy then turns the chat into the handoff the next step reads. So
step N+1 never reads step N's full chat.

The summary follows fixed rules. It is not free text.

- It starts with a one-line outcome
- It has a maximum length
- Facts come in order of importance: file paths, decisions, actions, problems, blockers
- The step's expected output comes before everything else, so the handoff starts with what the next step was promised

**The summarizer never decides if the step succeeded.** If the model fails,
times out or breaks the rules, Goodboy falls back to cutting the chat down to
its start and end. No model is involved in that fallback.

The step still completes, the result is marked `degraded`, and a notification
offers to retry. Either way, the summary is what the next step starts from.

### Step sequencing

Steps run one after another. Parallel work happens inside a step. The
`parallel_agents` setting decides whether a scout step can split into several agents.

### When a step stops without its done marker

Every kickoff, re-kick and recovery prompt ends with the scope line from
`composeUnitBoundary`. It names the done marker and the question channel: a
question in plain prose never reaches the user, so an agent that needs an
answer, an approval or a confirmation asks it in a blocking
`<<ctx-question>>` block and stops.

When a step or a sub-agent ends a turn without its `step-done` or
`cluster-done` marker, `holdForUserQuestion` looks at the turn first:

- It carries a `<<ctx-question>>`: the step waits for your answer. No re-kick
  is spent.
- It ends by asking you something in prose (a question, "confirm the
  force-push", "I need your approval"): `extractProseQuestion` in
  `@goodboy/core` takes the asking paragraph from the closing paragraph of
  the turn, and Goodboy saves it as a blocking open question owned by that
  agent. It shows with the other open questions, and your answer goes back to
  the same agent. No re-kick is spent. Only a question or a request addressed
  to you counts: a reply that reports, explains or says what was waiting on a
  confirmation earlier ("the earlier steps were waiting for your approval")
  asks nothing, and an ask followed by a closing paragraph of report is not
  the end of the turn. A question the heuristic gets wrong still closes: write
  what you mean and choose **Send as message** on the card.

Otherwise `continueOrPause` decides. A hands-free step or sub-agent is
re-kicked once. After that, or at once when autorun is off, the agent stops in
one of two states:

- `failed`: the agent died. Its last turn ended with a stream error or with no
  output at all. A crash, a non-zero exit, a spawn error, an auth or quota
  error or a kill ends the turn in `sendTurn` and is marked `failed` there.
- `blocked`: the agent is alive but did not finish, and asked nothing. The
  runaway breaker (too many unattended workflow turns in an hour) and a
  sub-agent whose plan instructions are no longer readable also end in
  `blocked`. A blocked agent resumes when you write to it, or through Ask it
  to continue and Skip.
