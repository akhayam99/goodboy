# Auto

> **Read this when** you change or explain the Auto agent: its experiment
> switch, how a person starts it, what it shows in the Overview and its chat,
> how a plan is approved, and which providers it may use. **Not for** the
> tables and the scheduler behind it ([architecture.md](architecture.md), Auto
> tree registry) or
> what a role is ([concepts.md](concepts.md)).

Auto is an agent that answers questions itself and hands the work it cannot do
alone to agents of the right role, with a model it picks for each. It waits for
their results, reads them and goes on. It ships as an experiment: off by
default, labelled **Experimental**, and the roles you pick today stay as they
are while it is off.

## Status

The feature is on behind the experiment switch: `AUTO_GATES.isDelegationEnabled` is `true`, the
Experiments band shows in Settings, and `agents.autoExperiment` is off by default. The runtime
(`startAutoRuntime`) runs in the main window and drives the trees that exist; with the switch off
none is ever created, so nothing changes for a person who does not turn it on. Its 15 second tick
runs only while the switch is on or a tree that is not finished is left: trees started before a
switch-off still finish and recover, and a person who never opted in has no timer.

**Live proof before the flip.** The real CLIs were launched with the exact argv and prompt
Goodboy builds for an Auto turn:

| CLI    | Version               | Model             | Posture                             |
| ------ | --------------------- | ----------------- | ----------------------------------- |
| claude | 2.1.296 (Claude Code) | claude-sonnet-5-5 | plan mode, `--tools Read,Grep,Glob` |
| codex  | codex-cli 0.162.1     | gpt-5.6-sol       | `-s read-only`                      |

Both ended with a valid `<<auto>>` delegate block that `parseAutoBlock` and `parseDelegateSpec`
accept. Neither tried to write a file or run a shell command, and the work tree stayed clean.

## The experiment switch

- Settings, App, General has a band **Experiments**, below Search, with one row
  **Auto agent**, its **Experimental** chip and a switch. The row says once what
  it does and that it may not work well yet. With the switch off and Auto agents
  still working, a muted line under it counts them: "2 Auto agents are still
  running. They keep going." The switch governs entry only.
- The value is the setting `agents.autoExperiment`. It is on only for the exact
  string `true`; absent or anything else is off.
- `isAutoStartEnabled` (`features/auto/isAutoStartEnabled.ts`) is the one
  function that says whether Auto is on. `useIsAutoOn` reads it for every
  surface. It needs the release gate too: `AUTO_GATES.isDelegationEnabled` is
  `true` in this build and reaches the screens through `AutoReleaseContext`. A
  build with the gate false would hide the band, the Auto start and every Auto
  control, whatever is stored. With the gate on, the band always shows and the
  switch is off until a person turns it on, so every start surface, menu and
  runtime path stays exactly as it was before Auto.
- The switch saves with a compare and swap (`writeAutoExperiment`): it reads the
  stored value, writes against it, rereads once on a lost swap, and when an
  answer is lost after the commit it rereads and accepts what is stored. The
  cache repaints from the stored value only, so a failed save snaps the switch
  back and shows "Couldn't save the Auto setting". Two quick clicks write once
  (`usePendingAction`).
- The value reloads from the database when the window gets focus and whenever a
  start surface opens, so a second window follows the first.

## Starting

With the experiment on, Auto is the only start in the **Agent** tab of the New
drawer, in the **Start agent** popover of the Agents lane and under **Ask an
agent** on the New session page. There is no role list, no project field and no
guidance: Auto picks the mount and asks when it is ambiguous. With it off, the
start is the one of before: role grid, Generalist as default, Routing.

- Every start reads the stored setting at the click (`useConfirmStartMode`). If
  the form on screen is not the stored mode, another window changed it: the form
  repaints for the stored mode, the text is kept (the Auto goal and the legacy
  instructions move between `autoGoal` and `agentPrompt`) and the person starts
  again. Nothing starts in a mode they did not see.
- The goal is the first message of the Auto agent. It is not a plain turn: the
  tree is created at the start and the goal is queued in its outbox, so Auto's
  first turn is a delivery like every later one. A start that loses the message
  says "Auto didn't start" and the chat keeps no half-started turn.
- The composer is one goal, files, one model chip and **Start Auto**. Auto runs
  on any connected provider that can confine a read-only agent (`AUTO_OWN_PROVIDERS`: not the
  opencode family, see Providers), with the route the workspace picks for the role.
  **Start Auto** says why it is off when no such provider is connected, also when only
  opencode, OpenRouter or Moonshot is.
- The **Spend cap** chip proposes 5 USD, or shows the budget of the session when
  there is one. The first start stores the cap for the workspace
  (`auto.treeLimitUsd.<workspace id>`, compare and swap), so the next start is
  not asked again; a person can change it from the chip.
- A Next card that starts a role gets **Talk it through with Auto** as the last
  entry of its more menu. It is the registry verb `suggestion.talkWithAuto`
  (`features/actions/kinds/suggestion.ts`), shown only while the experiment is
  on and the card starts a role. It opens the Agent tab with the card as context
  (`startTalkItThrough`) and starts nothing.
- **Generalist** keeps its name, with no mark of being old, and existing
  Generalist agents are not changed. Auto never appears in the manual role list.

## Moving an agent to Auto

**Move to Auto** hands an agent you started yourself to Auto. It is in the menu
of an Implementer, Tester, Scout, Planner, Reviewer, Debugger or docs agent and
of an old Generalist (the registry verbs `agent.moveToAuto` and
`agent.detachFromAuto` in `features/actions/kinds/agent.ts`, so the header menu,
the right click and the palette agree). It is hidden while the experiment is off
and blocked with "Wait for the turn to end first." while the agent works.

- The verb opens the chat of the agent and replaces its composer with a panel,
  **What should Auto do next?** (`MoveToAutoPanel`). The field may stay empty. A
  handoff marker with `kind=auto` shows the same panel from the chip **Agent
  suggests: Auto**, which does not start an agent of its own.
- `moveToAuto` (`features/auto/moveToAuto.ts`) reads the setting from the database
  at the click, then `adoptAgent` (`store/slices/auto/adoptAgent.ts`) writes the
  whole transfer in one guarded transaction: a new Auto agent, its tree, one
  adopted delegation for the source (settled, `adopted = 1`), the plan and report
  artifacts of the source in `auto_artifacts`, and one `user` outbox row with the
  kickoff (`composeAdoptionKickoff`: what the user asked, the last reply, the
  artifacts, the mount and the words of the user). The tree starts in `merging`.
  Right after the commit `moveToAuto` drives the tree through the drive port
  (`autoDrivePort`, registered by `startAutoRuntime`), so Auto gets the kickoff and
  the result of the source at once. A window with no runtime leaves it to the
  scheduler tick of the main window, which delivers the same rows.
- One Auto per source: the transaction refuses an agent that has a delegation row
  or a tree (a second click returns the first Auto), a step of a Run ("Pause or
  finish the run first."), a running turn, a kind with no role, and any agent
  whose parent or child chain holds an Auto agent. A failure writes nothing and
  leaves the source as it was.
- The source keeps its row and its chat. Its composer is replaced by the notice
  **Moved to Auto** (`AdoptedNotice`) with **Open Auto** and **Detach from Auto**.
  Inside a tree the Continue buttons and the handoff chip are hidden.
- **Detach from Auto** (`detachAdopted`) is the undo, also offered in the toast of
  the move. It removes the adopted delegation, its artifacts and the words about it
  Auto has not read yet, and bumps the tree revision. It waits for the turn of the
  agent to end. The Auto agent stays in the session.

## Talking to Auto

A message typed in the composer of an Auto agent is not a plain turn either. The
store's `sendTurn` hands an operator message for the root of an Auto tree to the
runtime (`routeAutoUserTurn`), which creates the tree if it is missing and
queues the text as a `user` outbox row; Auto reads it with the next delivery.
Approving a plan is the same path ("Approved plan v1."). A message the runtime
cannot take, or one with files, is refused with "Auto didn't get your message"
and the composer keeps its text. A turn that is not an operator message, a
child, or an Auto agent in a window with no runtime (the main window owns it) is
left to the plain turn.

## Overview

An Auto tree is one row, like any agent row: its state in the row word and the
cost of the whole tree. The word follows the tree phase:
**Deciding what to do**, **Starting agents**, **Waiting for Implementer and
Tester**, **Needs your approval**, **Reading the results**, **Blocked, open the
chat**, **Stopping**, **Stopped by you**. The children are not rows of the
Overview; they live in the Work rail of the chat.

## The chat

- **Work rail.** The chat of an Auto agent, and of each of its children, has the
  Work rail on its left. Auto comes first, then one row per child, all expanded
  and with no group row. A row has the role, the name and state on the first
  line, the model and time on the second. One spine runs from ring edge to ring
  edge in the tone of the ring it reaches: green when done, blue when working,
  dashed when queued. The foot is the tree budget, **Spent**, **Reserved** and
  **Left** from `treeSpend`. The rail can fold to a strip of rings, and it is
  not drawn for an Auto that only answers.
- **Delegation cards.** Each delegation is a card in the transcript: role, model
  and effort, a live time, one state, Auto's reason, a note when the app changed
  the model it asked for, **Reserved up to** while it works, and when it
  settles its summary, files changed, checks with their source, artifacts and
  open questions, then **Returned to Auto** with the cost and **Open chat**. A
  failed, blocked, timed out or stopped child says why in one sentence. A
  revision is the same producer: **Planner, revising v2**, then **Planner, v2
  ready**. Cards read the delegation, attempt and agent rows, never the message
  text, so a reload draws the same cards.
- **Where a card sits.** A card goes before the first message sent after its
  batch settled, and an open batch goes at the end.
- **While Auto waits.** A line above the composer says **Waiting for Implementer
  and Tester** with **Change approach** and **Stop**, and the composer says
  "Queued: Auto sees it with the next results". A plan that waits for approval
  changes it to "Message Auto, or describe changes to plan v1". In the
  `deciding` phase with no root turn running the same line says **Deciding
  what to do next**; while Auto's own turn runs the line hides and the
  thinking line at the end of the transcript speaks instead, so the state is
  said once.
- **A child opened from a card** reads as Started by Auto. It can be read and
  stopped there, has no composer, and **Open Auto** goes back. When it
  stopped, its notice offers **Retry through Auto**, which asks Auto to retry
  it; it never runs a plain turn on the child (`docs/turns.md`, resume rules).
- **No permission picker in the tree.** The composer of Auto and of its
  children hides the session's permission mode picker: a tree member runs
  with its role's access, not the session mode.

## Plans

The plan a Planner writes opens in the right drawer. Its second row shows
**Needs approval**, **Approved** or **Revising to v2**, the version, **Ask for
changes** and **Approve plan**. Approval belongs to a revision: **Approve plan**
is a compare and swap on the version the drawer shows, then Auto is told once
("Approved plan v1."). A newer version, a revise in progress, a used plan or a
discarded one refuse it with a sentence and the drawer stays open. A second
click, or a second window, on an approved version does not tell Auto again.
Auto cannot start a writer role (Implementer, Tester, Docs) on a plan that is not
approved. The policy is `isAutoPlanApprovalRequired`: the runtime reads the
stored setting `agents.autoPlanApproval` on every tick, and approval is required
unless the stored value is exactly `false`. There is no screen for that setting
yet. **Ask for changes** opens the chat of Auto: a change written there makes Auto
rework the same plan into the next version.

## Confirming

A revise Auto is not sure about waits for an OK in its card: "Change plan
Retry-safe credit retries at v2?" with **Confirm** and **Cancel**. The answer
goes through one port, `registerDelegationDecisionPort`, which the runtime
registers; without a port the click says Auto cannot take the answer yet.

## How Auto decides

Auto runs read-only on every provider that can confine it: the same role access scouts and reviewers get
(Claude with `--tools Read,Grep,Glob` in plan mode, Codex `-s read-only`, Cursor `--mode plan`, and so on). It
has no shell and never calls Goodboy from inside its turn, so there is no bridge command, no
capability token and no allow rule. It decides by ending its final reply with at most one block:

```
<<auto>>{"action":"delegate","requestId":"r1","children":[...]}<</auto>>
```

- `delegate` hands one to four children to agents of a role (`requestId` is optional and
  derived from the run when missing; `children` is the spec `parseDelegateSpec` validates).
- `answer` answers the question of a child (`delegation`, `question`, `text`).
- `finish` says the work is done (`summary`). It is refused while an agent is open or a result
  waits.
- No block is a plain answer to the user.

`parseAutoBlock` (`packages/core/src/auto/autoBlock.ts`) reads only the settled text of a turn that
ended ok: it takes the last complete block, strips code fences, escapes raw line breaks in strings
and falls back to the last `}` when the close marker is missing. `store/slices/auto/applyAutoBlock.ts`
runs at the top of `settleAutoTurn` and only for the current run of a `deciding` tree that is not
stopping, so a duplicate settle, a late settle after a stop and a recovered turn that passes the
same text admit once (the admission guards and the request id replay do the rest).

What Auto cannot say comes back as a message, not as a reply inside the turn. A refused spec, a
budget or limit refusal and a block that does not parse become a `refusal` row in the outbox,
delivered with the next turn under REFUSED, NOT DONE; such a turn counts as no progress, so
`noProgressStreak` bounds retries. The refusal counters (`refusals_used`, the limit on refusals)
move once per generation and run, so a duplicate settle of the same turn cannot spend the limit twice. Every delivery starts with a digest of the tree (open agents
with role, state and age, questions waiting, the budget) and carries the artifact text of each
result, cut when long, so a provider that does not resume sessions still has its memory. The
`<<auto>>` block is hidden in the transcript like the other markers; the delegation cards show
what it did. See [query-bridge.md](query-bridge.md) for the bridge Auto does not use.

## Providers

Auto itself runs on Claude, Codex, Cursor and Gemini (`AUTO_OWN_PROVIDERS`), because it only reads
there. It never runs on the opencode family (opencode, OpenRouter, Moonshot,
`AUTO_UNCONFINED_PROVIDERS`): the `plan` agent of opencode denies edits but asks before a shell
command, and Goodboy always passes `--dangerously-skip-permissions` to opencode, which approves the
ask, so a read-only turn there could still run a shell. Whether opencode can run without that flag
and deny the ask is unproven, so Auto is kept off it instead. Three layers hold the line: the
composer lists only `AUTO_OWN_PROVIDERS` and shows "Auto needs a connected provider" when nothing
else is connected; `kindRouting` for Auto never resolves to the family (the role default, a stored
role pick and the model of the chat are all skipped) and `spawnAgent` refuses an Auto agent on it;
and `turn_spawn` refuses the role `auto` on an opencode binary (`ensure_confinement`). Its children run
on Claude and Codex, never on Cursor or Gemini, which cannot confine a role
(`AUTO_CHILD_PROVIDERS`). The pool of a tree is the run
pool when there is one, else the workspace pool (the providers the workspace
policy on the Models page does not turn off), else every allowed provider
(`autoChildPool`, `runProviderPool`).

## What the screens read

The screens read the registry through the `auto-view` slice
(`loadAutoTrees`), which polls every 2 seconds while a session has an Auto
agent or a tree that is not finished. Nothing pushes tree changes to a window
yet. The numbers on screen come from the budget function the prompt and the
admission use, so they agree.
